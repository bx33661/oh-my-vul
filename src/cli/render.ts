import type { Check, DoctorResult } from "./doctor.js";
import type {
  CampaignSummary,
  InitCampaignResult,
  ShowCampaignResult,
} from "./campaign.js";
import type { CampaignSeedResult } from "./campaign-seed.js";
import type {
  ProposeSurfacesResult,
  SelectSurfacesResult,
  ShowSurfacesResult,
} from "./surfaces.js";
import type {
  ArchivedFindingSummary,
  FindingArchiveResult,
  FindingDeleteResult,
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
import type { FindingReview } from "./review.js";
import type { ReportProvenanceResult } from "./report-provenance.js";
import type { SourceRefInitResult, SourceRefValidation } from "./source-ref.js";
import type { SetupResult, UninstallResult } from "./setup.js";
import type { WorkspaceActivityEntry, WorkspaceStatus } from "./workspace.js";
import type { StartResearchResult } from "./start.js";
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
import type { WorkflowAction } from "./workflow.js";

function renderedAction(action: WorkflowAction): string {
  return `${action.surface === "claude" ? "CLAUDE" : "CLI"}  ${action.command}`;
}

export function printCampaignInitResult(result: InitCampaignResult): void {
  console.log(
    panel(result.overwritten ? "campaign updated" : "campaign created", [
      ...kv([
        ["id", result.campaign.id],
        ["target", result.campaign.target.name],
        ["yaml", result.yamlPath],
        ["runbook", result.runbookPath],
        ["lanes", String(result.campaign.lanes.length)],
        ["next", cmd(result.nextAction)],
      ]),
      ...result.warnings.map((message) => warn(`warning  ${message}`)),
    ]),
  );
}

export function printStartResearchResult(result: StartResearchResult): void {
  console.log(title("oh-my-vul start"));
  console.log(
    panel("research workspace ready", [
      ...kv([
        ["target", result.campaign.campaign.target.name],
        ["version", result.campaign.campaign.target.version],
        ["ecosystem", result.campaign.campaign.target.ecosystem],
        ["source", result.campaign.campaign.target.source],
        ["detected", result.project.detectedFrom.join(", ")],
        ["workspace", result.workspace.root],
        ["campaign", result.campaign.yamlPath],
        ["next", cmd(`CLI  ${result.campaign.nextAction}`)],
      ]),
      ...result.project.warnings.map((message) => warn(`warning  ${message}`)),
      ...result.workspace.warnings.map((message) => warn(`warning  ${message}`)),
      ...result.campaign.warnings.map((message) => warn(`warning  ${message}`)),
    ]),
  );
}

export function printCampaignSummaries(campaigns: CampaignSummary[]): void {
  if (campaigns.length === 0) {
    console.log(empty("No campaigns yet. Run omv campaign init to create one."));
    return;
  }
  console.log(title("campaigns"));
  console.log(
    table(
      ["id", "target", "version", "status", "lanes", "next"],
      campaigns.map((campaign) => [
        campaign.id,
        campaign.target,
        campaign.version,
        campaign.status,
        String(campaign.laneCount),
        campaign.nextAction,
      ]),
    ),
  );
}

export function printCampaignDetail(result: ShowCampaignResult): void {
  console.log(
    panel("campaign", [
      ...kv([
        ["id", result.campaign.id],
        ["target", result.campaign.target.name],
        ["version", result.campaign.target.version],
        ["ecosystem", result.campaign.target.ecosystem],
        ["yaml", result.yamlPath],
        ["runbook", result.runbookExists ? result.runbookPath : "missing"],
        ["next", cmd(result.nextAction)],
      ]),
      "",
      section("candidate lanes"),
      ...result.campaign.lanes.map((lane) => `  ${lane.vulnerability_class}  ${lane.finding_id}`),
    ]),
  );
}

export function printCampaignSeedResult(result: CampaignSeedResult): void {
  const state = result.failed.length > 0 ? "warn" : "pass";
  console.log(
    panel("campaign seed", [
      ...kv([
        ["campaign", result.campaignId],
        ["mode", result.seedMode],
        ["result", outcomeBadge(state)],
        ["created", String(result.created.length)],
        ["skipped", String(result.skipped.length)],
        ["failed", String(result.failed.length)],
        ["next", cmd(result.nextAction)],
      ]),
      ...result.created.map((item) => `  created  ${item.id}`),
      ...result.skipped.map((item) => `  skipped  ${item.id}`),
      ...result.failed.map((item) => tuiError(`  failed  ${item.id}: ${item.message}`)),
    ]),
  );
}

export function printSurfacesProposeResult(result: ProposeSurfacesResult): void {
  console.log(
    panel(result.overwritten ? "surfaces regenerated" : "surfaces proposed", [
      ...kv([
        ["campaign", result.campaignId],
        ["path", result.path],
        ["cards", String(result.list.cards.length)],
        ["next", cmd(result.nextAction)],
      ]),
      "",
      section("attack surface cards"),
      ...result.list.cards.map(
        (card) => `  [${card.status}] ${card.id}  (${card.vulnerability_class})  ${card.title}`,
      ),
    ]),
  );
}

export function printSurfacesShowResult(result: ShowSurfacesResult): void {
  if (!result.list) {
    console.log(
      panel("surfaces", [
        ...kv([
          ["campaign", result.campaignId],
          ["path", result.path],
          ["status", "missing"],
          ["next", cmd(result.nextAction)],
        ]),
      ]),
    );
    return;
  }
  console.log(
    panel("surfaces", [
      ...kv([
        ["campaign", result.campaignId],
        ["path", result.path],
        ["cards", String(result.list.cards.length)],
        ["selected", String(result.list.cards.filter((card) => card.status === "selected").length)],
        ["next", cmd(result.nextAction)],
      ]),
      "",
      section("attack surface cards"),
      ...result.list.cards.map(
        (card) => `  [${card.status}] ${card.id}  (${card.vulnerability_class})  → ${card.finding_id}`,
      ),
    ]),
  );
}

export function printSurfacesSelectResult(result: SelectSurfacesResult): void {
  console.log(
    panel("surfaces selected", [
      ...kv([
        ["campaign", result.campaignId],
        ["selected", result.selected.join(", ") || "(none)"],
        ["skipped", String(result.skipped.length)],
        ["next", cmd(result.nextAction)],
      ]),
    ]),
  );
}

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
    ...result.installedAgents.map((name) => [statusIcon("installed"), `agent:${name}`, outcomeBadge("installed"), "copied into agents directory"]),
    ...result.skipped.map((name) => [statusIcon("skipped"), name, outcomeBadge("skipped"), "already installed; use --force to overwrite"]),
    ...result.errors.map((message) => [statusIcon("error"), "-", outcomeBadge("error"), message]),
  ];
  if (rows.length > 0) {
    console.log(table(["", "skill", "state", "detail"], rows));
  }
}

export function printUninstallResult(result: UninstallResult): void {
  const total = result.removed.length + result.notFound.length + result.errors.length;
  const summary = result.errors.length > 0
    ? `${result.errors.length} error(s), ${result.removed.length}/${total} removed`
    : `${result.removed.length}/${total} skill(s) removed`;
  const next = result.errors.length > 0 ? "omv doctor" : "omv setup";
  const finalState = result.errors.length > 0
    ? "error"
    : result.removed.length === 0 && result.notFound.length === 0
      ? "skipped"
      : "pass";

  console.log(title("oh-my-vul uninstall"));
  console.log(
    panel("uninstall summary", [
      ...kv([
        ["scope", result.scope],
        ["skills dir", result.skillsDir],
        ["result", outcomeBadge(finalState)],
        ["skills", summary],
        ["manifest", result.manifestRemoved ? "removed" : "not found"],
        ...(result.scope === "project"
          ? [["setup scope", result.setupScopeRemoved ? "removed" : "not found"]] as [string, string][]
          : []),
        ["next", cmd(next)],
      ]),
    ]),
  );

  const rows = [
    ...result.removed.map((name) => [statusIcon("installed"), name, outcomeBadge("pass"), "removed from skills directory"]),
    ...result.notFound.map((name) => [statusIcon("skipped"), name, outcomeBadge("skipped"), "not found in skills directory"]),
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
      ? result.checks.find((item) => item.status === "warn" && item.remediation)?.remediation ?? "omv dashboard"
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
  campaigns: CampaignSummary[],
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
        ["campaigns", String(campaigns.length)],
        ["next", workflow[0]
          ? cmd(renderedAction(workflow[0].action))
          : campaigns[0]
            ? cmd(`CLI  ${campaigns[0].nextAction}`)
            : cmd("CLI  omv start")],
      ]),
      ...status.warnings.map((item) => warn(`warning  ${item}`)),
    ]),
  );

  if (workflow.length === 0) {
    if (campaigns[0]) {
      console.log(empty(`No active findings. Continue campaign ${campaigns[0].id}: ${campaigns[0].nextAction}`));
    } else {
      console.log(empty("No campaign yet. Run omv start to create a guided research plan."));
    }
  } else {
    console.log(
      table(
        ["id", "status", "evidence", "submission", "verdict", "blocker", "run"],
        workflow.slice(0, 8).map((finding) => [
          truncate(finding.id, 30),
          statusBadge(finding.status),
          readiness(finding.evidenceScore),
          readiness(finding.submissionScore),
          truncate(finding.verdict.exploitability, 14),
          truncate(finding.blockers[0] ?? finding.priorityReason, 30),
          cmd(truncate(renderedAction(finding.action), 54)),
        ]),
      ),
    );
    const truncatedActions = workflow
      .slice(0, 8)
      .filter((finding) => renderedAction(finding.action).length > 54);
    if (truncatedActions.length > 0) {
      console.log(panel("full next actions", truncatedActions.map((finding) => `${finding.id}: ${cmd(renderedAction(finding.action))}`)));
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

export function printWelcome(): void {
  console.log(title("oh-my-vul"));
  console.log(
    panel("start here", [
      "Evidence-first vulnerability research for Claude Code.",
      "",
      ...kv([
        ["start", cmd("omv start")],
        ["check", cmd("omv doctor")],
        ["help", cmd("omv help")],
      ]),
      "",
      muted("No workspace changes were made."),
    ]),
  );
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
      ["id", "priority", "status", "evidence", "submission", "run", "package", "vulnerability"],
      findings.map((finding) => [
        truncate(finding.id, 30),
        String(finding.priority),
        statusBadge(finding.status),
        readiness(finding.evidenceScore),
        readiness(finding.submissionScore),
        cmd(truncate(renderedAction(finding.action), 46)),
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
  lines.push(...kv([["next", cmd(renderedAction(finding.action))]]));
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
  if (finding.threatMap) {
    lines.push("", muted("threat map"));
    if (finding.threatMap.rendered.length > 0) {
      lines.push(...finding.threatMap.rendered.slice(0, 8).map((item) => `  ${item}`));
      if (finding.threatMap.rendered.length > 8) {
        lines.push(muted(`  ... ${finding.threatMap.rendered.length - 8} more graph line(s)`));
      }
    } else {
      lines.push("  no graph paths rendered");
    }
    for (const item of finding.threatMap.validation.errors.slice(0, 4)) {
      lines.push(`  ${tuiError(`error: ${item}`)}`);
    }
    for (const item of finding.threatMap.validation.warnings.slice(0, 4)) {
      lines.push(`  ${warn(`warning: ${item}`)}`);
    }
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
    ["strict verification", result.strictVerification ? "enabled" : "disabled"],
    ["verification", result.verification ? `${result.verification.status}${result.verification.stale ? " (stale)" : ""}` : "not checked"],
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

export function printFindingReview(result: FindingReview): void {
  console.log(title(`finding review ${result.id}`));
  const state = result.verdict === "ready" ? "pass" : result.verdict === "blocked" ? "fail" : "warn";
  const lines = kv([
    ["verdict", outcomeBadge(state)],
    ["reason", result.verdict],
    ["summary", result.summary],
    ["status", statusBadge(result.doctor.status)],
    ["evidence", readiness(result.doctor.evidenceScore)],
    ["submission", readiness(result.doctor.submissionScore)],
    ["strict", result.strict ? "enabled" : "disabled"],
    ["verification", result.doctor.verification ? `${result.doctor.verification.status}${result.doctor.verification.stale ? " (stale)" : ""}` : "not checked"],
    ["report ready", result.reportReady ? outcomeBadge("pass") : outcomeBadge("fail")],
    ["next", cmd(result.nextAction)],
  ]);
  if (result.blockers.length > 0) {
    lines.push("", tuiError("blockers"));
    lines.push(...result.blockers.map((item) => `  ${item}`));
  }
  if (result.warnings.length > 0) {
    lines.push("", warn("warnings"));
    lines.push(...result.warnings.slice(0, 8).map((item) => `  ${item}`));
    if (result.warnings.length > 8) {
      lines.push(muted(`  ... ${result.warnings.length - 8} more warning(s)`));
    }
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
    ["provenance", result.provenanceManifestExists
      ? result.provenanceFresh === true ? "fresh" : "stale or invalid"
      : "missing"],
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

export function printSourceRefInitResult(result: SourceRefInitResult): void {
  console.log(
    panel(result.overwritten ? "source reference updated" : "source reference created", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["finding", result.findingPath],
        ["sources", String(result.sourceRef.sources.length)],
      ]),
      ...result.warnings.map((message) => warn(`warning  ${message}`)),
    ]),
  );
}

export function printSourceRefDetail(result: SourceRefValidation): void {
  console.log(
    panel("source reference", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["finding", result.findingPath],
        ["state", result.stale ? outcomeBadge("warn") : outcomeBadge("pass")],
        ["sources", String(result.sourceRef.sources.length)],
      ]),
      ...result.sourceRef.sources.map((source) => `  ${source.kind}  ${source.locator}`),
      ...result.warnings.map((message) => warn(`warning  ${message}`)),
    ]),
  );
}

export function printReportProvenanceResult(result: ReportProvenanceResult): void {
  console.log(
    panel(result.overwritten ? "report provenance updated" : "report provenance created", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["inputs", String(result.manifest.inputs.length)],
        ["next", cmd(`omv report artifacts ${result.id}`)],
      ]),
      ...result.warnings.map((message) => warn(`warning  ${message}`)),
    ]),
  );
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

export function printDeleteResult(result: FindingDeleteResult): void {
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

function formatCheckDetail(check: Check): string {
  return `${statusIcon(check.status)} ${check.name}: ${check.message}${check.remediation ? ` -> ${cmd(check.remediation)}` : ""}`;
}
