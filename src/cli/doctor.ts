import { existsSync } from "fs";
import { readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { codexSkillsDir, codexHome, packageSkillsDir } from "./paths.js";

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

  // Codex home exists
  const home = codexHome();
  checks.push({
    name: "codex home",
    passed: existsSync(home),
    message: existsSync(home) ? home : `not found: ${home}`,
  });

  // Skills directory exists
  const skillsDir = codexSkillsDir();
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

  // Each package skill is installed with all bundled runtime assets.
  if (pkgExists && skillsDirExists) {
    let entries: { name: string; files: string[] }[] = [];
    try {
      const dirents = await readdir(pkgSkills, { withFileTypes: true });
      entries = dirents
        .filter((e) => e.isDirectory() && existsSync(join(pkgSkills, e.name, "SKILL.md")))
        .map((e) => e.name)
        .map((name) => ({ name, files: [] }));
    } catch {
      // ignore
    }

    for (const entry of entries) {
      const installedSkillDir = join(skillsDir, entry.name);
      entry.files = await listRuntimeFiles(join(pkgSkills, entry.name));
      const missing = entry.files.filter((file) => !existsSync(join(installedSkillDir, file)));
      const referenceErrors = missing.length === 0 ? await validateInstalledReferences(installedSkillDir) : [];
      const scriptErrors = missing.length === 0 ? await validateExecutableScripts(installedSkillDir, entry.files) : [];
      const problems = [...missing.map((file) => `missing ${file}`), ...referenceErrors, ...scriptErrors];
      checks.push({
        name: `skill: ${entry.name}`,
        passed: problems.length === 0,
        message:
          problems.length === 0
            ? "installed"
            : `${problems.slice(0, 3).join(", ")}${problems.length > 3 ? ", ..." : ""} (run: omv setup --force)`,
      });
    }
  }

  return {
    ok: checks.every((c) => c.passed),
    checks,
  };
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
    const info = await stat(join(skillDir, file));
    if ((info.mode & 0o111) === 0) {
      errors.push(`not executable ${file}`);
    }
  }
  return errors;
}

async function listRuntimeFiles(skillDir: string): Promise<string[]> {
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
  return files;
}
