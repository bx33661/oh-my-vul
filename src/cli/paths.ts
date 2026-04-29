import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

/** ~/.codex/ — Codex config home. Override with CODEX_HOME when needed. */
export function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), ".codex");
}

/** ~/.codex/skills/ — where Codex loads user-level skills from. */
export function codexSkillsDir(): string {
  return join(codexHome(), "skills");
}

/** .codex/ — project-scoped Codex config home. */
export function projectCodexHome(projectRoot = process.cwd()): string {
  return join(projectRoot, ".codex");
}

/** .codex/skills/ — project-scoped skills directory. */
export function projectSkillsDir(projectRoot = process.cwd()): string {
  return join(projectCodexHome(projectRoot), "skills");
}

/** .omv/ — project-scoped oh-my-vul state directory. */
export function omvStateDir(projectRoot = process.cwd()): string {
  return join(projectRoot, ".omv");
}

/** .omv/findings/ — project-scoped Evidence.v1 finding ledger. */
export function findingsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "findings");
}

/** .omv/setup-scope.json — persisted setup scope for doctor. */
export function setupScopePath(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "setup-scope.json");
}

/** @deprecated Use codexSkillsDir(). */
export const claudeSkillsDir = codexSkillsDir;

/** @deprecated Use codexHome(). */
export const claudeHome = codexHome;

/** Root of the oh-my-vul package (where skills/, agents/, contracts/ live) */
export function packageRoot(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    // dist/cli/paths.js -> dist/cli -> dist -> package root
    const candidate = join(__dirname, "..", "..");
    if (existsSync(join(candidate, "package.json"))) {
      return candidate;
    }
  } catch {
    // fall through
  }
  return process.cwd();
}

/** skills/ directory inside the package */
export function packageSkillsDir(): string {
  return join(packageRoot(), "skills");
}
