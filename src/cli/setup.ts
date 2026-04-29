import { mkdir, cp, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { codexSkillsDir, omvStateDir, packageRoot, projectSkillsDir, setupScopePath } from "./paths.js";
import { getInstallableSkills, readCatalog } from "./catalog.js";

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

export async function setup(options: SetupOptions = {}): Promise<SetupResult> {
  const { force = false, dryRun = false, scope = "user", projectRoot = process.cwd() } = options;
  const destDir = scope === "project" ? projectSkillsDir(projectRoot) : codexSkillsDir();
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

  return result;
}
