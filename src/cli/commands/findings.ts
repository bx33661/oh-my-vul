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
  deleteFinding,
  showFinding,
  type FindingTemplateResult,
  type FindingSummary,
  type FindingWorkflowSummary,
  type FindingDetail,
  type FindingValidation,
  type ArchivedFindingSummary,
  type FindingArchiveResult,
  type FindingRestoreResult,
  type FindingDeleteResult,
} from "../findings.js";
import { usage } from "../usage.js";
import { firstPositionalAfter, parseStatus, parseReason, wantsJson } from "./shared.js";
import {
  command as cmd,
  empty,
  error as tuiError,
  kv,
  muted,
  outcomeBadge,
  panel,
  readiness,
  statusBadge,
  table,
  title,
  truncate,
  validationBadge,
  warn,
} from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "list";
  const json = wantsJson(args);

  switch (subcommand) {
    case "list":
      await runFindingsList(json);
      return;
    case "workflow":
      await runFindingsWorkflow(json);
      return;
    case "show":
      await runFindingsShow(args, json);
      return;
    case "open":
      await runFindingsOpen(args, json);
      return;
    case "init":
      await runFindingsInit(args, json);
      return;
    case "validate":
      await runFindingsValidate(args, json);
      return;
    case "promote":
      await runFindingsPromote(args, json);
      return;
    case "archive":
      await runFindingsArchive(args, json);
      return;
    case "restore":
      await runFindingsRestore(args, json);
      return;
    case "delete":
      await runFindingsDelete(args, json);
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

async function runFindingsShow(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "show");
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

async function runFindingsOpen(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "open");
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

async function runFindingsInit(args: string[], json: boolean): Promise<void> {
  const id = firstPositionalAfter(args, "init");
  const status = parseStatus(args) ?? "candidate";
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

async function runFindingsValidate(args: string[], json: boolean): Promise<void> {
  const strict = args.includes("--strict");
  const target = firstPositionalAfter(args, "validate");
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

async function runFindingsPromote(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "promote");
  const status = parseStatus(args);

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

async function runFindingsArchive(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "archive");
  if (target === "list") {
    const archived = await listArchivedFindings();
    if (json) {
      console.log(JSON.stringify(archived, null, 2));
      return;
    }
    printArchivedSummaries(archived);
    return;
  }

  const reason = parseReason(args);
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

async function runFindingsRestore(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "restore");
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

async function runFindingsDelete(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "delete");
  const force = args.includes("--force");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await deleteFinding(target, process.cwd(), { force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printDeleteResult(result);
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
  if (finding.threatMap) {
    lines.push(...kv([["threat map", finding.threatMap.path]]));
    lines.push("", muted("threat map"));
    lines.push(...finding.threatMap.rendered.map((item) => `  ${item}`));
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
        ["submissions", result.submissionRecords.length > 0 ? `${result.submissionRecords.length} record(s)` : "none"],
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

function printDeleteResult(result: FindingDeleteResult): void {
  if (!result.deleted) {
    console.log(
      panel("finding delete preview", [
        ...kv([
          ["id", result.id],
          ["action", "preview only"],
          ["next", cmd(`omv findings delete ${result.id} --force`)],
        ]),
        "",
        muted("paths to delete"),
        ...result.paths.map((p) => `  ${p}`),
      ]),
    );
    return;
  }

  const finalState = result.errors.length > 0 ? "warn" : "pass";
  console.log(
    panel("finding deleted", [
      ...kv([
        ["id", result.id],
        ["result", outcomeBadge(finalState)],
        ["paths", `${result.paths.length} file(s) removed`],
      ]),
      ...(result.errors.length > 0 ? ["", warn("errors"), ...result.errors.map((e) => `  ${e}`)] : []),
    ]),
  );
}
