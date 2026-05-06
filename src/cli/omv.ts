#!/usr/bin/env node
import { setup } from "./setup.js";
import { doctor, type Check, type DoctorResult } from "./doctor.js";
import { validateArgs } from "./args.js";
import { readCatalog } from "./catalog.js";
import { packageRoot } from "./paths.js";
import { readFile } from "fs/promises";
import type { SetupResult } from "./setup.js";
import {
  listFindings,
  validateFinding,
  validateFindings,
  promoteFinding,
  archiveFinding,
  createFindingTemplate,
  listArchivedFindings,
  listFindingWorkflow,
  restoreFinding,
  showFinding,
  type FindingTemplateResult,
  type EvidenceStatus,
  type FindingSummary,
  type FindingWorkflowSummary,
  type FindingDetail,
  type FindingValidation,
  type ArchivedFindingSummary,
  type FindingArchiveResult,
  type FindingRestoreResult,
} from "./findings.js";
import { initWorkspace, readWorkspaceActivity, workspaceStatus, type WorkspaceActivityEntry, type WorkspaceStatus } from "./workspace.js";
import {
  command as cmd,
  empty,
  error as tuiError,
  kv,
  muted,
  outcomeBadge,
  panel,
  readiness,
  section,
  statusBadge,
  statusIcon,
  table,
  title,
  truncate,
  validationBadge,
  warn,
} from "./tui.js";

const args = process.argv.slice(2);
const command = args[0];

function usage(): void {
  console.log(`oh-my-vul — vulnerability research skills for Claude Code

Usage:
  omv setup [--scope user|project] [--force] [--dry-run]
                                     Install skills to ~/.claude/skills/ or ./.claude/skills/
  omv doctor [--scope user|project] [--json] [--strict]
                                     Check installation health
  omv dashboard [--json]            Show workspace, queue, and recent activity
  omv workspace init [--json]        Initialize local .omv workspace
  omv workspace status [--json]      Show local .omv workspace status
  omv workspace log [--json]         Show local workspace activity log
  omv findings list [--json]        List .omv/findings evidence files
  omv findings workflow [--json]    Show active finding lifecycle next actions
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
  omv findings list
  omv findings init demo
  omv findings validate
  omv findings promote demo --status confirmed
  omv findings workflow
  omv findings show demo
  omv findings archive demo --reason reported
`);
}

function commandUsage(topic: string | undefined): void {
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
    case "workspace":
      workspaceUsage(args[1]);
      return;
    case "findings":
      findingsUsage(args[1]);
      return;
    default:
      usage();
      return;
  }
}

function workspaceUsage(subcommand: string | undefined): void {
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

function findingsUsage(subcommand: string | undefined): void {
  switch (subcommand) {
    case "list":
      console.log("Usage: omv findings list [--json]");
      return;
    case "workflow":
      console.log("Usage: omv findings workflow [--json]");
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

function wantsHelp(): boolean {
  return args.includes("--help") || args.includes("-h") || command === "help";
}

async function runSetup(): Promise<void> {
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const json = args.includes("--json");
  const scope = parseScope("user");

  if (dryRun) {
    console.log("Dry run — no files will be written.\n");
  }

  const result = await setup({ force, dryRun, scope });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  printSetupResult(result);

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

async function runDoctor(): Promise<void> {
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const scope = parseOptionalScope();
  const result = await doctor({ scope });
  const ok = result.ok && (!strict || !result.warnings);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (!ok) {
      process.exit(1);
    }
    return;
  }

  printDoctorResult(result, strict);
  if (!ok) {
    process.exit(1);
  }
}

async function runWorkspace(): Promise<void> {
  const subcommand = args[1] ?? "status";
  const json = args.includes("--json");

  switch (subcommand) {
    case "init":
      await printWorkspaceCommandResult(await initWorkspace(), json);
      return;
    case "status":
      await printWorkspaceCommandResult(await workspaceStatus(), json);
      return;
    case "log":
      await runWorkspaceLog(json);
      return;
    case "help":
    case "--help":
    case "-h":
      workspaceUsage(undefined);
      return;
    default:
      console.error(`Unknown workspace command: ${subcommand}\n`);
      workspaceUsage(undefined);
      process.exit(1);
  }

}

async function runVersion(): Promise<void> {
  const json = args.includes("--json");
  const pkg = JSON.parse(await readFile(`${packageRoot()}/package.json`, "utf-8")) as { name?: string; version?: string };
  const catalog = await readCatalog();
  const result = {
    package: pkg.name ?? "oh-my-vul",
    version: pkg.version ?? "",
    registryVersion: catalog.version,
    platform: catalog.platform,
    updated: catalog.updated,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${result.package} ${result.version}`);
  console.log(`Registry: ${result.registryVersion} (${result.platform}, updated ${result.updated})`);
}

async function runDashboard(): Promise<void> {
  const json = args.includes("--json");
  const [status, workflow, activity] = await Promise.all([
    workspaceStatus(),
    listFindingWorkflow(),
    readWorkspaceActivity(),
  ]);
  const result = { status, workflow, activity: activity.slice(-8) };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printDashboard(status, workflow, activity.slice(-8));
}

async function runFindings(): Promise<void> {
  const subcommand = args[1] ?? "list";
  const json = args.includes("--json");

  switch (subcommand) {
    case "list":
      await runFindingsList(json);
      return;
    case "workflow":
      await runFindingsWorkflow(json);
      return;
    case "show":
      await runFindingsShow(json);
      return;
    case "open":
      await runFindingsOpen(json);
      return;
    case "init":
      await runFindingsInit(json);
      return;
    case "validate":
      await runFindingsValidate(json);
      return;
    case "promote":
      await runFindingsPromote(json);
      return;
    case "archive":
      await runFindingsArchive(json);
      return;
    case "restore":
      await runFindingsRestore(json);
      return;
    case "help":
    case "--help":
    case "-h":
      usage();
      return;
    default:
      console.error(`Unknown findings command: ${subcommand}\n`);
      usage();
      process.exit(1);
  }
}

async function printWorkspaceCommandResult(result: WorkspaceStatus, json: boolean): Promise<void> {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printWorkspaceStatus(result);
}

async function runWorkspaceLog(json: boolean): Promise<void> {
  const entries = await readWorkspaceActivity();
  if (json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }
  printWorkspaceActivity(entries);
}

async function runFindingsWorkflow(json: boolean): Promise<void> {
  const findings = await listFindingWorkflow();
  if (json) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }
  if (findings.length === 0) {
    console.log("No active findings. Run /omv-find or omv findings init <id> to add one.");
    return;
  }
  printWorkflowSummaries(findings);
}

async function runFindingsShow(json: boolean): Promise<void> {
  const target = firstPositionalAfter("show");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await showFinding(target, process.cwd(), { archived: args.includes("--archived") });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printFindingDetail(result);
}

async function runFindingsOpen(json: boolean): Promise<void> {
  const target = firstPositionalAfter("open");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await showFinding(target, process.cwd(), { archived: args.includes("--archived") });
  const output = {
    id: result.id,
    path: result.path,
    archived: result.archived,
    nextAction: result.nextAction,
  };
  if (json) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }
  console.log(
    panel("finding file", [
      ...kv([
        ["id", output.id],
        ["path", output.path],
        ["state", output.archived ? "archived" : "active"],
        ["next", cmd(output.nextAction)],
      ]),
    ]),
  );
}

async function runFindingsList(json: boolean): Promise<void> {
  const findings = await listFindings();
  if (json) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }

  if (findings.length === 0) {
    console.log("No findings yet. Add Evidence.v1 YAML files under .omv/findings/.");
    return;
  }

  printFindingSummaries(findings);
}

async function runFindingsInit(json: boolean): Promise<void> {
  const id = firstPositionalAfter("init");
  const status = parseStatus() ?? "candidate";
  const force = args.includes("--force");

  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await createFindingTemplate(id, { status, force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printFindingTemplateResult(result);
}

async function runFindingsValidate(json: boolean): Promise<void> {
  const strict = args.includes("--strict");
  const target = firstPositionalAfter("validate");
  const results = target ? [await validateFinding(target)] : await validateFindings();
  const ok = results.every((result) => result.ok && (!strict || result.warnings.length === 0));

  if (json) {
    console.log(JSON.stringify(target ? results[0] : results, null, 2));
    if (!ok) {
      process.exit(1);
    }
    return;
  }

  if (results.length === 0) {
    console.log("No findings to validate.");
    return;
  }

  for (const result of results) {
    printFindingValidation(result);
  }

  if (!ok) {
    process.exit(1);
  }
}

async function runFindingsPromote(json: boolean): Promise<void> {
  const target = firstPositionalAfter("promote");
  const status = parseStatus();

  if (!target) {
    console.error("Missing finding id or path.");
    process.exit(1);
  }
  if (!status) {
    console.error("Missing --status. Valid values: candidate, confirmed, blocked");
    process.exit(1);
  }

  const result = await promoteFinding(target, status);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printFindingValidation(result);
  }
  if (!result.ok) {
    process.exit(1);
  }
}

async function runFindingsArchive(json: boolean): Promise<void> {
  const target = firstPositionalAfter("archive");
  if (target === "list") {
    const archived = await listArchivedFindings();
    if (json) {
      console.log(JSON.stringify(archived, null, 2));
      return;
    }
    printArchivedSummaries(archived);
    return;
  }

  const reason = parseReason();
  const force = args.includes("--force");
  const strict = args.includes("--strict");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  if (!reason) {
    console.error("Missing --reason.");
    process.exit(1);
  }

  const result = await archiveFinding(target, reason, process.cwd(), { force, strict });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printArchiveResult(result);
}

async function runFindingsRestore(json: boolean): Promise<void> {
  const target = firstPositionalAfter("restore");
  const force = args.includes("--force");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await restoreFinding(target, process.cwd(), { force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printRestoreResult(result);
}

function printSetupResult(result: SetupResult): void {
  const total = result.installed.length + result.skipped.length + result.errors.length;
  const summary = result.errors.length > 0
    ? `${result.errors.length} error(s), ${result.installed.length}/${total} skill(s) installed`
    : result.installed.length === 0
      ? `${result.skipped.length}/${total} skill(s) already installed`
      : `${result.installed.length}/${total} skill(s) installed`;
  const next = result.errors.length > 0
    ? `omv setup --scope ${result.scope} --force`
    : "omv doctor";
  const finalState = result.errors.length > 0 ? "error" : result.installed.length === 0 ? "skipped" : "installed";

  console.log(title("oh-my-vul setup"));
  console.log(
    panel("install summary", [
      ...kv([
        ["scope", result.scope],
        ["destination", result.destination],
        ["result", outcomeBadge(finalState)],
        ["skills", summary],
        ["next", cmd(next)],
      ]),
    ]),
  );

  const rows = [
    ...result.installed.map((name) => [statusIcon("installed"), name, outcomeBadge("installed"), "copied into skills directory"]),
    ...result.skipped.map((name) => [statusIcon("skipped"), name, outcomeBadge("skipped"), "already installed; use --force to overwrite"]),
    ...result.errors.map((message) => [statusIcon("error"), "-", outcomeBadge("error"), message]),
  ];
  if (rows.length > 0) {
    console.log(table(["", "skill", "state", "detail"], rows));
  }
}

function printDoctorResult(result: DoctorResult, strict: boolean): void {
  const passed = result.checks.filter((item) => item.status === "pass").length;
  const warned = result.checks.filter((item) => item.status === "warn").length;
  const failed = result.checks.filter((item) => item.status === "fail").length;
  const finalState = failed > 0 ? "fail" : strict && warned > 0 ? "fail" : warned > 0 ? "warn" : "pass";
  const next = failed > 0
    ? `omv setup --scope ${result.scope} --force`
    : warned > 0
      ? `omv doctor --scope ${result.scope} --strict`
      : "omv dashboard";

  console.log(title("oh-my-vul doctor"));
  console.log(
    panel("health summary", [
      ...kv([
        ["scope", result.scope],
        ["skills", result.skillsDir],
        ["status", outcomeBadge(finalState)],
        ["checks", `${passed} pass, ${warned} warn, ${failed} fail`],
        ["next", cmd(next)],
      ]),
    ]),
  );

  console.log(section("Checks"));
  console.log(
    table(
      ["", "check", "state", "detail"],
      result.checks.map((check) => [
        statusIcon(check.status),
        truncate(check.name, 30),
        outcomeBadge(check.status),
        truncate(check.message, 76),
      ]),
    ),
  );

  const warnings = result.checks.filter((item) => item.status === "warn");
  if (warnings.length > 0) {
    console.log(panel("warnings", warnings.map(formatCheckDetail)));
  }
  const failures = result.checks.filter((item) => item.status === "fail");
  if (failures.length > 0) {
    console.log(panel("failures", failures.map(formatCheckDetail)));
  } else if (strict && warnings.length > 0) {
    console.log(panel("strict mode", [warn("warnings are treated as failures in --strict mode")]));
  }
}

function formatCheckDetail(check: Check): string {
  return `${statusIcon(check.status)} ${check.name}: ${check.message}`;
}

function printWorkspaceStatus(result: WorkspaceStatus): void {
  const statuses = Object.entries(result.statusCounts)
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
  console.log(title("oh-my-vul workspace"));
  console.log(
    panel("workspace", [
      ...kv([
        ["root", result.root],
        ["findings", result.findingsDir],
        ["archive", result.archiveDir],
        ["active", String(result.activeCount)],
        ["archived", String(result.archivedCount)],
        ["statuses", statuses || "none"],
        ["index", result.staleIndex ? "rebuilt from stale cache" : result.indexPath],
      ]),
      ...result.warnings.map((item) => warn(`warning  ${item}`)),
    ]),
  );
}

function printDashboard(
  status: WorkspaceStatus,
  workflow: FindingWorkflowSummary[],
  activity: WorkspaceActivityEntry[],
): void {
  console.log(title("oh-my-vul dashboard"));
  const statuses = Object.entries(status.statusCounts)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ");
  console.log(
    panel("workspace", [
      ...kv([
        ["root", status.root],
        ["active", String(status.activeCount)],
        ["archived", String(status.archivedCount)],
        ["statuses", statuses || "none"],
        ["next", workflow[0] ? cmd(workflow[0].nextAction) : cmd("omv findings init <id>")],
      ]),
      ...status.warnings.map((item) => warn(`warning  ${item}`)),
    ]),
  );

  if (workflow.length === 0) {
    console.log(empty("No active findings. Start with omv findings init <id> or /omv-find."));
  } else {
    console.log(
      table(
      ["id", "status", "evidence", "submission", "next action"],
      workflow.slice(0, 8).map((finding) => [
        truncate(finding.id, 30),
        statusBadge(finding.status),
        readiness(finding.evidenceScore),
        readiness(finding.submissionScore),
        cmd(truncate(finding.nextAction, 54)),
      ]),
      ),
    );
  }

  if (activity.length > 0) {
    console.log(
      table(
        ["time", "action", "id"],
        activity.map((entry) => [
          truncate(entry.timestamp, 27),
          entry.action,
          truncate(entry.id ?? "-", 28),
        ]),
      ),
    );
  }
}

function printWorkspaceActivity(entries: WorkspaceActivityEntry[]): void {
  if (entries.length === 0) {
    console.log(empty("No workspace activity yet."));
    return;
  }
  console.log(title("activity log"));
  console.log(
    table(
      ["time", "action", "id", "detail"],
      entries.map((entry) => [
        truncate(entry.timestamp, 27),
        entry.action,
        truncate(entry.id ?? "-", 26),
        entry.reason ? `reason=${entry.reason}` : entry.status ? `status=${entry.status}` : entry.path ?? "",
      ]),
    ),
  );
}

function printFindingSummaries(findings: FindingSummary[]): void {
  console.log(title("active findings"));
  console.log(
    table(
      ["id", "status", "evidence", "submission", "package", "vulnerability"],
      findings.map((finding) => [
        truncate(finding.id, 36),
        statusBadge(finding.status),
        readiness(finding.evidenceScore),
        readiness(finding.submissionScore),
        truncate(`${finding.ecosystem}:${finding.package}`, 42),
        truncate(finding.vulnerability, 36),
      ]),
    ),
  );
}

function printWorkflowSummaries(findings: FindingWorkflowSummary[]): void {
  console.log(title("workflow queue"));
  console.log(
    table(
      ["id", "priority", "status", "evidence", "submission", "next action", "package", "vulnerability"],
      findings.map((finding) => [
        truncate(finding.id, 30),
        String(finding.priority),
        statusBadge(finding.status),
        readiness(finding.evidenceScore),
        readiness(finding.submissionScore),
        cmd(truncate(finding.nextAction, 46)),
        truncate(`${finding.ecosystem}:${finding.package}`, 34),
        truncate(finding.vulnerability, 30),
      ]),
    ),
  );
}

function printFindingDetail(finding: FindingDetail): void {
  console.log(title(`finding ${finding.id}`));
  const lines = kv([
    ["status", statusBadge(finding.status)],
    ["evidence", readiness(finding.evidenceScore)],
    ["submission", readiness(finding.submissionScore)],
    ["verdict", `${finding.verdict.exploitability}/${finding.verdict.confidence}`],
    ["validation", validationBadge(finding.validation.ok)],
    ["priority", `${finding.priority} (${finding.priorityReason})`],
    ["path", finding.path],
    ["package", `${finding.ecosystem}:${finding.package}`],
    ["vulnerability", finding.vulnerability],
  ]);
  if (finding.reproArtifacts.length > 0) {
    lines.push(...kv([["repro artifacts", String(finding.reproArtifacts.length)]]));
  }
  if (finding.archived) {
    lines.push(...kv([
      ["archived", finding.archivedAt ?? "unknown"],
      ["reason", finding.archiveReason ?? "unknown"],
    ]));
  }
  lines.push(...kv([["next", cmd(finding.nextAction)]]));
  if (finding.validation.errors.length > 0) {
    lines.push("", tuiError("errors"));
    lines.push(...finding.validation.errors.map((item) => `  ${item}`));
  }
  if (finding.validation.warnings.length > 0) {
    lines.push("", warn("warnings"));
    lines.push(...finding.validation.warnings.slice(0, 8).map((item) => `  ${item}`));
    if (finding.validation.warnings.length > 8) {
      lines.push(muted(`  ... ${finding.validation.warnings.length - 8} more warning(s)`));
    }
  }
  if (finding.missingFields.length > 0) {
    lines.push("", muted(`missing  ${finding.missingFields.join(", ")}`));
  }
  console.log(panel(finding.id, lines));
}

function printArchivedSummaries(findings: ArchivedFindingSummary[]): void {
  if (findings.length === 0) {
    console.log(empty("No archived findings."));
    return;
  }
  console.log(title("archive"));
  console.log(
    table(
      ["id", "status", "archived", "reason", "package"],
      findings.map((finding) => [
        truncate(finding.id, 34),
        statusBadge(finding.status),
        truncate(finding.archivedAt, 27),
        truncate(finding.archiveReason, 26),
        truncate(`${finding.ecosystem}:${finding.package}`, 40),
      ]),
    ),
  );
}

function printFindingValidation(result: FindingValidation): void {
  const lines = kv([
    ["status", statusBadge(result.status)],
    ["evidence", readiness(result.evidenceScore)],
    ["submission", readiness(result.submissionScore)],
    ["validation", validationBadge(result.ok)],
    ["path", result.path],
  ]);
  if (result.errors.length > 0) {
    lines.push("", tuiError("errors"));
    lines.push(...result.errors.map((item) => `  ${item}`));
  }
  if (result.warnings.length > 0) {
    lines.push("", warn("warnings"));
    lines.push(...result.warnings.map((item) => `  ${item}`));
  }
  console.log(panel(result.id, lines));
}

function printFindingTemplateResult(result: FindingTemplateResult): void {
  console.log(
    panel("finding created", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["status", statusBadge(result.status)],
        ["next", cmd(`omv findings show ${result.id}`)],
      ]),
    ]),
  );
}

function printArchiveResult(result: FindingArchiveResult): void {
  console.log(
    panel("finding archived", [
      ...kv([
        ["id", result.id],
        ["status", statusBadge(result.status)],
        ["from", result.from],
        ["to", result.to],
        ["reason", result.archiveReason],
        ["reports", result.reportArtifactPaths.length > 0 ? `${result.reportArtifactPaths.length} artifact(s)` : "none"],
        ["next", cmd(`omv findings show ${result.id} --archived`)],
      ]),
      ...result.warnings.map((item) => warn(`warning  ${item}`)),
    ]),
  );
}

function printRestoreResult(result: FindingRestoreResult): void {
  console.log(
    panel("finding restored", [
      ...kv([
        ["id", result.id],
        ["status", statusBadge(result.status)],
        ["from", result.from],
        ["to", result.to],
        ["next", cmd("omv findings workflow")],
      ]),
    ]),
  );
}

function firstPositionalAfter(subcommand: string): string | undefined {
  const start = args.indexOf(subcommand) + 1;
  for (let index = start; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--")) {
      index += optionTakesValue(value) ? 1 : 0;
      continue;
    }
    return value;
  }
  return undefined;
}

function optionTakesValue(option: string): boolean {
  return option === "--scope" || option === "--status" || option === "--reason";
}

function parseStatus(): EvidenceStatus | undefined {
  const index = args.indexOf("--status");
  const raw = index === -1 ? undefined : args[index + 1];
  if (raw === "candidate" || raw === "confirmed" || raw === "blocked") {
    return raw;
  }
  return undefined;
}

function parseReason(): string | undefined {
  const index = args.indexOf("--reason");
  const raw = index === -1 ? undefined : args[index + 1];
  return raw && !raw.startsWith("--") ? raw : undefined;
}

function parseOptionalScope(): "user" | "project" | undefined {
  const index = args.indexOf("--scope");
  if (index === -1) {
    return undefined;
  }
  return parseScope("user");
}

function parseScope(defaultScope: "user" | "project"): "user" | "project" {
  const index = args.indexOf("--scope");
  const raw = index === -1 ? defaultScope : args[index + 1];
  if (raw === "user" || raw === "project") {
    return raw;
  }
  console.error(`Invalid --scope: ${raw ?? ""}. Valid values: user, project`);
  process.exit(1);
}

const validation = validateArgs(args);
if (!validation.ok) {
  console.error(`${validation.error}\n`);
  usage();
  process.exit(1);
}

if (wantsHelp()) {
  commandUsage(command === "help" ? args[1] : command);
  process.exit(0);
}

switch (command) {
  case "version":
    runVersion().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "setup":
    runSetup().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "doctor":
    runDoctor().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "dashboard":
    runDashboard().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "workspace":
    runWorkspace().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "findings":
    runFindings().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    usage();
    break;
  default:
    console.error(`Unknown command: ${command}\n`);
    usage();
    process.exit(1);
}
