import { existsSync } from "fs";
import { readdir } from "fs/promises";
import { join } from "path";
import { claudeSkillsDir, claudeHome, packageSkillsDir } from "./paths.js";

export interface DoctorResult {
  ok: boolean;
  checks: Check[];
}

interface Check {
  name: string;
  passed: boolean;
  message: string;
}

export async function doctor(): Promise<DoctorResult> {
  const checks: Check[] = [];

  // Claude home exists
  const home = claudeHome();
  checks.push({
    name: "claude home",
    passed: existsSync(home),
    message: existsSync(home) ? home : `not found: ${home}`,
  });

  // Skills directory exists
  const skillsDir = claudeSkillsDir();
  const skillsDirExists = existsSync(skillsDir);
  checks.push({
    name: "skills directory",
    passed: skillsDirExists,
    message: skillsDirExists ? skillsDir : `not found: ${skillsDir} (run: omv setup)`,
  });

  // Package skills are present
  const pkgSkills = packageSkillsDir();
  const pkgExists = existsSync(pkgSkills);
  checks.push({
    name: "package skills",
    passed: pkgExists,
    message: pkgExists ? pkgSkills : `not found: ${pkgSkills}`,
  });

  // Each package skill is installed
  if (pkgExists && skillsDirExists) {
    let entries: string[] = [];
    try {
      const dirents = await readdir(pkgSkills, { withFileTypes: true });
      entries = dirents
        .filter((e) => e.isDirectory() && existsSync(join(pkgSkills, e.name, "SKILL.md")))
        .map((e) => e.name);
    } catch {
      // ignore
    }

    for (const name of entries) {
      const installed = existsSync(join(skillsDir, name, "SKILL.md"));
      checks.push({
        name: `skill: ${name}`,
        passed: installed,
        message: installed ? "installed" : `not installed (run: omv setup)`,
      });
    }
  }

  return {
    ok: checks.every((c) => c.passed),
    checks,
  };
}
