import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { getInstallableSkills, readCatalog } from "./catalog.js";
import {
  claudeHome,
  claudeSkillsDir,
  packageRoot,
  projectClaudeHome,
  projectSkillsDir,
  setupScopePath,
} from "./paths.js";
import {
  installManifestPath,
  isExecutable,
  listRuntimeFiles,
  readInstallManifest,
  sha256File,
  type InstallManifest,
} from "./install-manifest.js";
import type { SetupScope } from "./setup.js";
import { readConfig } from "./config.js";

export interface DoctorResult {
  ok: boolean;
  warnings: boolean;
  scope: SetupScope;
  skillsDir: string;
  checks: Check[];
}

export interface Check {
  name: string;
  status: "pass" | "warn" | "fail";
  passed: boolean;
  message: string;
}

export interface DoctorOptions {
  scope?: SetupScope;
  projectRoot?: string;
}

export async function doctor(options: DoctorOptions = {}): Promise<DoctorResult> {
  const checks: Check[] = [];
  const projectRoot = options.projectRoot ?? process.cwd();
  const scope = options.scope ?? (await resolveDoctorScope(projectRoot));
  const home = scope === "project" ? projectClaudeHome(projectRoot) : claudeHome();
  const skillsDir = scope === "project" ? projectSkillsDir(projectRoot) : claudeSkillsDir();

  checks.push(check("claude home", existsSync(home) ? "pass" : "fail", existsSync(home) ? home : `not found: ${home}`));

  const skillsDirExists = existsSync(skillsDir);
  checks.push(check(
    "skills directory",
    skillsDirExists ? "pass" : "fail",
    skillsDirExists ? skillsDir : `not found: ${skillsDir} (run: omv setup --scope ${scope})`,
  ));

  if (scope === "user" && existsSync(projectSkillsDir(projectRoot))) {
    checks.push(check("project skills", "warn", `project skills also exist: ${projectSkillsDir(projectRoot)}`));
  }

  const catalog = await readCatalog();
  const installableSkills = getInstallableSkills(catalog);
  checks.push(check("registry", installableSkills.length > 0 ? "pass" : "fail", `${catalog.version} (${installableSkills.length} installable skills)`));

  if (skillsDirExists) {
    for (const skill of installableSkills) {
      const sourceSkillDir = join(packageRoot(), skill.path);
      const installedSkillDir = join(skillsDir, skill.name);
      const files = await listRuntimeFiles(sourceSkillDir);
      const missing = files.filter((file) => !existsSync(join(installedSkillDir, file)));
      const referenceErrors = missing.length === 0 ? await validateInstalledReferences(installedSkillDir) : [];
      const scriptErrors = missing.length === 0 ? await validateExecutableScripts(installedSkillDir, files) : [];
      const problems = [...missing.map((file) => `missing ${file}`), ...referenceErrors, ...scriptErrors];
      checks.push(check(
        `skill: ${skill.name}`,
        problems.length === 0 ? "pass" : "fail",
        problems.length === 0
          ? `installed (${skill.invocation})`
          : `${problems.slice(0, 3).join(", ")}${problems.length > 3 ? ", ..." : ""} (run: omv setup --scope ${scope} --force)`,
      ));
    }

    const unexpected = await findUnexpectedInstalledSkills(skillsDir, installableSkills.map((skill) => skill.name));
    if (unexpected.length > 0) {
      checks.push(check("unexpected skills", "warn", unexpected.join(", ")));
    }

    checks.push(...(await validateInstallManifest(scope, projectRoot, skillsDir, catalog.version)));
  }

  const failCount = checks.filter((item) => item.status === "fail").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;

  return {
    ok: failCount === 0,
    warnings: warnCount > 0,
    scope,
    skillsDir,
    checks,
  };
}

function check(name: string, status: Check["status"], message: string): Check {
  return {
    name,
    status,
    passed: status !== "fail",
    message,
  };
}

async function resolveDoctorScope(projectRoot: string): Promise<SetupScope> {
  const path = setupScopePath(projectRoot);
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf-8")) as { scope?: string };
      return parsed.scope === "project" ? "project" : "user";
    } catch {
      // fall through
    }
  }
  const config = await readConfig();
  return config.scope === "project" ? "project" : "user";
}

async function findUnexpectedInstalledSkills(skillsDir: string, expected: string[]): Promise<string[]> {
  const expectedSet = new Set(expected);
  const dirents = await readdir(skillsDir, { withFileTypes: true }).catch(() => []);
  return dirents
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)
    .filter((name) => !expectedSet.has(name) && existsSync(join(skillsDir, name, "SKILL.md")))
    .sort();
}

async function validateInstalledReferences(skillDir: string): Promise<string[]> {
  const skillMd = join(skillDir, "SKILL.md");
  const text = await readFile(skillMd, "utf-8");
  const errors: string[] = [];
  const referenced = [
    ...text.matchAll(/`((?:references|contracts|scripts)\/[^`]+(?:\.md|\.yaml|\.yml|\.py|\.sh))`/g),
  ].map((match) => match[1]);
  const upwardRefs = [...text.matchAll(/`(\.\.\/[^`]+)`/g)].map((match) => match[1]);

  for (const rel of upwardRefs) {
    errors.push(`package-external reference ${rel}`);
  }
  for (const rel of referenced) {
    if (!existsSync(join(skillDir, rel))) {
      errors.push(`broken reference ${rel}`);
    }
  }
  return errors;
}

async function validateExecutableScripts(skillDir: string, files: string[]): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    if (!file.startsWith("scripts/") || !file.endsWith(".sh")) {
      continue;
    }
    if (!(await isExecutable(join(skillDir, file)))) {
      errors.push(`not executable ${file}`);
    }
  }
  return errors;
}

async function validateInstallManifest(
  scope: SetupScope,
  projectRoot: string,
  skillsDir: string,
  registryVersion: string,
): Promise<Check[]> {
  const path = installManifestPath(scope, projectRoot);
  const manifest = await readInstallManifest(path);
  if (!manifest) {
    return [check("install manifest", "warn", `not found or unreadable: ${path} (run: omv setup --scope ${scope} --force)`)];
  }

  const checks: Check[] = [];
  const packageJson = JSON.parse(await readFile(join(packageRoot(), "package.json"), "utf-8")) as { version?: string };

  if (manifest.scope !== scope) {
    checks.push(check("install manifest", "warn", `scope is ${manifest.scope}, expected ${scope}`));
  } else if (manifest.package_version !== packageJson.version || manifest.registry_version !== registryVersion) {
    checks.push(check(
      "install manifest",
      "warn",
      `stale version package=${manifest.package_version} registry=${manifest.registry_version} (run: omv setup --scope ${scope} --force)`,
    ));
  } else {
    checks.push(check("install manifest", "pass", path));
  }

  const modified = await findModifiedInstalledFiles(manifest, skillsDir);
  if (modified.length > 0) {
    checks.push(check(
      "modified installed files",
      "warn",
      `${modified.slice(0, 3).join(", ")}${modified.length > 3 ? ", ..." : ""}`,
    ));
  }

  return checks;
}

async function findModifiedInstalledFiles(manifest: InstallManifest, skillsDir: string): Promise<string[]> {
  const modified: string[] = [];
  for (const skill of manifest.skills) {
    for (const file of skill.files) {
      const path = join(skillsDir, skill.name, file.path);
      if (!existsSync(path)) {
        continue;
      }
      if ((await sha256File(path)) !== file.sha256) {
        modified.push(`${skill.name}/${file.path}`);
      }
    }
  }
  return modified;
}
