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

/** .omv/campaigns/ — project-scoped Campaign.v1 artifacts. */
export function campaignsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "campaigns");
}

/** .omv/campaigns/<id>.yaml — Campaign.v1 source of truth. */
export function campaignPath(id: string, projectRoot = process.cwd()): string {
  return join(campaignsDir(projectRoot), `${id}.yaml`);
}

/** .omv/campaigns/<id>.md — deterministic Campaign.v1 runbook. */
export function campaignRunbookPath(id: string, projectRoot = process.cwd()): string {
  return join(campaignsDir(projectRoot), `${id}.md`);
}

/** .omv/sources/ — optional SourceRef.v1 sidecars keyed by finding id. */
export function sourcesDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "sources");
}

/** .omv/sources/<id>.yaml — SourceRef.v1 sidecar for one finding. */
export function sourceRefPath(id: string, projectRoot = process.cwd()): string {
  return join(sourcesDir(projectRoot), `${id}.yaml`);
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

/** .omv/reports/<id>/provenance.json — generated report input hashes. */
export function reportProvenancePath(id: string, projectRoot = process.cwd()): string {
  return join(findingReportsDir(id, projectRoot), "provenance.json");
}

/** .omv/repro/ — project-scoped local reproduction artifacts. */
export function reproDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "repro");
}

/** .omv/repro/<id>/ — local reproduction artifacts for one finding. */
export function findingReproDir(id: string, projectRoot = process.cwd()): string {
  return join(reproDir(projectRoot), id);
}

/** .omv/threatmaps/ — optional ThreatMap.v1 sidecars keyed by finding id. */
export function threatMapsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "threatmaps");
}

/** .omv/threatmaps/<id>.yaml — optional ThreatMap.v1 sidecar for one finding. */
export function threatMapPath(id: string, projectRoot = process.cwd()): string {
  return join(threatMapsDir(projectRoot), `${id}.yaml`);
}

/** .omv/verifications/ — optional Verification.v1 sidecars keyed by finding id. */
export function verificationsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "verifications");
}

/** .omv/verifications/<id>.yaml — adversarial Verification.v1 sidecar for one finding. */
export function verificationPath(id: string, projectRoot = process.cwd()): string {
  return join(verificationsDir(projectRoot), `${id}.yaml`);
}

/** .omv/radar/ — local passive intelligence state. */
export function radarDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "radar");
}

/** .omv/radar/watchlist.yaml — user-maintained passive intelligence watchlist. */
export function radarWatchlistPath(projectRoot = process.cwd()): string {
  return join(radarDir(projectRoot), "watchlist.yaml");
}

/** .omv/radar/events.jsonl — append-only normalized radar event stream. */
export function radarEventsPath(projectRoot = process.cwd()): string {
  return join(radarDir(projectRoot), "events.jsonl");
}

/** .omv/cache/http/ — local HTTP request cache for passive metadata fetches. */
export function httpCacheDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "cache", "http");
}

/** .omv/submissions/ — local submission tracking state. */
export function submissionsDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "submissions");
}

/** .omv/submissions/<id>.yaml — submission tracking state for one finding. */
export function submissionPath(id: string, projectRoot = process.cwd()): string {
  return join(submissionsDir(projectRoot), `${id}.yaml`);
}

/** .omv/notes/ — local research notebooks. */
export function notesDir(projectRoot = process.cwd()): string {
  return join(omvStateDir(projectRoot), "notes");
}

/** .omv/notes/<id>.md — append-only research notebook for one finding. */
export function notePath(id: string, projectRoot = process.cwd()): string {
  return join(notesDir(projectRoot), `${id}.md`);
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

/** agents/ directory inside the package */
export function packageAgentsDir(): string {
  return join(packageRoot(), "agents");
}

/** ~/.claude/agents/ — where Claude Code loads user-level subagents from */
export function claudeAgentsDir(): string {
  return join(claudeHome(), "agents");
}

/** .claude/agents/ — project-scoped subagent directory */
export function projectAgentsDir(projectRoot = process.cwd()): string {
  return join(projectClaudeHome(projectRoot), "agents");
}
