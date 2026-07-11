export function usage(): void {
  console.log(`oh-my-vul — evidence-first vulnerability research for Claude Code

Usage: omv <command>

Start
  omv start [flags]                 Initialize a workspace and first campaign
  omv setup                         Install Claude Code skills and agents
  omv doctor                        Check installation health

Continue
  omv dashboard                     Show campaigns, findings, and the next action
  omv campaign                      Inspect research campaigns
  omv findings workflow             Continue the active finding queue

Validate
  omv review <id> --strict          Check report readiness
  omv findings validate [id]        Validate Evidence.v1 files

Maintain
  omv workspace status              Inspect private local state
  omv radar brief                   Summarize passive intelligence

Run 'omv help <command>' for command help or 'omv help --all' for the complete reference.
`);
}

export function fullUsage(): void {
  console.log(`oh-my-vul — vulnerability research skills for Claude Code

Usage:
  omv start --vuln <classes> [flags]
                                     Initialize workspace and first campaign
  omv setup [--scope user|project] [--force] [--dry-run]
                                     Install skills to ~/.claude/skills/ or ./.claude/skills/
  omv uninstall [--scope user|project] [--json]
                                     Remove installed skills and manifest
  omv doctor [--scope user|project] [--json] [--strict]
                                     Check installation health
  omv dashboard [--json]            Show workspace, queue, and recent activity
  omv eval [--json|--junit]         Run stable skill eval checks
  omv eval --skill <name> --eval-id <id> --output <path>
                                     Check one saved skill output
  omv campaign [list] [--json]      List local research campaigns
  omv campaign init [flags]         Create Campaign.v1 YAML and runbook
  omv campaign show <id> [--json]   Show one campaign
  omv campaign surfaces propose <id> [--force] [--json]
                                     Propose attack-surface cards for a campaign
  omv campaign surfaces show <id> [--json]
                                     Show proposed/selected surface cards
  omv campaign surfaces select <id> --cards <id,id> [--json]
                                     Select cards to seed as candidate findings
  omv campaign seed <id> [--json]   Seed candidate Evidence.v1 hypotheses
  omv first [flags]                 Alias for campaign init
  omv review <id> [--strict] [--json]
                                     Review a finding and recommend report readiness
  omv workspace init [--gitignore] [--json]
                                     Initialize local .omv workspace
  omv workspace status [--json]      Show local .omv workspace status
  omv workspace log [--json]         Show local workspace activity log
  omv findings list [--json]        List .omv/findings evidence files
  omv findings workflow [--json]    Show active finding lifecycle next actions
  omv findings doctor <id> [--json] [--strict-verification]
                                     Explain what blocks submission readiness
  omv findings show <id> [--archived] [--json]
                                     Show one finding's details and next action
  omv findings open <id> [--archived] [--json]
                                     Print a finding YAML path for editing
  omv findings init <id> [--status candidate|confirmed|blocked] [--force] [--json]
                                     Create an Evidence.v1 finding template
  omv findings validate [id|path] [--json] [--strict]
                                     Validate one finding or the whole ledger
  omv findings promote <id|path> --status candidate|confirmed|blocked [--json]
                                     Update a finding status and revalidate it
  omv findings archive <id> --reason <reason> [--force] [--strict] [--json]
                                     Move a finding out of the active queue
  omv findings archive list [--json]
                                     List archived findings
  omv findings restore <id> [--force] [--json]
                                     Restore an archived finding
  omv radar refresh [--dry-run] [--json]
                                     Refresh passive watchlist intelligence
  omv radar brief [--json]           Summarize local radar events
  omv repro init <id> [--force] [--json]
                                     Scaffold .omv/repro/<id>/ reproduction artifacts
  omv sources init <id> [--force] [--json]
                                     Capture local SourceRef.v1 source identity
  omv sources show|validate <id> [--json]
                                     Show SourceRef.v1 and Evidence hash freshness
  omv report artifacts <id> [--json]
                                     Inspect report/repro artifacts and readiness
  omv report provenance <id> [--force] [--json]
                                     Hash report inputs into provenance.json
  omv threat-map init <id> [--force] [--json]
                                     Scaffold .omv/threatmaps/<id>.yaml ThreatMap.v1 sidecar
  omv threat-map validate <id> [--json]
                                     Validate a ThreatMap.v1 sidecar
  omv verification init <id> [--force] [--json]
                                     Scaffold .omv/verifications/<id>.yaml Verification.v1 sidecar
  omv verification show <id> [--json]
                                     Show adversarial verification status
  omv verification validate <id> [--json]
                                     Validate Verification.v1 and stale evidence hash
  omv request preflight [--refresh] [--json]
                                     Check metadata source request health
  omv request fetch <url> [--accept mime] [--refresh] [--json]
                                     Fetch one public URL through the request broker
  omv dedup <id> [--confirm] [--existing-cve CVE|none] [--notes text] [--json]
                                     Plan or write Evidence.v1 dedup fields
  omv disclose timeline <id> [--days N] [--json]
                                     Show disclosure timeline milestones
  omv submissions record <id> --platform <name> --submission-id <id> --url <url> [--json]
                                     Record platform submission metadata
  omv submissions track <id> [--json]
                                     Show submission status for one finding
  omv submissions close <id> --cve CVE-YYYY-NNNN [--json]
                                     Close submission records with a CVE id
  omv config [get <key>|set <key> <value>|unset <key>|list]
                                     Manage persistent config (scope, etc.)
  omv version [--json]               Show package and registry version
  omv help                           Show this message

Examples:
  omv start
  omv start --vuln xss,auth --no-interactive
  npx oh-my-vul setup
  npx oh-my-vul setup --scope project
  npx oh-my-vul setup --force
  omv doctor
  omv doctor --json
  omv dashboard
  omv first --target acme --ecosystem npm --vuln xss,auth --no-interactive
  omv campaign list
  omv review demo --strict
  omv findings list
  omv findings init demo
  omv findings validate
  omv findings promote demo --status confirmed
  omv findings workflow
  omv findings show demo
  omv findings archive demo --reason reported
  omv radar refresh --dry-run
  omv request preflight
  omv request fetch https://registry.npmjs.org/markdown-it --json
  omv submissions track demo
  omv uninstall --scope user
  omv config set scope user
  omv config list
`);
}

export function commandUsage(topic: string | undefined, subcommand: string | undefined): void {
  switch (topic) {
    case "--all":
      fullUsage();
      return;
    case "setup":
      console.log(`Usage: omv setup [--scope user|project] [--force] [--dry-run] [--json]

Install all registry-marked skills and write an install manifest.`);
      return;
    case "start":
      console.log(`Usage: omv start --vuln <comma-list> [options]

Initialize a private workspace, detect local project metadata, and create the first campaign.
Options: --id, --target, --version, --source, --ecosystem, --mode, --goal,
--budget, --local-lab, --force, --no-interactive, --json.`);
      return;
    case "uninstall":
      console.log(`Usage: omv uninstall [--scope user|project] [--json]

Remove installed skills, install manifest, and setup-scope.json (project scope only).
User data under .omv/ (findings, reports, repro, notes, submissions) is preserved.`);
      return;
    case "doctor":
      console.log(`Usage: omv doctor [--scope user|project] [--json] [--strict]

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
    case "eval":
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
      campaignUsage(subcommand, false);
      return;
    case "first":
      campaignUsage(subcommand, true);
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
      reproUsage(subcommand);
      return;
    case "report":
      reportUsage(subcommand);
      return;
    case "sources":
      sourcesUsage(subcommand);
      return;
    case "threat-map":
      threatMapUsage(subcommand);
      return;
    case "verification":
      verificationUsage(subcommand);
      return;
    default:
      usage();
      return;
  }
}

const TOP_LEVEL_COMMANDS = [
  "start", "setup", "uninstall", "config", "doctor", "dashboard", "eval", "campaign", "first",
  "review", "workspace", "findings", "sources", "radar", "request", "dedup", "disclose",
  "submissions", "repro", "report", "threat-map", "verification", "version", "help",
] as const;

const PRODUCT_ALIASES: Record<string, string[]> = {
  find: ["/omv-find", "omv findings"],
  audit: ["/omv-audit <id>", "omv findings workflow"],
  next: ["omv dashboard", "omv findings workflow"],
  status: ["omv dashboard", "omv workspace status"],
};

export function commandSuggestions(input: string): string[] {
  const direct = PRODUCT_ALIASES[input.toLowerCase()];
  if (direct) return direct;
  return TOP_LEVEL_COMMANDS
    .map((candidate) => ({ candidate, distance: editDistance(input.toLowerCase(), candidate) }))
    .filter(({ candidate, distance }) => distance <= Math.max(2, Math.floor(candidate.length / 3)))
    .sort((left, right) => left.distance - right.distance || left.candidate.localeCompare(right.candidate))
    .slice(0, 3)
    .map(({ candidate }) => `omv ${candidate}`);
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

export function campaignUsage(subcommand: string | undefined, firstAlias = false): void {
  const root = firstAlias ? "omv first" : "omv campaign";
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
      console.log(`Usage: ${root} seed <id> [--json]

Creates candidate Evidence.v1 files only. A supported target ecosystem is required;
existing .yaml and .yml findings are never overwritten.

If <id>.surfaces.yaml exists, only selected attack-surface cards are seeded.
Otherwise generic vulnerability-class lanes are used.`);
      return;
    case "surfaces":
      console.log(`Usage:
  omv campaign surfaces propose <id> [--force] [--json]
  omv campaign surfaces show <id> [--json]
  omv campaign surfaces select <id> --cards <id,id> [--json]

Propose deterministic attack-surface cards from the shared pack catalog, select
which hypotheses to pursue, then seed candidate Evidence.v1 findings.`);
      return;
    default:
      console.log(`Usage:
  ${firstAlias ? "omv first [init flags]" : "omv campaign [list] [--json]"}
  ${root} init --target <name> --vuln <comma-list> [options]
  ${root} list [--json]
  ${root} show <id> [--json]
  omv campaign surfaces propose <id> [--force]
  omv campaign surfaces show <id>
  omv campaign surfaces select <id> --cards <id,id>
  ${root} seed <id> [--json]`);
      return;
  }
}

export function workspaceUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log("Usage: omv workspace init [--gitignore] [--json]");
      return;
    case "status":
      console.log("Usage: omv workspace status [--json]");
      return;
    case "log":
      console.log("Usage: omv workspace log [--json]");
      return;
    default:
      console.log(`Usage:
  omv workspace init [--gitignore] [--json]
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
    case "workflow":
      console.log("Usage: omv findings workflow [--json]");
      return;
    case "doctor":
      console.log(`Usage: omv findings doctor <id> [--json] [--strict-verification]

Explain what blocks submission readiness. With --strict-verification, report
readiness requires .omv/verifications/<id>.yaml to validate with decision.status
pass and a non-stale Evidence.v1 hash.`);
      return;
    case "show":
      console.log("Usage: omv findings show <id> [--archived] [--json]");
      return;
    case "open":
      console.log("Usage: omv findings open <id> [--archived] [--json]");
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
  omv findings workflow [--json]
  omv findings doctor <id> [--json]
  omv findings show <id> [--archived] [--json]
  omv findings open <id> [--archived] [--json]
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
