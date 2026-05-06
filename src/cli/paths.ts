import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

/** ~/.claude/ — Claude Code config home. Override with CLAUDE_HOME when needed. */
export function claudeHome(): string {
  return process.env.CLAUDE_HOME || join(homedir(), ".claude");
}

/** ~/.claude/skills/ — where Claude Code loads user-level skills from. */
export function claudeSkillsDir(): string {
  return join(claudeHome(), "skills");
}

/** .claude/ — project-scoped Claude Code config home. */
export function projectClaudeHome(projectRoot = process.cwd()): string {
  return join(projectRoot, ".claude");
}

/** .claude/skills/ — project-scoped skills directory. */
export function projectSkillsDir(projectRoot = process.cwd()): string {
  return join(projectClaudeHome(projectRoot), "skills");
}

/** .omv/ — project-scoped oh-my-vul state directory. */
export function omvStateDir(projectRoot = process.cwd()): string {
  return join(projectRoot, ".omv");
}

/** .omv/findings/ — project-scoped Evidence.v1 finding ledger. */
export function findingsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "findings");
}

/** .omv/archive/ — project-scoped inactive research state. */
export function archiveDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "archive");
}

/** .omv/archive/findings/ — archived Evidence.v1 findings. */
export function archivedFindingsDir(projectRoot = process.cwd()): string {
  return join(archiveDir(projectRoot), "findings");
}

/** .omv/archive/metadata/ — durable archive metadata sidecars. */
export function archiveMetadataDir(projectRoot = process.cwd()): string {
  return join(archiveDir(projectRoot), "metadata");
}

/** .omv/archive/metadata/<id>.json — durable archive metadata for one finding. */
export function archiveMetadataPath(id: string, projectRoot = process.cwd()): string {
  return join(archiveMetadataDir(projectRoot), `${id}.json`);
}

/** .omv/index.json — rebuildable workspace index cache. */
export function workspaceIndexPath(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "index.json");
}

/** .omv/activity.jsonl — append-only local activity log. */
export function workspaceActivityLogPath(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "activity.jsonl");
}

/** .omv/reports/ — project-scoped report artifacts. */
export function reportsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "reports");
}

/** .omv/reports/<id>/ — report artifacts for one finding. */
export function findingReportsDir(id: string, projectRoot = process.cwd()): string {
  return join(reportsDir(projectRoot), id);
}

/** .omv/repro/ — project-scoped local reproduction artifacts. */
export function reproDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "repro");
}

/** .omv/repro/<id>/ — local reproduction artifacts for one finding. */
export function findingReproDir(id: string, projectRoot = process.cwd()): string {
  return join(reproDir(projectRoot), id);
}

/** .omv/setup-scope.json — persisted setup scope for doctor. */
export function setupScopePath(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "setup-scope.json");
}

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
