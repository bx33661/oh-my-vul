import { mkdir, cp, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { codexSkillsDir, packageSkillsDir } from "./paths.js";

export interface SetupOptions {
  force?: boolean;
  dryRun?: boolean;
}

export interface SetupResult {
  installed: string[];
  skipped: string[];
  errors: string[];
}

export async function setup(options: SetupOptions = {}): Promise<SetupResult> {
  const { force = false, dryRun = false } = options;
  const result: SetupResult = { installed: [], skipped: [], errors: [] };

  const srcDir = packageSkillsDir();
  const destDir = codexSkillsDir();

  if (!existsSync(srcDir)) {
    result.errors.push(`skills directory not found: ${srcDir}`);
    return result;
  }

  const entries = await readdir(srcDir, { withFileTypes: true });
  const skillDirs = entries
    .filter((e) => e.isDirectory() && existsSync(join(srcDir, e.name, "SKILL.md")))
    .map((e) => e.name);

  if (skillDirs.length === 0) {
    result.errors.push("no skills found in package");
    return result;
  }

  if (!dryRun) {
    await mkdir(destDir, { recursive: true });
  }

  for (const name of skillDirs) {
    const src = join(srcDir, name);
    const dest = join(destDir, name);

    if (existsSync(dest) && !force) {
      result.skipped.push(name);
      continue;
    }

    if (!dryRun) {
      try {
        await cp(src, dest, { recursive: true, force: true });
        result.installed.push(name);
      } catch (err) {
        result.errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      result.installed.push(name);
    }
  }

  return result;
}
