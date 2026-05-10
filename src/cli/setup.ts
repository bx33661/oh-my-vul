import { mkdir, cp, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { claudeSkillsDir, omvStateDir, packageRoot, projectSkillsDir, setupScopePath } from "./paths.js";
import { getInstallableSkills, readCatalog } from "./catalog.js";
import { buildInstallManifest, installManifestPath, readInstallManifest, writeInstallManifest } from "./install-manifest.js";
import { readConfig } from "./config.js";

export type SetupScope = "user" | "project";

export interface SetupOptions {
  force?: boolean;
  dryRun?: boolean;
  scope?: SetupScope;
  projectRoot?: string;
}

export interface SetupResult {
  scope: SetupScope;
  destination: string;
  installed: string[];
  skipped: string[];
  errors: string[];
}

export interface UninstallOptions {
  scope?: SetupScope;
  projectRoot?: string;
  json?: boolean;
}

export interface UninstallResult {
  scope: SetupScope;
  skillsDir: string;
  removed: string[];
  notFound: string[];
  errors: string[];
  manifestRemoved: boolean;
  setupScopeRemoved: boolean;
}

export async function uninstall(options: UninstallOptions = {}): Promise<UninstallResult> {
  const { scope = "user", projectRoot = process.cwd() } = options;
  const skillsDir = scope === "project" ? projectSkillsDir(projectRoot) : claudeSkillsDir();
  const result: UninstallResult = {
    scope,
    skillsDir,
    removed: [],
    notFound: [],
    errors: [],
    manifestRemoved: false,
    setupScopeRemoved: false,
  };

  const manifest = await readInstallManifest(installManifestPath(scope, projectRoot));
  const skillsToRemove = manifest?.skills.map((s) => s.name) ?? [];

  for (const skill of skillsToRemove) {
    const dest = join(skillsDir, skill);
    if (!existsSync(dest)) {
      result.notFound.push(skill);
      continue;
    }
    try {
      await rm(dest, { recursive: true, force: true });
      result.removed.push(skill);
    } catch (err) {
      result.errors.push(`${skill}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Remove install manifest
  const manifestPath = installManifestPath(scope, projectRoot);
  if (existsSync(manifestPath)) {
    try {
      await rm(manifestPath, { force: true });
      result.manifestRemoved = true;
    } catch (err) {
      result.errors.push(`manifest: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Remove setup-scope.json for project scope
  if (scope === "project") {
    const scopePath = setupScopePath(projectRoot);
    if (existsSync(scopePath)) {
      try {
        await rm(scopePath, { force: true });
        result.setupScopeRemoved = true;
      } catch (err) {
        result.errors.push(`setup-scope: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return result;
}

export async function setup(options: SetupOptions = {}): Promise<SetupResult> {
  const { force = false, dryRun = false, scope = "user", projectRoot = process.cwd() } = options;
  const destDir = scope === "project" ? projectSkillsDir(projectRoot) : claudeSkillsDir();
  const result: SetupResult = { scope, destination: destDir, installed: [], skipped: [], errors: [] };

  const catalog = await readCatalog();
  const skillDirs = getInstallableSkills(catalog);

  if (skillDirs.length === 0) {
    result.errors.push("no installable skills found in registry");
    return result;
  }

  if (!dryRun) {
    await mkdir(destDir, { recursive: true });
    if (scope === "project") {
      await mkdir(omvStateDir(projectRoot), { recursive: true });
      await writeFile(
        setupScopePath(projectRoot),
        JSON.stringify({ scope, installed_at: new Date().toISOString() }, null, 2) + "\n",
        "utf-8",
      );
    }
  }

  for (const skill of skillDirs) {
    const src = join(packageRoot(), skill.path);
    const dest = join(destDir, skill.name);

    if (!existsSync(join(src, "SKILL.md"))) {
      result.errors.push(`${skill.name}: skill directory not found: ${src}`);
      continue;
    }

    if (existsSync(dest) && !force) {
      result.skipped.push(skill.name);
      continue;
    }

    if (!dryRun) {
      try {
        await cp(src, dest, { recursive: true, force: true });
        result.installed.push(skill.name);
      } catch (err) {
        result.errors.push(`${skill.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      result.installed.push(skill.name);
    }
  }

  if (!dryRun && result.errors.length === 0) {
    const manifest = await buildInstallManifest({
      scope,
      skillsDir: destDir,
      skills: skillDirs,
      registryVersion: catalog.version,
      projectRoot,
    });
    await writeInstallManifest(installManifestPath(scope, projectRoot), manifest);
  }

  return result;
}
