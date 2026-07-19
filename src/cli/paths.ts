import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join, parse, resolve, sep } from "path";
import { fileURLToPath } from "url";

/**
 * Resolve the research project root that owns `.omv/` state.
 *
 * Priority:
 * 1. `OMV_PROJECT_ROOT` or `OMV_ROOT` (explicit override)
 * 2. If `startDir` lies inside a `/.omv/` state tree (e.g. `.omv/checkouts/<pkg>`),
 *    use the directory that owns that `.omv` (avoids nested workspaces under checkouts)
 * 3. Nearest ancestor of `startDir` that already contains a `.omv` directory
 * 4. `startDir` itself (usually `process.cwd()`)
 */
export function resolveProjectRoot(startDir: string = process.cwd()): string {
  const envRoot = (process.env.OMV_PROJECT_ROOT || process.env.OMV_ROOT || "").trim();
  if (envRoot) {
    return resolve(envRoot);
  }

  const start = resolve(startDir);
  const insideState = projectRootIfInsideOmvState(start);
  if (insideState) {
    return insideState;
  }

  let dir = start;
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, ".omv"))) {
      return dir;
    }
    if (dir === root) {
      break;
    }
    dir = dirname(dir);
  }
  return start;
}

/**
 * When cwd is under `<project>/.omv/...` (checkouts, findings, etc.), return `<project>`.
 * Returns undefined when the path is not inside an `.omv` state tree.
 */
export function projectRootIfInsideOmvState(absPath: string): string | undefined {
  const normalized = resolve(absPath);
  const parts = normalized.split(sep);
  const idx = parts.indexOf(".omv");
  if (idx <= 0) {
    return undefined;
  }
  // On POSIX, parts[0] is "" for absolute paths; join via sep.
  const owner = parts.slice(0, idx).join(sep);
  return owner === "" ? sep : owner;
}

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

/** ~/.codex/ - Codex config home. Override with CODEX_HOME when needed. */
export function codexHome(): string {
  return process.env.CODEX_HOME || join(homedir(), ".codex");
}

/** ~/.agents/skills/ - where Codex loads user-level skills from. */
export function codexSkillsDir(): string {
  return join(homedir(), ".agents", "skills");
}

/** .agents/skills/ - project-scoped Codex skills directory. */
export function projectCodexSkillsDir(projectRoot = process.cwd()): string {
  return join(projectRoot, ".agents", "skills");
}

/** .omv/ — project-scoped oh-my-vul state directory. */
export function omvStateDir(projectRoot = resolveProjectRoot()): string {
  return join(projectRoot, ".omv");
}

/** .omv/campaigns/ — project-scoped Campaign.v1 artifacts. */
export function campaignsDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "campaigns");
}

/** .omv/campaigns/<id>.yaml — Campaign.v1 source of truth. */
export function campaignPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(campaignsDir(projectRoot), `${id}.yaml`);
}

/** .omv/campaigns/<id>.md — deterministic Campaign.v1 runbook. */
export function campaignRunbookPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(campaignsDir(projectRoot), `${id}.md`);
}

/** .omv/campaigns/<id>.surfaces.yaml — AttackSurfaceList.v1 sidecar. */
export function campaignSurfacesPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(campaignsDir(projectRoot), `${id}.surfaces.yaml`);
}

/** .omv/sources/ — optional SourceRef.v1 sidecars keyed by finding id. */
export function sourcesDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "sources");
}

/** .omv/sources/<id>.yaml — SourceRef.v1 sidecar for one finding. */
export function sourceRefPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(sourcesDir(projectRoot), `${id}.yaml`);
}

/** .omv/findings/ — project-scoped Evidence.v1 finding ledger. */
export function findingsDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "findings");
}

/** .omv/archive/ — project-scoped inactive research state. */
export function archiveDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "archive");
}

/** .omv/archive/findings/ — archived Evidence.v1 findings. */
export function archivedFindingsDir(projectRoot = resolveProjectRoot()): string {
  return join(archiveDir(projectRoot), "findings");
}

/** .omv/archive/metadata/ — durable archive metadata sidecars. */
export function archiveMetadataDir(projectRoot = resolveProjectRoot()): string {
  return join(archiveDir(projectRoot), "metadata");
}

/** .omv/archive/metadata/<id>.json — durable archive metadata for one finding. */
export function archiveMetadataPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(archiveMetadataDir(projectRoot), `${id}.json`);
}

/** .omv/index.json — rebuildable workspace index cache. */
export function workspaceIndexPath(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "index.json");
}

/** .omv/activity.jsonl — append-only local activity log. */
export function workspaceActivityLogPath(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "activity.jsonl");
}

/** .omv/reports/ — project-scoped report artifacts. */
export function reportsDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "reports");
}

/** .omv/reports/<id>/ — report artifacts for one finding. */
export function findingReportsDir(id: string, projectRoot = resolveProjectRoot()): string {
  return join(reportsDir(projectRoot), id);
}

/** .omv/reports/<id>/provenance.json — generated report input hashes. */
export function reportProvenancePath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(findingReportsDir(id, projectRoot), "provenance.json");
}

/** .omv/repro/ — project-scoped local reproduction artifacts. */
export function reproDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "repro");
}

/** .omv/repro/<id>/ — local reproduction artifacts for one finding. */
export function findingReproDir(id: string, projectRoot = resolveProjectRoot()): string {
  return join(reproDir(projectRoot), id);
}

/** .omv/threatmaps/ — optional ThreatMap.v1 sidecars keyed by finding id. */
export function threatMapsDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "threatmaps");
}

/** .omv/threatmaps/<id>.yaml — optional ThreatMap.v1 sidecar for one finding. */
export function threatMapPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(threatMapsDir(projectRoot), `${id}.yaml`);
}

/** .omv/verifications/ — optional Verification.v1 sidecars keyed by finding id. */
export function verificationsDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "verifications");
}

/** .omv/verifications/<id>.yaml — adversarial Verification.v1 sidecar for one finding. */
export function verificationPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(verificationsDir(projectRoot), `${id}.yaml`);
}

/** .omv/radar/ — local passive intelligence state. */
export function radarDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "radar");
}

/** .omv/radar/watchlist.yaml — user-maintained passive intelligence watchlist. */
export function radarWatchlistPath(projectRoot = resolveProjectRoot()): string {
  return join(radarDir(projectRoot), "watchlist.yaml");
}

/** .omv/radar/events.jsonl — append-only normalized radar event stream. */
export function radarEventsPath(projectRoot = resolveProjectRoot()): string {
  return join(radarDir(projectRoot), "events.jsonl");
}

/** .omv/cache/http/ — local HTTP request cache for passive metadata fetches. */
export function httpCacheDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "cache", "http");
}

/** .omv/submissions/ — local submission tracking state. */
export function submissionsDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "submissions");
}

/** .omv/submissions/<id>.yaml — submission tracking state for one finding. */
export function submissionPath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(submissionsDir(projectRoot), `${id}.yaml`);
}

/** .omv/notes/ — local research notebooks. */
export function notesDir(projectRoot = resolveProjectRoot()): string {
  return join(omvStateDir(projectRoot), "notes");
}

/** .omv/notes/<id>.md — append-only research notebook for one finding. */
export function notePath(id: string, projectRoot = resolveProjectRoot()): string {
  return join(notesDir(projectRoot), `${id}.md`);
}

/** .omv/setup-scope.json — persisted setup scope for doctor. */
export function setupScopePath(projectRoot = resolveProjectRoot()): string {
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
