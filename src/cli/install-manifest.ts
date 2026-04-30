import { existsSync } from "fs";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { createHash } from "crypto";
import { dirname, join } from "path";
import { claudeHome, omvStateDir, packageRoot } from "./paths.js";
import type { SetupScope } from "./setup.js";
import type { SkillCatalogEntry } from "./catalog.js";

export interface InstalledFile {
  path: string;
  sha256: string;
}

export interface InstalledSkill {
  name: string;
  invocation: string;
  files: InstalledFile[];
}

export interface InstallManifest {
  package_name: string;
  package_version: string;
  registry_version: string;
  scope: SetupScope;
  installed_at: string;
  skills: InstalledSkill[];
}

export function installManifestPath(scope: SetupScope, projectRoot = process.cwd()): string {
  return scope === "project"
    ? join(omvStateDir(projectRoot), "install-manifest.json")
    : join(claudeHome(), ".omv", "install-manifest.json");
}

export async function writeInstallManifest(
  path: string,
  manifest: InstallManifest,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
}

export async function readInstallManifest(path: string): Promise<InstallManifest | null> {
  if (!existsSync(path)) {
    return null;
  }
  try {
    return JSON.parse(await readFile(path, "utf-8")) as InstallManifest;
  } catch {
    return null;
  }
}

export async function buildInstallManifest(
  options: {
    scope: SetupScope;
    skillsDir: string;
    skills: SkillCatalogEntry[];
    registryVersion: string;
    projectRoot?: string;
  },
): Promise<InstallManifest> {
  const packageJson = JSON.parse(await readFile(join(packageRoot(), "package.json"), "utf-8")) as {
    name?: string;
    version?: string;
  };
  const installedSkills: InstalledSkill[] = [];
  for (const skill of options.skills) {
    const files = await listRuntimeFiles(join(options.skillsDir, skill.name));
    installedSkills.push({
      name: skill.name,
      invocation: skill.invocation,
      files: await Promise.all(
        files.map(async (file) => ({
          path: file,
          sha256: await sha256File(join(options.skillsDir, skill.name, file)),
        })),
      ),
    });
  }

  return {
    package_name: packageJson.name ?? "",
    package_version: packageJson.version ?? "",
    registry_version: options.registryVersion,
    scope: options.scope,
    installed_at: new Date().toISOString(),
    skills: installedSkills,
  };
}

export async function listRuntimeFiles(skillDir: string): Promise<string[]> {
  const files = ["SKILL.md"];
  for (const dirname of ["references", "scripts", "evals", "contracts"]) {
    const root = join(skillDir, dirname);
    if (!existsSync(root)) {
      continue;
    }
    files.push(...(await listFiles(root, dirname)));
  }
  return files;
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  hash.update(await readFile(path));
  return hash.digest("hex");
}

async function listFiles(root: string, prefix: string): Promise<string[]> {
  const dirents = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const dirent of dirents) {
    const rel = join(prefix, dirent.name);
    const abs = join(root, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await listFiles(abs, rel)));
    } else if (dirent.isFile()) {
      files.push(rel);
    }
  }
  return files.sort();
}

export async function isExecutable(path: string): Promise<boolean> {
  const info = await stat(path);
  return (info.mode & 0o111) !== 0;
}
