import { existsSync } from "fs";
import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { getInstallableSkills, readCatalog } from "./catalog.js";
import {
  claudeAgentsDir,
  claudeHome,
  codexHome,
  packageAgentsDir,
  packageRoot,
  projectAgentsDir,
  projectClaudeHome,
  projectCodexSkillsDir,
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
import { resolveSkillsDir, type SetupPlatform, type SetupScope } from "./setup.js";
import { readConfig } from "./config.js";
import { findPythonRuntime } from "./python-runtime.js";

export interface DoctorResult {
  ok: boolean;
  warnings: boolean;
  scope: SetupScope;
  platform: SetupPlatform;
  skillsDir: string;
  checks: Check[];
}

export interface Check {
  name: string;
  status: "pass" | "warn" | "fail";
  passed: boolean;
  message: string;
  remediation?: string;
}

export interface DoctorOptions {
  scope?: SetupScope;
  platform?: SetupPlatform;
  projectRoot?: string;
}

export async function doctor(options: DoctorOptions = {}): Promise<DoctorResult> {
  const checks: Check[] = [];
  const projectRoot = options.projectRoot ?? process.cwd();
  const scope = options.scope ?? (await resolveDoctorScope(projectRoot));
  const platform = options.platform
    ?? (scope === "project" ? await resolveDoctorPlatform(projectRoot) : "claude-code");
  const home = platform === "codex"
    ? (scope === "project" ? projectRoot : codexHome())
    : (scope === "project" ? projectClaudeHome(projectRoot) : claudeHome());
  const skillsDir = resolveSkillsDir(scope, platform, projectRoot);
  const repair = setupCommand(scope, platform);

  checks.push(check(`${platform} home`, existsSync(home) ? "pass" : "fail", existsSync(home) ? home : `not found: ${home}`));

  const skillsDirExists = existsSync(skillsDir);
  checks.push(check(
    "skills directory",
    skillsDirExists ? "pass" : "fail",
    skillsDirExists ? skillsDir : `not found: ${skillsDir} (run: ${repair})`,
  ));

  const catalog = await readCatalog();
  const installableSkills = getInstallableSkills(catalog);
  checks.push(check("registry", installableSkills.length > 0 ? "pass" : "fail", `${catalog.version} (${installableSkills.length} installable skills)`));
  const python = findPythonRuntime();
  checks.push(check(
    "python runtime",
    python ? "pass" : "warn",
    python ? `${python.displayName} (Python 3)` : "Python 3 was not found; Skill helper scripts will be unavailable",
    python ? undefined : "Install Python 3 or set OMV_PYTHON to its executable path",
  ));

  const projectSkills = platform === "codex" ? projectCodexSkillsDir(projectRoot) : projectSkillsDir(projectRoot);
  if (
    scope === "user"
    && installableSkills.some((skill) => existsSync(join(projectSkills, skill.name, "SKILL.md")))
  ) {
    checks.push(check(
      "project install",
      "warn",
      `oh-my-vul skills also exist at project scope: ${projectSkills}`,
      `omv doctor --scope project --platform ${platform}`,
    ));
  }

  if (skillsDirExists) {
    for (const skill of installableSkills) {
      const sourceSkillDir = join(packageRoot(), skill.path);
      const installedSkillDir = join(skillsDir, skill.name);
      const files = await listRuntimeFiles(sourceSkillDir);
      const missing = files.filter((file) => !existsSync(join(installedSkillDir, file)));
      const installedFiles = existsSync(installedSkillDir) ? await listRuntimeFiles(installedSkillDir) : [];
      const extra = installedFiles.filter((file) => !files.includes(file));
      const differing = await differingFiles(sourceSkillDir, installedSkillDir, files, missing);
      const referenceErrors = missing.length === 0 ? await validateInstalledReferences(installedSkillDir) : [];
      const scriptErrors = missing.length === 0 ? await validateExecutableScripts(installedSkillDir, files) : [];
      const problems = [
        ...missing.map((file) => `missing ${file}`),
        ...differing.map((file) => `outdated ${file}`),
        ...referenceErrors,
        ...scriptErrors,
      ];
      const status: Check["status"] = problems.length > 0 ? "fail" : extra.length > 0 ? "warn" : "pass";
      const details = problems.length > 0
        ? problems
        : extra.map((file) => `extra managed file ${file}`);
      checks.push(check(
        `skill: ${skill.name}`,
        status,
        details.length === 0
          ? `installed (${skill.invocation})`
          : `${details.slice(0, 3).join(", ")}${details.length > 3 ? ", ..." : ""}`,
        details.length === 0 ? undefined : `${repair} --force`,
      ));
    }

    checks.push(...(await validateInstallManifest(scope, platform, projectRoot, skillsDir, catalog.version)));
  }

  if (platform === "claude-code") {
    const agentsDir = scope === "project" ? projectAgentsDir(projectRoot) : claudeAgentsDir();
    checks.push(await validateInstalledAgents(agentsDir, scope));
  } else {
    checks.push(check("agents", "pass", "Codex uses skills and native delegation; no Claude agent files required"));
  }

  const failCount = checks.filter((item) => item.status === "fail").length;
  const warnCount = checks.filter((item) => item.status === "warn").length;

  return {
    ok: failCount === 0,
    warnings: warnCount > 0,
    scope,
    platform,
    skillsDir,
    checks,
  };
}

function check(name: string, status: Check["status"], message: string, remediation?: string): Check {
  return {
    name,
    status,
    passed: status !== "fail",
    message,
    remediation,
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

async function resolveDoctorPlatform(projectRoot: string): Promise<SetupPlatform> {
  const path = setupScopePath(projectRoot);
  if (existsSync(path)) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf-8")) as { platform?: string };
      return parsed.platform === "codex" ? "codex" : "claude-code";
    } catch {
      // fall through
    }
  }
  return "claude-code";
}

async function validateInstalledReferences(skillDir: string): Promise<string[]> {
  const skillMd = join(skillDir, "SKILL.md");
  const text = await readFile(skillMd, "utf-8");
  const errors: string[] = [];
  const referenced = [
    ...text.matchAll(/`((?:references|contracts|scripts)\/[^`]+(?:\.md|\.yaml|\.yml|\.py|\.mjs|\.sh))`/g),
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

async function differingFiles(
  sourceSkillDir: string,
  installedSkillDir: string,
  files: string[],
  missing: string[],
): Promise<string[]> {
  const missingSet = new Set(missing);
  const differing: string[] = [];
  for (const file of files) {
    if (missingSet.has(file)) continue;
    if ((await sha256File(join(sourceSkillDir, file))) !== (await sha256File(join(installedSkillDir, file)))) {
      differing.push(file);
    }
  }
  return differing;
}

async function validateInstallManifest(
  scope: SetupScope,
  platform: SetupPlatform,
  projectRoot: string,
  skillsDir: string,
  registryVersion: string,
): Promise<Check[]> {
  const path = installManifestPath(scope, projectRoot, platform);
  const manifest = await readInstallManifest(path);
  if (!manifest) {
    return [check("install manifest", "warn", `not found or unreadable: ${path}`, `${setupCommand(scope, platform)} --force`)];
  }

  const checks: Check[] = [];
  const packageJson = JSON.parse(await readFile(join(packageRoot(), "package.json"), "utf-8")) as { version?: string };

  if (manifest.scope !== scope) {
    checks.push(check(
      "install manifest",
      "warn",
      `scope is ${manifest.scope}, expected ${scope}`,
      `${setupCommand(scope, platform)} --force`,
    ));
  } else if ((manifest.platform ?? "claude-code") !== platform) {
    checks.push(check(
      "install manifest",
      "warn",
      `platform is ${manifest.platform ?? "claude-code"}, expected ${platform}`,
      `${setupCommand(scope, platform)} --force`,
    ));
  } else if (manifest.package_version !== packageJson.version || manifest.registry_version !== registryVersion) {
    checks.push(check(
      "install manifest",
      "warn",
      `stale version package=${manifest.package_version} registry=${manifest.registry_version}`,
      `${setupCommand(scope, platform)} --force`,
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
      `${setupCommand(scope, platform)} --force`,
    ));
  }

  return checks;
}

function setupCommand(scope: SetupScope, platform: SetupPlatform): string {
  return `omv setup --scope ${scope} --platform ${platform}`;
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

/**
 * Verify every bundled `agents/*.md` is installed and matches the package
 * source. Returns a single `agents` check describing the state. Missing or
 * stale agent files are reported (warn, not fail) because agents are an
 * enhancement — skills work without them.
 */
async function validateInstalledAgents(agentsDir: string, scope: SetupScope): Promise<Check> {
  const srcDir = packageAgentsDir();
  if (!existsSync(srcDir)) {
    return check("agents", "pass", "no bundled agents");
  }
  let agentFiles: string[] = [];
  try {
    agentFiles = (await readdir(srcDir)).filter((f) => f.endsWith(".md"));
  } catch {
    return check("agents", "warn", "unable to read bundled agents directory", `${setupCommand(scope, "claude-code")} --force`);
  }
  if (agentFiles.length === 0) {
    return check("agents", "pass", "no bundled agents");
  }

  if (!existsSync(agentsDir)) {
    return check(
      "agents",
      "warn",
      `${agentFiles.length} bundled agent(s) not installed`,
      `${setupCommand(scope, "claude-code")} --force`,
    );
  }

  const stale: string[] = [];
  const missing: string[] = [];
  for (const file of agentFiles) {
    const dest = join(agentsDir, file);
    if (!existsSync(dest)) {
      missing.push(file);
      continue;
    }
    const srcHash = await sha256File(join(srcDir, file));
    const dstHash = await sha256File(dest);
    if (srcHash !== dstHash) {
      stale.push(file);
    }
  }

  const installed = agentFiles.length - missing.length - stale.length;
  if (missing.length === 0 && stale.length === 0) {
    return check("agents", "pass", `${installed}/${agentFiles.length} subagent(s) installed`);
  }
  const problems: string[] = [];
  if (missing.length > 0) {
    problems.push(`missing ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ", ..." : ""}`);
  }
  if (stale.length > 0) {
    problems.push(`stale ${stale.slice(0, 3).join(", ")}${stale.length > 3 ? ", ..." : ""}`);
  }
  return check(
    "agents",
    "warn",
    problems.join("; "),
    `${setupCommand(scope, "claude-code")} --force`,
  );
}
