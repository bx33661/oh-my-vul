import type { Check, DoctorResult } from "./doctor.js";
import type {
  ArchivedFindingSummary,
  FindingArchiveResult,
  FindingDetail,
  FindingDoctorResult,
  FindingRestoreResult,
  FindingSummary,
  FindingTemplateResult,
  FindingValidation,
  FindingWorkflowSummary,
  ReportArtifactsResult,
  ReproInitResult,
} from "./findings.js";
import type { SetupResult } from "./setup.js";
import type { WorkspaceActivityEntry, WorkspaceStatus } from "./workspace.js";
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

export function printSetupResult(result: SetupResult): void {
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

export function printDoctorResult(result: DoctorResult, strict: boolean): void {
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

export function printWorkspaceStatus(result: WorkspaceStatus): void {
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

export function printDashboard(
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
        ["id", "status", "evidence", "submission", "verdict", "blocker", "next action"],
        workflow.slice(0, 8).map((finding) => [
          truncate(finding.id, 30),
          statusBadge(finding.status),
          readiness(finding.evidenceScore),
          readiness(finding.submissionScore),
          truncate(finding.verdict.exploitability, 14),
          truncate(finding.blockers[0] ?? finding.priorityReason, 30),
          cmd(truncate(finding.nextAction, 54)),
        ]),
      ),
    );
    const truncatedActions = workflow
      .slice(0, 8)
      .filter((finding) => finding.nextAction.length > 54);
    if (truncatedActions.length > 0) {
      console.log(panel("full next actions", truncatedActions.map((finding) => `${finding.id}: ${cmd(finding.nextAction)}`)));
    }
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

export function printWorkspaceActivity(entries: WorkspaceActivityEntry[]): void {
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

export function printFindingSummaries(findings: FindingSummary[]): void {
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

export function printWorkflowSummaries(findings: FindingWorkflowSummary[]): void {
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

export function printFindingDetail(finding: FindingDetail): void {
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
  if (finding.blockers.length > 0) {
    lines.push("", muted("blockers"));
    lines.push(...finding.blockers.slice(0, 5).map((item) => `  ${item}`));
  }
  console.log(panel(finding.id, lines));
}

export function printArchivedSummaries(findings: ArchivedFindingSummary[]): void {
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

export function printFindingValidation(result: FindingValidation): void {
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

export function printFindingDoctor(result: FindingDoctorResult): void {
  console.log(title(`finding doctor ${result.id}`));
  const lines = kv([
    ["status", statusBadge(result.status)],
    ["evidence", readiness(result.evidenceScore)],
    ["submission", readiness(result.submissionScore)],
    ["threshold", String(result.submissionThreshold)],
    ["validation", validationBadge(result.validationOk)],
    ["report ready", result.reportReady ? outcomeBadge("pass") : outcomeBadge("fail")],
    ["path", result.path],
    ["next", cmd(result.nextAction)],
  ]);
  if (result.issues.length === 0) {
    lines.push("", "No blocking issues found.");
  } else {
    lines.push("", tuiError("issues"));
    lines.push(...result.issues.map((issue) => {
      const fields = issue.fields.length > 0 ? ` [${issue.fields.join(", ")}]` : "";
      return `  ${issue.severity}: ${issue.message}${fields} -> ${issue.nextAction}`;
    }));
  }
  console.log(panel(result.id, lines));
}

export function printReproInitResult(result: ReproInitResult): void {
  console.log(
    panel("repro artifacts", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["finding", result.findingPath],
        ["written", String(result.written.length)],
        ["skipped", String(result.skipped.length)],
        ["evidence", result.updatedFinding ? "updated evidence.repro_artifacts" : "already listed"],
        ["next", cmd(`/omv-repro ${result.id}`)],
      ]),
      "",
      ...result.artifacts.map((path) => `  ${path}`),
    ]),
  );
}

export function printReportArtifacts(result: ReportArtifactsResult): void {
  const state = result.errors.length > 0 ? "fail" : result.warnings.length > 0 ? "warn" : "pass";
  const lines = kv([
    ["id", result.id],
    ["status", statusBadge(result.status)],
    ["state", outcomeBadge(state)],
    ["reports", result.reportsDir],
    ["report files", String(result.reportArtifactPaths.length)],
    ["repro", result.reproDir],
    ["repro refs", `${result.existingReproArtifacts.length}/${result.listedReproArtifacts.length}`],
  ]);
  if (result.reportArtifactPaths.length > 0) {
    lines.push("", "report artifacts");
    lines.push(...result.reportArtifactPaths.map((path) => `  ${path}`));
  }
  if (result.errors.length > 0) {
    lines.push("", tuiError("errors"));
    lines.push(...result.errors.map((item) => `  ${item}`));
  }
  if (result.warnings.length > 0) {
    lines.push("", warn("warnings"));
    lines.push(...result.warnings.map((item) => `  ${item}`));
  }
  console.log(panel("report artifacts", lines));
}

export function printFindingTemplateResult(result: FindingTemplateResult): void {
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

export function printArchiveResult(result: FindingArchiveResult): void {
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

export function printRestoreResult(result: FindingRestoreResult): void {
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

function formatCheckDetail(check: Check): string {
  return `${statusIcon(check.status)} ${check.name}: ${check.message}`;
}
