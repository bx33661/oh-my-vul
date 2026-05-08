export function usage(): void {
  console.log(`oh-my-vul — vulnerability research skills for Claude Code

Usage:
  omv setup [--scope user|project] [--force] [--dry-run]
                                     Install skills to ~/.claude/skills/ or ./.claude/skills/
  omv doctor [--scope user|project] [--json] [--strict]
                                     Check installation health
  omv dashboard [--json]            Show workspace, queue, and recent activity
  omv repro init <id> [--force] [--json]
                                     Create standard local reproduction artifacts
  omv report artifacts <id> [--json]
                                     Check report and reproduction artifacts
  omv workspace init [--json]        Initialize local .omv workspace
  omv workspace status [--json]      Show local .omv workspace status
  omv workspace log [--json]         Show local workspace activity log
  omv findings list [--json]        List .omv/findings evidence files
  omv findings workflow [--json]    Show active finding lifecycle next actions
  omv findings doctor <id> [--json] Explain what blocks submission readiness
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
  omv version [--json]               Show package and registry version
  omv help                           Show this message

Examples:
  npx oh-my-vul setup
  npx oh-my-vul setup --scope project
  npx oh-my-vul setup --force
  omv doctor
  omv doctor --json
  omv dashboard
  omv repro init demo
  omv findings doctor demo
  omv report artifacts demo
  omv findings list
  omv findings init demo
  omv findings validate
  omv findings promote demo --status confirmed
  omv findings workflow
  omv findings show demo
  omv findings archive demo --reason reported
`);
}

export function commandUsage(topic: string | undefined, subcommand: string | undefined): void {
  switch (topic) {
    case "setup":
      console.log(`Usage: omv setup [--scope user|project] [--force] [--dry-run] [--json]

Install all registry-marked skills and write an install manifest.`);
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
    case "repro":
      reproUsage(subcommand);
      return;
    case "report":
      reportUsage(subcommand);
      return;
    case "workspace":
      workspaceUsage(subcommand);
      return;
    case "findings":
      findingsUsage(subcommand);
      return;
    default:
      usage();
      return;
  }
}

export function reproUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log(`Usage: omv repro init <id> [--force] [--json]

Create .omv/repro/<id>/ with README.md, commands.sh, observed.txt, docker-compose.yml, and screenshots/.`);
      return;
    default:
      console.log("Usage: omv repro init <id> [--force] [--json]");
      return;
  }
}

export function reportUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "artifacts":
      console.log(`Usage: omv report artifacts <id> [--json]

Check .omv/reports/<id>/ and Evidence.v1 reproduction artifact references.`);
      return;
    default:
      console.log("Usage: omv report artifacts <id> [--json]");
      return;
  }
}

export function workspaceUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "init":
      console.log("Usage: omv workspace init [--json]");
      return;
    case "status":
      console.log("Usage: omv workspace status [--json]");
      return;
    case "log":
      console.log("Usage: omv workspace log [--json]");
      return;
    default:
      console.log(`Usage:
  omv workspace init [--json]
  omv workspace status [--json]
  omv workspace log [--json]`);
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
      console.log("Usage: omv findings doctor <id> [--json]");
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
