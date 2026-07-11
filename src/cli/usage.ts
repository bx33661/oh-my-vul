interface CommandHelpEntry {
  command: string;
  description: string;
}

export const CORE_PUBLIC_COMMANDS: readonly CommandHelpEntry[] = [
  { command: "omv", description: "Open the interactive research workspace" },
  { command: "omv start [flags]", description: "Initialize guided research" },
  { command: "omv dashboard [--json]", description: "Show status, queue, and next action" },
  { command: "omv review <id> [--strict] [--json]", description: "Check report readiness" },
  { command: "omv setup [flags]", description: "Install Skills for Codex or Claude Code" },
  { command: "omv uninstall [flags]", description: "Remove installed Skills without deleting research data" },
  { command: "omv doctor [flags]", description: "Check installation health" },
  { command: "omv version [--json]", description: "Show package and registry versions" },
  { command: "omv help <topic>", description: "Show focused command help" },
];

export const ADVANCED_PUBLIC_COMMANDS: readonly CommandHelpEntry[] = [
  { command: "omv campaign list|init|show", description: "Inspect or automate campaigns" },
  { command: "omv findings list|show|init", description: "Inspect or create Evidence.v1 findings" },
  { command: "omv findings validate|promote", description: "Validate and transition findings" },
  { command: "omv findings archive|restore", description: "Manage the reversible finding lifecycle" },
  { command: "omv workspace status|log", description: "Inspect local workspace state" },
  { command: "omv radar refresh|brief", description: "Manage passive watchlist intelligence" },
  { command: "omv dedup <id>", description: "Plan or record duplicate checks" },
  { command: "omv disclose timeline <id>", description: "Calculate disclosure milestones" },
  { command: "omv submissions record|track|close", description: "Track submission metadata" },
  { command: "omv config get|set|unset|list", description: "Manage persistent CLI configuration" },
];

export const SKILL_MANAGED_COMMANDS = [
  "campaign surfaces", "campaign seed", "eval", "request", "repro", "sources",
  "report", "threat-map", "verification",
] as const;

export const PUBLIC_JSON_COMMANDS = [
  "start", "dashboard", "review", "setup", "uninstall", "doctor", "version",
  "campaign list", "campaign init", "campaign show",
  "findings list", "findings show", "findings init", "findings validate", "findings validate <id>",
  "findings promote", "findings archive", "findings archive list", "findings restore",
  "workspace status", "workspace log", "radar refresh", "radar brief", "dedup",
  "disclose timeline", "submissions record", "submissions track", "submissions close",
] as const;

export function usage(): void {
  console.log(`oh-my-vul - evidence-first vulnerability research for Codex and Claude Code

${renderCommandGroup("Workflow", CORE_PUBLIC_COMMANDS)}

Run 'omv help <topic>' for focused help or 'omv help --all' for all public commands.`);
}

export function fullUsage(): void {
  console.log(`oh-my-vul - public 1.0 command reference

${renderCommandGroup("Core Workflow", CORE_PUBLIC_COMMANDS)}

${renderCommandGroup("Advanced Automation", ADVANCED_PUBLIC_COMMANDS)}

Skill-managed primitives are intentionally omitted from the public compatibility surface.
Their owning Skills invoke them deterministically; direct topic help remains available for troubleshooting.`);
}

function renderCommandGroup(title: string, entries: readonly CommandHelpEntry[]): string {
  const width = Math.max(...entries.map((entry) => entry.command.length));
  return `${title}\n${entries.map((entry) => `  ${entry.command.padEnd(width)}  ${entry.description}`).join("\n")}`;
}

export function commandUsage(topic: string | undefined, subcommand: string | undefined): void {
  switch (topic) {
    case "--all":
      fullUsage();
      return;
    case "setup":
      console.log(`Usage: omv setup [--scope user|project] [--platform codex|claude-code] [--force] [--dry-run] [--json]

Install all registry-marked skills and write a platform-specific install manifest.
Completed installs are verified automatically and print the exact next action.
Codex: ~/.agents/skills or ./.agents/skills
Claude Code: ~/.claude/skills or ./.claude/skills
Default platform: claude-code (backward compatible).`);
      return;
    case "start":
      console.log(`Usage: omv start --vuln <comma-list> [options]

Initialize a private workspace, detect local project metadata, and create the first campaign.
Options: --id, --target, --version, --source, --ecosystem, --mode, --goal,
--budget, --local-lab, --force, --no-interactive, --json.`);
      return;
    case "uninstall":
      console.log(`Usage: omv uninstall [--scope user|project] [--platform codex|claude-code] [--json]

Remove installed skills, install manifest, and setup-scope.json (project scope only).
User data under .omv/ (findings, reports, repro, notes, submissions) is preserved.`);
      return;
    case "doctor":
      console.log(`Usage: omv doctor [--scope user|project] [--platform codex|claude-code] [--json] [--strict]

Check installed skills, runtime assets, references, scripts, and install manifest.
--strict exits non-zero when warnings are present.`);
      return;
    case "version":
      console.log(`Usage: omv version [--json]

Show package version, registry version, platform, and registry update date.`);
      return;
    case "dashboard":
      console.log(`Usage: omv dashboard [--json]

Show local workspace status, active workflow queue, and recent activity in one view.`);
      return;
    case "tui":
      console.log(`Usage: omv tui

Open the interactive Ink workspace. Requires interactive stdin and stdout.
Use omv dashboard for deterministic plain output.`);
      return;
    case "eval":
      skillManagedNotice("eval");
      evalUsage();
      return;
    case "review":
      console.log(`Usage: omv review <id> [--strict] [--json]

Review Evidence.v1 plus available ThreatMap.v1 and Verification.v1 sidecars and
return one verdict: ready, needs-repro, needs-audit, needs-verification, or
blocked. With --strict, readiness requires a passing, non-stale Verification.v1
sidecar.`);
      return;
    case "campaign":
      campaignUsage(subcommand);
      return;
    case "workspace":
      workspaceUsage(subcommand);
      return;
    case "findings":
      findingsUsage(subcommand);
      return;
    case "radar":
      radarUsage(subcommand);
      return;
    case "request":
      skillManagedNotice("request");
      requestUsage(subcommand);
      return;
    case "dedup":
      console.log("Usage: omv dedup <id> [--confirm] [--existing-cve CVE|none] [--notes text] [--json]");
      return;
    case "disclose":
      console.log("Usage: omv disclose timeline <id> [--days N] [--json]");
      return;
    case "submissions":
      submissionsUsage(subcommand);
      return;
    case "config":
      configUsage(subcommand);
      return;
    case "repro":
      skillManagedNotice("repro");
      reproUsage(subcommand);
      return;
    case "report":
      skillManagedNotice("report");
      reportUsage(subcommand);
      return;
    case "sources":
      skillManagedNotice("sources");
      sourcesUsage(subcommand);
      return;
    case "threat-map":
      skillManagedNotice("threat-map");
      threatMapUsage(subcommand);
      return;
    case "verification":
      skillManagedNotice("verification");
      verificationUsage(subcommand);
      return;
    default:
      usage();
      return;
  }
}

const PUBLIC_TOP_LEVEL_COMMANDS = [
  "start", "setup", "uninstall", "config", "doctor", "dashboard", "tui", "campaign",
  "review", "workspace", "findings", "radar", "dedup", "disclose", "submissions", "version", "help",
] as const;

const PRODUCT_ALIASES: Record<string, string[]> = {
  find: ["/omv-find", "omv findings"],
  audit: ["/omv-audit <id>", "omv review <id>"],
  first: ["omv start", "omv campaign init"],
  next: ["omv dashboard"],
  status: ["omv dashboard", "omv workspace status"],
};

export function commandSuggestions(input: string): string[] {
  const direct = PRODUCT_ALIASES[input.toLowerCase()];
  if (direct) return direct;
  return PUBLIC_TOP_LEVEL_COMMANDS
    .map((candidate) => ({ candidate, distance: editDistance(input.toLowerCase(), candidate) }))
    .filter(({ candidate, distance }) => distance <= Math.max(2, Math.floor(candidate.length / 3)))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate))
    .slice(0, 3)
    .map(({ candidate }) => `omv ${candidate}`);
}

function skillManagedNotice(topic: string): void {
  console.log(`Skill-managed primitive: ${topic}. Not part of the public 1.0 command surface.\n`);
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const current = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
      previous = current;
    }
  }
  return row[right.length];
}

export function evalUsage(): void {
  console.log(`Usage:
  omv eval [--json | --junit]
  omv eval --skill <name> --eval-id <id> --output <path> [--json | --junit]

Runs checked-in stable golden cases by default. Targeted mode reuses the selected
skill's existing check_output.py. The command performs no model or network calls.`);
}

export function campaignUsage(subcommand: string | undefined): void {
  const root = "omv campaign";
  switch (subcommand) {
    case "init":
      console.log(`Usage: ${root} init --target <name> --vuln <comma-list> [options]

Options: --id, --version, --source, --ecosystem, --mode, --goal, --budget,
--local-lab, --force, --no-interactive, --json.`);
      return;
    case "list":
      console.log(`Usage: ${root} list [--json]`);
      return;
    case "show":
      console.log(`Usage: ${root} show <id> [--json]`);
      return;
    case "seed":
      skillManagedNotice("campaign seed");
      console.log(`Usage: ${root} seed <id> [--json]

Creates candidate Evidence.v1 files only. A supported target ecosystem is required;
existing .yaml and .yml findings are never overwritten.

If <id>.surfaces.yaml exists, only selected attack-surface cards are seeded.
Otherwise generic vulnerability-class lanes are used.`);
      return;
    case "surfaces":
      skillManagedNotice("campaign surfaces");
      console.log(`Usage:
  omv campaign surfaces propose <id> [--force] [--json]
  omv campaign surfaces show <id> [--json]
  omv campaign surfaces select <id> --cards <id,id> [--json]

Propose deterministic attack-surface cards from the shared pack catalog, select
which hypotheses to pursue, then seed candidate Evidence.v1 findings.`);
      return;
    default:
      console.log(`Usage:
  omv campaign [list] [--json]
  ${root} init --target <name> --vuln <comma-list> [options]
  ${root} list [--json]
  ${root} show <id> [--json]`);
      return;
  }
}

export function workspaceUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "status":
      console.log("Usage: omv workspace status [--json]");
      return;
    case "log":
      console.log("Usage: omv workspace log [--json]");
      return;
    default:
      console.log(`Usage:
  omv workspace status [--json]
  omv workspace log [--json]`);
      return;
  }
}

export function radarUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "refresh":
      console.log("Usage: omv radar refresh [--dry-run] [--json]");
      return;
    case "brief":
      console.log("Usage: omv radar brief [--json]");
      return;
    default:
      console.log(`Usage:
  omv radar refresh [--dry-run] [--json]
  omv radar brief [--json]`);
      return;
  }
}

export function requestUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "preflight":
      console.log("Usage: omv request preflight [--refresh] [--json]");
      return;
    case "fetch":
      console.log("Usage: omv request fetch <url> [--accept mime] [--refresh] [--json]");
      return;
    default:
      console.log(`Usage:
  omv request preflight [--refresh] [--json]
  omv request fetch <url> [--accept mime] [--refresh] [--json]`);
      return;
  }
}

export function submissionsUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "record":
      console.log("Usage: omv submissions record <id> --platform <name> --submission-id <id> --url <url> [--json]");
      return;
    case "track":
      console.log("Usage: omv submissions track <id> [--json]");
      return;
    case "close":
      console.log("Usage: omv submissions close <id> --cve CVE-YYYY-NNNN [--json]");
      return;
    default:
      console.log(`Usage:
  omv submissions record <id> --platform <name> --submission-id <id> --url <url> [--json]
  omv submissions track <id> [--json]
  omv submissions close <id> --cve CVE-YYYY-NNNN [--json]`);
      return;
  }
}

export function configUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "get":
      console.log("Usage: omv config get <key>");
      return;
    case "set":
      console.log("Usage: omv config set <key> <value>");
      return;
    case "unset":
      console.log("Usage: omv config unset <key>");
      return;
    case "list":
      console.log("Usage: omv config list");
      return;
    default:
      console.log(`Usage:
  omv config get <key>
  omv config set <key> <value>
  omv config unset <key>
  omv config list`);
      return;
  }
}

export function findingsUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "list":
      console.log("Usage: omv findings list [--json]");
      return;
    case "show":
      console.log("Usage: omv findings show <id> [--archived] [--json]");
      return;
    case "init":
      console.log("Usage: omv findings init <id> [--status candidate|confirmed|blocked] [--force] [--json]");
      return;
    case "validate":
      console.log(`Usage: omv findings validate [id|path] [--json] [--strict]

Validate Evidence.v1 files. --strict treats warnings as failures.`);
      return;
    case "promote":
      console.log("Usage: omv findings promote <id|path> --status candidate|confirmed|blocked [--json]");
      return;
    case "archive":
      console.log(`Usage:
  omv findings archive <id> --reason <reason> [--force] [--strict] [--json]
  omv findings archive list [--json]`);
      return;
    case "restore":
      console.log("Usage: omv findings restore <id> [--force] [--json]");
      return;
    default:
      console.log(`Usage:
  omv findings list [--json]
  omv findings show <id> [--archived] [--json]
  omv findings init <id> [--status candidate|confirmed|blocked] [--force] [--json]
  omv findings validate [id|path] [--json] [--strict]
  omv findings promote <id|path> --status candidate|confirmed|blocked [--json]
  omv findings archive <id> --reason <reason> [--force] [--strict] [--json]
  omv findings archive list [--json]
  omv findings restore <id> [--force] [--json]`);
      return;
  }
}

export function reproUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log(`Usage: omv repro init <id> [--force] [--json]

Scaffold .omv/repro/<id>/ (README, commands.sh, observed.txt, docker-compose.yml,
screenshots/) and merge the artifact list into evidence.repro_artifacts.
--force overwrites non-empty artifact files.`);
      return;
    default:
      console.log(`Usage:
  omv repro init <id> [--force] [--json]`);
      return;
  }
}

export function reportUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "artifacts":
      console.log(`Usage: omv report artifacts <id> [--json]

Inspect declared report artifacts under .omv/reports/<id>/ and .omv/repro/<id>/,
listing empty and missing artifacts. Exits non-zero on errors.`);
      return;
    case "provenance":
      console.log(`Usage: omv report provenance <id> [--force] [--json]

Hash Evidence.v1, report files, and available local sidecar/reproduction inputs
into .omv/reports/<id>/provenance.json. No remote source is fetched.`);
      return;
    default:
      console.log(`Usage:
  omv report artifacts <id> [--json]
  omv report provenance <id> [--force] [--json]`);
      return;
  }
}

export function sourcesUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log(`Usage: omv sources init <id> [--force] [--json]

Create .omv/sources/<id>.yaml from source facts already recorded in Evidence.v1.
This records local provenance and does not prove remote source authenticity.`);
      return;
    case "show":
    case "validate":
      console.log(`Usage: omv sources ${subcommand} <id> [--json]`);
      return;
    default:
      console.log(`Usage:
  omv sources init <id> [--force] [--json]
  omv sources show <id> [--json]
  omv sources validate <id> [--json]`);
  }
}

export function threatMapUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log(`Usage: omv threat-map init <id> [--force] [--json]

Scaffold .omv/threatmaps/<id>.yaml as a ThreatMap.v1 sidecar (finding_id and
package block filled from .omv/findings/<id>.yaml, paths: [] awaiting one entry
per source -> sink route). The sidecar is optional and does not modify the
parent Evidence.v1 file. --force overwrites a non-empty threat map.`);
      return;
    case "validate":
      console.log(`Usage: omv threat-map validate <id> [--json]

Validate .omv/threatmaps/<id>.yaml as a ThreatMap.v1 evidence graph and warn
when graph locations appear inconsistent with Evidence.v1 source/sink/guard
summary fields.`);
      return;
    default:
      console.log(`Usage:
  omv threat-map init <id> [--force] [--json]
  omv threat-map validate <id> [--json]`);
      return;
  }
}

export function verificationUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log(`Usage: omv verification init <id> [--force] [--json]

Scaffold .omv/verifications/<id>.yaml as a Verification.v1 sidecar linked to
the current Evidence.v1 file hash.`);
      return;
    case "show":
      console.log("Usage: omv verification show <id> [--json]");
      return;
    case "validate":
      console.log(`Usage: omv verification validate <id> [--json]

Validate Verification.v1 structure and warn when the reviewed Evidence.v1 hash
is stale.`);
      return;
    default:
      console.log(`Usage:
  omv verification init <id> [--force] [--json]
  omv verification show <id> [--json]
  omv verification validate <id> [--json]`);
      return;
  }
}
