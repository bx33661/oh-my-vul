import { existsSync } from "fs";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "fs/promises";
import { basename, isAbsolute, join, relative } from "path";
import { parse as parseYaml, parseDocument } from "yaml";
import { archivedFindingsDir, findingReportsDir, findingReproDir, findingsDir, packageRoot, threatMapPath, threatMapsDir } from "./paths.js";
import { readSubmissions, type SubmissionRecord } from "./submissions.js";
import {
  appendWorkspaceActivity,
  ensureWorkspaceDirs,
  readArchiveMetadata,
  readWorkspaceIndex,
  rebuildWorkspaceIndex,
  removeWorkspaceFinding,
  touchWorkspaceFinding,
  writeArchiveMetadata,
} from "./workspace.js";
import { rm } from "fs/promises";
import {
  classifyWarning,
  dedupeIssues,
  extractFieldRefs,
  warningNextAction,
  workflowBlockers,
  workflowMissingFields,
  workflowNextAction,
  workflowPriority,
  workflowPriorityReason,
} from "./workflow.js";

export type EvidenceStatus = "candidate" | "confirmed" | "blocked";

export interface FindingSummary {
  id: string;
  path: string;
  status: string;
  ecosystem: string;
  package: string;
  vulnerability: string;
  readiness: number;
  evidenceScore: number;
  submissionScore: number;
  verdict: FindingVerdict;
  reproArtifacts: string[];
}

export interface FindingValidation {
  id: string;
  path: string;
  ok: boolean;
  status: string;
  readiness: number;
  evidenceScore: number;
  submissionScore: number;
  errors: string[];
  warnings: string[];
}

export interface FindingWorkflowSummary extends FindingSummary {
  nextAction: string;
  missingFields: string[];
  blockers: string[];
  priority: number;
  priorityReason: string;
}

export interface FindingDetail extends FindingWorkflowSummary {
  archived: boolean;
  validation: FindingValidation;
  threatMap?: FindingThreatMap;
  archivedAt?: string;
  archiveReason?: string;
}

export interface ArchivedFindingSummary extends FindingSummary {
  archivedAt: string;
  archiveReason: string;
}

export interface FindingArchiveResult {
  id: string;
  from: string;
  to: string;
  status: string;
  archiveReason: string;
  archivedAt: string;
  warnings: string[];
  reportArtifactPaths: string[];
  submissionRecords: SubmissionRecord[];
}

export interface FindingRestoreResult {
  id: string;
  from: string;
  to: string;
  status: string;
}

export interface FindingDeleteResult {
  id: string;
  deleted: boolean;
  paths: string[];
  errors: string[];
}

export interface FindingTemplateResult {
  id: string;
  path: string;
  status: EvidenceStatus;
  created: boolean;
}

export interface ReproInitResult {
  id: string;
  path: string;
  findingPath: string;
  artifacts: string[];
  written: string[];
  skipped: string[];
  updatedFinding: boolean;
}

export interface ReportArtifactsResult {
  id: string;
  status: string;
  reportsDir: string;
  reproDir: string;
  reportArtifactPaths: string[];
  emptyReportArtifactPaths: string[];
  listedReproArtifacts: string[];
  existingReproArtifacts: string[];
  missingReproArtifacts: string[];
  errors: string[];
  warnings: string[];
}

export interface FindingDoctorIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  fields: string[];
  nextAction: string;
}

export interface FindingDoctorResult {
  id: string;
  path: string;
  status: string;
  evidenceScore: number;
  submissionScore: number;
  submissionThreshold: number;
  validationOk: boolean;
  reportReady: boolean;
  nextAction: string;
  issues: FindingDoctorIssue[];
  validation: FindingValidation;
  artifacts: ReportArtifactsResult;
}

export interface FindingVerdict {
  exploitability: string;
  confidence: string;
  reason: string;
}

export interface FindingThreatMap {
  path: string;
  rendered: string[];
}

export interface CreateFindingTemplateOptions {
  status?: EvidenceStatus;
  force?: boolean;
  projectRoot?: string;
}

const VALID_STATUSES = new Set<EvidenceStatus>(["candidate", "confirmed", "blocked"]);
const FINDING_EXTENSIONS = new Set([".yaml", ".yml"]);
const VALID_ECOSYSTEMS = new Set([
  "npm",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "php",
  "csharp",
  "swift",
  "dart",
  "elixir",
  "perl",
  "r",
  "lua",
]);
const VALID_SEVERITIES = new Set(["Critical", "High", "Medium", "Low", "None", "unknown"]);
const VALID_ATTACK_VECTORS = new Set(["Network", "Local", "Physical", "Adjacent", "unknown"]);
const VALID_TRI_STATE = new Set(["true", "false", "unknown"]);
const VALID_IMPACT_VALUES = new Set(["High", "Low", "None", "unknown"]);
const VALID_EXPLOITABILITY = new Set(["proven", "plausible", "blocked", "disproven", "unknown"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low", "unknown"]);
const REQUIRED_CONFIRMED_FIELDS = [
  "versions.tested",
  "evidence.source",
  "evidence.sink",
  "evidence.guard",
  "evidence.reproducer",
  "evidence.observed_result",
  "cvss.vector",
];
const UNKNOWN_ACCOUNTING_FIELDS = [
  "versions.tested",
  "versions.affected_range",
  "versions.fixed",
  "evidence.source",
  "evidence.sink",
  "evidence.guard",
  "evidence.reproducer",
  "evidence.observed_result",
  "cvss.vector",
  "cvss.score",
  "cvss.severity",
  "impact.attack_vector",
  "impact.authentication_required",
  "impact.user_interaction_required",
  "impact.scope_changed",
  "impact.confidentiality",
  "impact.integrity",
  "impact.availability",
  "dedup.existing_cve",
  "dedup.notes",
  "disclosure.contact_date",
  "disclosure.vendor_response",
  "disclosure.planned_disclosure_date",
  "verdict.exploitability",
  "verdict.confidence",
  "verdict.reason",
];
const SUBMISSION_READY_THRESHOLD = 75;
const SUBMISSION_DEDUCTIONS = {
  missingObservedResult: 25,
  unresolvedBlockers: 30,
  unknownAffectedRange: 10,
  incompleteDedup: 15,
  blockedOrDisproven: 50,
  plausibleExploitability: 10,
  confirmedBelowThreshold: 10,
  missingReproArtifacts: 10,
} as const;

interface SubmissionDeduction {
  id: keyof typeof SUBMISSION_DEDUCTIONS;
  points: number;
  message: string;
  fields: string[];
  nextAction: string;
}

export async function listFindings(projectRoot = process.cwd()): Promise<FindingSummary[]> {
  const dir = findingsDir(projectRoot);
  const files = await listFindingFiles(dir);
  const summaries: FindingSummary[] = [];

  for (const file of files) {
    const path = join(dir, file);
    summaries.push(await readFindingSummary(path, findingIdFromFile(file)));
  }

  return summaries.sort((left, right) => left.id.localeCompare(right.id));
}

export async function listFindingWorkflow(projectRoot = process.cwd()): Promise<FindingWorkflowSummary[]> {
  const findings = await listFindings(projectRoot);
  const summaries = await Promise.all(
    findings.map(async (finding) => {
      const validation = await validateFinding(finding.id, projectRoot);
      const missingFields = workflowMissingFields(validation);
      const blockers = workflowBlockers(validation);
      const nextAction = workflowNextAction(finding, validation, missingFields);
      const priority = workflowPriority(finding, validation, missingFields, nextAction);
      return {
        ...finding,
        nextAction,
        missingFields,
        blockers,
        priority,
        priorityReason: workflowPriorityReason(priority, nextAction),
      };
    }),
  );
  return summaries.sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
}

export async function showFinding(
  target: string,
  projectRoot = process.cwd(),
  options: { archived?: boolean } = {},
): Promise<FindingDetail> {
  const archived = options.archived ?? false;
  const id = normalizeFindingId(target);
  const path = archived ? join(archivedFindingsDir(projectRoot), `${id}.yaml`) : resolveFindingPath(id, projectRoot);
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist`);
  }
  const summary = await readFindingSummary(path, id);
  const validation = archived ? await validateFinding(path, projectRoot) : await validateFinding(id, projectRoot);
  const missingFields = workflowMissingFields(validation);
  const metadata = archived ? await readArchiveMetadata(id, projectRoot) : undefined;
  const threatMap = await readThreatMap(id, projectRoot);
  return {
    ...summary,
    archived,
    validation,
    threatMap,
    missingFields,
    blockers: workflowBlockers(validation),
    nextAction: archived ? `omv findings restore ${id}` : workflowNextAction(summary, validation, missingFields),
    priority: archived ? 0 : workflowPriority(summary, validation, missingFields, workflowNextAction(summary, validation, missingFields)),
    priorityReason: archived ? "archived" : workflowPriorityReason(
      workflowPriority(summary, validation, missingFields, workflowNextAction(summary, validation, missingFields)),
      workflowNextAction(summary, validation, missingFields),
    ),
    archivedAt: metadata?.archivedAt,
    archiveReason: metadata?.archiveReason,
  };
}

export async function validateFinding(target: string, projectRoot = process.cwd()): Promise<FindingValidation> {
  const path = resolveFindingPath(target, projectRoot);
  const text = await readFile(path, "utf-8");
  const parseResult = parseEvidenceYaml(text);
  const parsed = parseResult.data;
  const status = getString(parsed, "status");
  const errors: string[] = [];
  const warnings: string[] = [];

  errors.push(...parseResult.errors);
  validateEvidenceData(parsed, status, errors, warnings, projectRoot);

  const evidenceScore = computeEvidenceScore(parsed);
  const submissionScore = computeSubmissionScore(parsed, status, projectRoot);

  return {
    id: findingIdFromFile(path),
    path,
    ok: errors.length === 0,
    status: status || "unknown",
    readiness: evidenceScore,
    evidenceScore,
    submissionScore,
    errors,
    warnings,
  };
}

function validateEvidenceData(
  parsed: Record<string, unknown>,
  status: string,
  errors: string[],
  warnings: string[],
  projectRoot: string,
): void {
  if (getString(parsed, "schema_version") !== "1") {
    errors.push("schema_version must be 1");
  }
  if (getString(parsed, "handoff_version") !== "1.0") {
    errors.push("handoff_version must be 1.0");
  }
  if (!VALID_STATUSES.has(status as EvidenceStatus)) {
    errors.push("status must be candidate, confirmed, or blocked");
  }
  const ecosystem = getString(parsed, "package.ecosystem");
  if (!ecosystem) {
    errors.push("package.ecosystem is required");
  } else if (!VALID_ECOSYSTEMS.has(ecosystem)) {
    errors.push(`package.ecosystem must be one of: ${Array.from(VALID_ECOSYSTEMS).join(", ")}`);
  }
  if (!getString(parsed, "package.registry_name") && !getString(parsed, "package.product")) {
    errors.push("package.registry_name or package.product is required");
  }
  requireUrl(parsed, errors, "package.repository_url");
  requireCwe(parsed, errors, "vulnerability.cwe");
  requireCvssVector(parsed, errors, "cvss.vector");
  requireEnum(parsed, errors, "cvss.severity", VALID_SEVERITIES);
  requireEnum(parsed, errors, "impact.attack_vector", VALID_ATTACK_VECTORS);
  requireTriState(parsed, errors, "impact.authentication_required");
  requireTriState(parsed, errors, "impact.user_interaction_required");
  requireTriState(parsed, errors, "impact.scope_changed");
  requireEnum(parsed, errors, "impact.confidentiality", VALID_IMPACT_VALUES);
  requireEnum(parsed, errors, "impact.integrity", VALID_IMPACT_VALUES);
  requireEnum(parsed, errors, "impact.availability", VALID_IMPACT_VALUES);
  requireEnum(parsed, errors, "verdict.exploitability", VALID_EXPLOITABILITY);
  requireEnum(parsed, errors, "verdict.confidence", VALID_CONFIDENCE);
  requireDate(parsed, errors, "disclosure.contact_date");
  requireDate(parsed, errors, "disclosure.planned_disclosure_date");
  requireDate(parsed, errors, "provenance.verification_date");

  const readiness = computeEvidenceScore(parsed);

  if (status === "confirmed") {
    for (const path of REQUIRED_CONFIRMED_FIELDS) {
      requireKnown(parsed, errors, path);
    }
    requireKnown(parsed, errors, "evidence.reproducer", { rejectNone: true });
    requireTraceableEvidence(parsed, errors, "evidence.source");
    requireTraceableEvidence(parsed, errors, "evidence.sink");
    requireTraceableGuard(parsed, errors);
    if (
      !getBoolean(parsed, "dedup.nvd_searched") ||
      !getBoolean(parsed, "dedup.ghsa_searched") ||
      !getBoolean(parsed, "dedup.ecosystem_db_searched")
    ) {
      errors.push("dedup search must be complete for confirmed findings");
    }
    if (readiness < 75) {
      errors.push(`readiness ${readiness}/100 is below submission-ready threshold 75`);
    }
  }

  if (status === "blocked" && getList(parsed, "blockers").length === 0) {
    errors.push("blocked findings must include at least one blocker");
  }

  addEvidenceQualityWarnings(parsed, status, warnings, projectRoot);
  if (!getString(parsed, "provenance.verification_date")) {
    warnings.push("provenance.verification_date is empty");
  }
  if (
    !getBoolean(parsed, "dedup.nvd_searched") ||
    !getBoolean(parsed, "dedup.ghsa_searched") ||
    !getBoolean(parsed, "dedup.ecosystem_db_searched")
  ) {
    warnings.push("dedup search is incomplete");
  }
  validateUnknownAccounting(parsed, status, errors, warnings);
}

export async function validateFindings(projectRoot = process.cwd()): Promise<FindingValidation[]> {
  const dir = findingsDir(projectRoot);
  const files = await listFindingFiles(dir);
  return Promise.all(files.map((file) => validateFinding(join(dir, file), projectRoot)));
}

export async function initReproArtifacts(
  target: string,
  projectRoot = process.cwd(),
  options: { force?: boolean } = {},
): Promise<ReproInitResult> {
  const id = normalizeFindingId(target);
  const findingPath = resolveFindingPath(id, projectRoot);
  if (!existsSync(findingPath)) {
    throw new Error(`${findingPath} does not exist`);
  }

  const dir = findingReproDir(id, projectRoot);
  await mkdir(join(dir, "screenshots"), { recursive: true });
  const templates = new Map<string, string>([
    ["README.md", reproReadmeTemplate(id)],
    ["commands.sh", "#!/usr/bin/env bash\nset -euo pipefail\n\n# Record the exact local reproduction commands here.\n"],
    ["observed.txt", "Record observed local output here. Do not infer this from the reproducer text.\n"],
    ["docker-compose.yml", "services: {}\n"],
  ]);
  const written: string[] = [];
  const skipped: string[] = [];

  for (const [name, content] of templates) {
    const path = join(dir, name);
    const shouldWrite = options.force || !existsSync(path) || (await stat(path)).size === 0;
    if (shouldWrite) {
      await writeFile(path, content, "utf-8");
      written.push(path);
    } else {
      skipped.push(path);
    }
  }

  const artifacts = [
    `.omv/repro/${id}/README.md`,
    `.omv/repro/${id}/commands.sh`,
    `.omv/repro/${id}/observed.txt`,
    `.omv/repro/${id}/docker-compose.yml`,
    `.omv/repro/${id}/screenshots/`,
  ];
  const updatedFinding = await mergeReproArtifacts(findingPath, artifacts);
  await appendWorkspaceActivity({ action: "repro.init", id, path: dir }, projectRoot);

  return { id, path: dir, findingPath, artifacts, written, skipped, updatedFinding };
}

export interface ThreatMapWriteResult {
  id: string;
  path: string;
  findingPath: string;
  written: boolean;
  skipped: boolean;
}

export async function writeThreatMap(
  target: string,
  projectRoot = process.cwd(),
  options: { force?: boolean } = {},
): Promise<ThreatMapWriteResult> {
  const id = normalizeFindingId(target);
  const findingPath = resolveFindingPath(id, projectRoot);
  if (!existsSync(findingPath)) {
    throw new Error(`${findingPath} does not exist`);
  }

  const dir = threatMapsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const path = threatMapPath(id, projectRoot);

  const shouldWrite = options.force || !existsSync(path) || (await stat(path)).size === 0;
  if (shouldWrite) {
    const { data } = await readEvidence(findingPath);
    await writeFile(path, threatMapTemplate(id, data), "utf-8");
    await appendWorkspaceActivity({ action: "threatmap.write", id, path }, projectRoot);
    return { id, path, findingPath, written: true, skipped: false };
  }

  return { id, path, findingPath, written: false, skipped: true };
}

function threatMapTemplate(id: string, finding: Record<string, unknown>): string {
  const ecosystem = getString(finding, "package.ecosystem") || "";
  const registryName = getString(finding, "package.registry_name") || getString(finding, "package.product") || "";
  const repositoryUrl = getString(finding, "package.repository_url") || "";
  const versionAnalyzed = getString(finding, "versions.tested") || "";
  return `# ThreatMap.v1 sidecar for ${id}
# Produced by: omv threat-map init + omv-audit
# Consumed by: omv findings show, omv-critic, omv-report
# Schema: ../../contracts/threat-map.v1.yaml
schema_version: "1"

finding_id: "${id}"
package:
  ecosystem: "${ecosystem}"
  registry_name: "${registryName}"
  repository_url: "${repositoryUrl}"
  version_analyzed: "${versionAnalyzed}"

# One entry per discovered source-to-sink path.
paths: []
#   - id: 1
#     source:
#       type: user_input | file | network | env | config
#       location: ""
#       description: ""
#     transforms:
#       - type: parse | decode | normalize | validate | authorize | other
#         location: ""
#         description: ""
#     sink:
#       type: fs_write | exec | eval | html_render | sql | network_req
#       location: ""
#       description: ""
#     guard:
#       present: false
#       description: ""
#       bypassable: true
#     confidence: high   # high | medium | low
#     notes: ""

summary:
  path_count: 0
  confirmed_paths: 0
  highest_confidence: unknown
  vuln_classes: []
  notes: ""

provenance:
  analysis_date: ""
  tool: manual
  tool_version: unknown
  analyst: ""
`;
}

export async function doctorFinding(target: string, projectRoot = process.cwd()): Promise<FindingDoctorResult> {
  const path = resolveFindingPath(target, projectRoot);
  const id = findingIdFromFile(path);
  const validation = await validateFinding(path, projectRoot);
  const summary = await readFindingSummary(path, id);
  const parsed = (await readEvidence(path)).data;
  const artifacts = await checkReportArtifacts(id, projectRoot);
  const missingFields = workflowMissingFields(validation);
  const nextAction = workflowNextAction(summary, validation, missingFields);
  const issues: FindingDoctorIssue[] = [];

  issues.push(...validation.errors.map((message) => ({
    id: "validation-error",
    severity: "error" as const,
    message,
    fields: extractFieldRefs(message),
    nextAction: `omv findings open ${id}`,
  })));
  issues.push(...validation.warnings.map((message) => ({
    id: classifyWarning(message),
    severity: "warning" as const,
    message,
    fields: extractFieldRefs(message),
    nextAction: warningNextAction(message, id),
  })));
  issues.push(...submissionDeductions(parsed, validation.status, projectRoot).map((deduction) => ({
    id: deduction.id,
    severity: deduction.points >= 25 ? "error" as const : "warning" as const,
    message: `${deduction.message} (-${deduction.points})`,
    fields: deduction.fields,
    nextAction: deduction.nextAction.replace("<id>", id),
  })));
  issues.push(...artifacts.errors.map((message) => ({
    id: "report-artifact-error",
    severity: "error" as const,
    message,
    fields: ["evidence.repro_artifacts"],
    nextAction: `omv report artifacts ${id}`,
  })));
  issues.push(...artifacts.warnings.map((message) => ({
    id: "report-artifact-warning",
    severity: "warning" as const,
    message,
    fields: ["evidence.repro_artifacts"],
    nextAction: `omv report artifacts ${id}`,
  })));

  const dedupedIssues = dedupeIssues(issues);
  const reportReady = validation.ok && validation.status === "confirmed" && validation.submissionScore >= SUBMISSION_READY_THRESHOLD;
  return {
    id,
    path,
    status: validation.status,
    evidenceScore: validation.evidenceScore,
    submissionScore: validation.submissionScore,
    submissionThreshold: SUBMISSION_READY_THRESHOLD,
    validationOk: validation.ok,
    reportReady,
    nextAction: reportReady ? `/omv-report ${id}` : nextAction,
    issues: dedupedIssues,
    validation,
    artifacts,
  };
}

export async function checkReportArtifacts(id: string, projectRoot = process.cwd()): Promise<ReportArtifactsResult> {
  const normalizedId = normalizeFindingId(id);
  const findingPath = resolveFindingPath(normalizedId, projectRoot);
  if (!existsSync(findingPath)) {
    throw new Error(`${findingPath} does not exist`);
  }
  const parsed = (await readEvidence(findingPath)).data;
  const status = getString(parsed, "status") || "unknown";
  const reportsPath = findingReportsDir(normalizedId, projectRoot);
  const reproPath = findingReproDir(normalizedId, projectRoot);
  const listedReproArtifacts = getList(parsed, "evidence.repro_artifacts").map(String).filter((value) => value.trim() !== "");
  const existingReproArtifacts = existingArtifactPaths(listedReproArtifacts, projectRoot);
  const missingReproArtifacts = listedReproArtifacts.filter((value) => !artifactExists(value, projectRoot));
  const reportArtifactPaths = await listReportArtifacts(normalizedId, projectRoot);
  const emptyReportArtifactPaths = await listEmptyReportArtifacts(reportsPath);
  const errors: string[] = [];
  const warnings: string[] = [];
  const strictMissing = status === "confirmed";
  const addMissing = (message: string) => (strictMissing ? errors : warnings).push(message);

  if (!existsSync(reportsPath)) {
    addMissing(`no report artifacts found under ${reportsPath} (directory missing)`);
  } else if (reportArtifactPaths.length === 0) {
    addMissing(`no non-empty report artifacts found under ${reportsPath}`);
  }
  for (const path of emptyReportArtifactPaths) {
    addMissing(`report artifact is empty: ${path}`);
  }
  if (listedReproArtifacts.length > 0 && !existsSync(reproPath)) {
    addMissing(`reproduction artifact directory is missing: ${reproPath}`);
  }
  for (const path of missingReproArtifacts) {
    addMissing(`Evidence.v1 references a missing reproduction artifact: ${path}`);
  }

  return {
    id: normalizedId,
    status,
    reportsDir: reportsPath,
    reproDir: reproPath,
    reportArtifactPaths,
    emptyReportArtifactPaths,
    listedReproArtifacts,
    existingReproArtifacts,
    missingReproArtifacts,
    errors,
    warnings,
  };
}

export async function createFindingTemplate(
  id: string,
  options: CreateFindingTemplateOptions = {},
): Promise<FindingTemplateResult> {
  const status = options.status ?? "candidate";
  if (!VALID_STATUSES.has(status)) {
    throw new Error("status must be candidate, confirmed, or blocked");
  }

  const normalizedId = normalizeFindingId(id);
  const projectRoot = options.projectRoot ?? process.cwd();
  const dir = await ensureFindingsDir(projectRoot);
  const path = join(dir, `${normalizedId}.yaml`);

  if (existsSync(path) && !options.force) {
    throw new Error(`${path} already exists; use --force to overwrite`);
  }

  const template = await readFindingTemplate(status);
  await writeFile(path, template, "utf-8");
  await touchWorkspaceFinding(normalizedId, status, projectRoot);
  await appendWorkspaceActivity({ action: "finding.init", id: normalizedId, status, path }, projectRoot);
  return { id: normalizedId, path, status, created: true };
}

export async function promoteFinding(
  target: string,
  status: EvidenceStatus,
  projectRoot = process.cwd(),
): Promise<FindingValidation> {
  if (!VALID_STATUSES.has(status)) {
    throw new Error("status must be candidate, confirmed, or blocked");
  }

  const path = resolveFindingPath(target, projectRoot);
  const text = await readFile(path, "utf-8");
  const parseResult = parseEvidenceYaml(text);
  const errors = [...parseResult.errors];
  const warnings: string[] = [];
  const previousStatus = getString(parseResult.data, "status");
  parseResult.data.status = status;
  validateEvidenceData(parseResult.data, status, errors, warnings, projectRoot);
  if (errors.length > 0) {
    const evidenceScore = computeEvidenceScore(parseResult.data);
    return {
      id: findingIdFromFile(path),
      path,
      ok: false,
      status: previousStatus || "unknown",
      readiness: evidenceScore,
      evidenceScore,
      submissionScore: computeSubmissionScore(parseResult.data, previousStatus || "unknown", projectRoot),
      errors,
      warnings,
    };
  }
  const updated = text.match(/^status:\s*.*$/m)
    ? text.replace(/^status:\s*.*$/m, `status: ${status}`)
    : `${text.trimEnd()}\nstatus: ${status}\n`;
  await writeFile(path, updated, "utf-8");
  await touchWorkspaceFinding(findingIdFromFile(path), status, projectRoot);
  await appendWorkspaceActivity({ action: "finding.promote", id: findingIdFromFile(path), status, path }, projectRoot);
  return validateFinding(path, projectRoot);
}

export async function archiveFinding(
  target: string,
  reason: string,
  projectRoot = process.cwd(),
  options: { force?: boolean; strict?: boolean } = {},
): Promise<FindingArchiveResult> {
  const trimmedReason = reason.trim();
  if (!trimmedReason) {
    throw new Error("--reason is required to archive a finding");
  }
  await ensureWorkspaceDirs(projectRoot);
  const from = resolveFindingPath(target, projectRoot);
  if (!existsSync(from)) {
    throw new Error(`${from} does not exist`);
  }
  const id = findingIdFromFile(from);
  const to = join(archivedFindingsDir(projectRoot), `${id}.yaml`);
  if (existsSync(to) && !options.force) {
    throw new Error(`${to} already exists; use --force to overwrite`);
  }
  const status = getString(parseEvidenceYaml(await readFile(from, "utf-8")).data, "status") || "unknown";
  const artifactCheck = await checkReportArtifacts(id, projectRoot);
  const reportArtifactPaths = artifactCheck.reportArtifactPaths;
  const submissionRecords = (await readSubmissions(id, projectRoot)).records;
  const warnings: string[] = [];
  if (trimmedReason === "reported" && status === "confirmed" && artifactCheck.errors.length > 0) {
    const warning = artifactCheck.errors.join("; ");
    if (options.strict) {
      throw new Error(`${warning}; create report artifacts or archive with a different reason`);
    }
    warnings.push(...artifactCheck.errors);
  }
  await rename(from, to);
  const archivedAt = new Date().toISOString();
  await writeArchiveMetadata(
    { id, status, archivedAt, archiveReason: trimmedReason, sourcePath: from, archivePath: to, reportArtifactPaths },
    projectRoot,
  );
  await removeWorkspaceFinding(id, false, projectRoot);
  await touchWorkspaceFinding(id, status, projectRoot, { archived: true, archiveReason: trimmedReason, archivedAt });
  await appendWorkspaceActivity(
    { action: "finding.archive", id, status, archived: true, reason: trimmedReason, from, to },
    projectRoot,
  );
  return { id, from, to, status, archiveReason: trimmedReason, archivedAt, warnings, reportArtifactPaths, submissionRecords };
}

export async function listArchivedFindings(projectRoot = process.cwd()): Promise<ArchivedFindingSummary[]> {
  await ensureWorkspaceDirs(projectRoot);
  const index = existsSync(join(projectRoot, ".omv", "index.json"))
    ? await readWorkspaceIndex(projectRoot)
    : await rebuildWorkspaceIndex(projectRoot);
  const metadata = new Map(index.findings.filter((entry) => entry.archived).map((entry) => [entry.id, entry]));
  const dir = archivedFindingsDir(projectRoot);
  const files = await listFindingFiles(dir);
  const summaries: ArchivedFindingSummary[] = [];
  for (const file of files) {
    const id = findingIdFromFile(file);
    const summary = await readFindingSummary(join(dir, file), id);
    const sidecar = await readArchiveMetadata(id, projectRoot);
    const archived = metadata.get(id);
    summaries.push({
      ...summary,
      archivedAt: sidecar?.archivedAt ?? archived?.archivedAt ?? "unknown",
      archiveReason: sidecar?.archiveReason ?? archived?.archiveReason ?? "unknown",
    });
  }
  return summaries.sort((left, right) => left.id.localeCompare(right.id));
}

export async function restoreFinding(
  target: string,
  projectRoot = process.cwd(),
  options: { force?: boolean } = {},
): Promise<FindingRestoreResult> {
  await ensureWorkspaceDirs(projectRoot);
  const id = normalizeFindingId(target);
  const from = join(archivedFindingsDir(projectRoot), `${id}.yaml`);
  const to = join(findingsDir(projectRoot), `${id}.yaml`);
  if (!existsSync(from)) {
    throw new Error(`${from} does not exist`);
  }
  if (existsSync(to) && !options.force) {
    throw new Error(`${to} already exists; use --force to overwrite`);
  }
  const status = getString(parseEvidenceYaml(await readFile(from, "utf-8")).data, "status") || "unknown";
  await rename(from, to);
  await removeWorkspaceFinding(id, true, projectRoot);
  await touchWorkspaceFinding(id, status, projectRoot);
  await appendWorkspaceActivity({ action: "finding.restore", id, status, archived: false, from, to }, projectRoot);
  return { id, from, to, status };
}

export async function deleteFinding(
  target: string,
  projectRoot = process.cwd(),
  options: { force?: boolean } = {},
): Promise<FindingDeleteResult> {
  await ensureWorkspaceDirs(projectRoot);
  const id = normalizeFindingId(target);

  const activePath = join(findingsDir(projectRoot), `${id}.yaml`);
  const archivedPath = join(archivedFindingsDir(projectRoot), `${id}.yaml`);

  let yamlPath: string | undefined;
  if (existsSync(activePath)) {
    yamlPath = activePath;
  } else if (existsSync(archivedPath)) {
    yamlPath = archivedPath;
  } else {
    throw new Error(`Finding ${id} not found in active or archive`);
  }

  const pathsToDelete: string[] = [yamlPath];
  const sidecars: string[] = [];

  const repro = findingReproDir(id, projectRoot);
  if (existsSync(repro)) sidecars.push(repro);
  const reports = findingReportsDir(id, projectRoot);
  if (existsSync(reports)) sidecars.push(reports);
  const threatmap = threatMapPath(id, projectRoot);
  if (existsSync(threatmap)) sidecars.push(threatmap);
  const submission = join(projectRoot, ".omv", "submissions", `${id}.yaml`);
  if (existsSync(submission)) sidecars.push(submission);
  const note = join(projectRoot, ".omv", "notes", `${id}.md`);
  if (existsSync(note)) sidecars.push(note);
  const archiveMeta = join(projectRoot, ".omv", "archive", "metadata", `${id}.json`);
  if (existsSync(archiveMeta)) sidecars.push(archiveMeta);

  if (!options.force) {
    return { id, deleted: false, paths: [...pathsToDelete, ...sidecars], errors: [] };
  }

  const errors: string[] = [];
  for (const path of [...pathsToDelete, ...sidecars]) {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (err) {
      errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length === 0) {
    await removeWorkspaceFinding(id, yamlPath === archivedPath, projectRoot);
    await rebuildWorkspaceIndex(projectRoot);
    await appendWorkspaceActivity({ action: "finding.delete", id, path: yamlPath }, projectRoot);
  }

  return { id, deleted: errors.length === 0, paths: [...pathsToDelete, ...sidecars], errors };
}

export async function ensureFindingsDir(projectRoot = process.cwd()): Promise<string> {
  await ensureWorkspaceDirs(projectRoot);
  const dir = findingsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function readFindingTemplate(status: EvidenceStatus): Promise<string> {
  const templatePath = join(packageRoot(), "contracts", "evidence.v1.yaml");
  const text = await readFile(templatePath, "utf-8");
  return text.replace(/^status:\s*.*$/m, `status: ${status}          # candidate | confirmed | blocked`);
}

function parseEvidenceYaml(text: string): { data: Record<string, unknown>; errors: string[] } {
  try {
    const parsed = parseYaml(text);
    if (!isRecord(parsed)) {
      return { data: {}, errors: ["Evidence YAML must be a mapping"] };
    }
    return { data: parsed, errors: [] };
  } catch (err) {
    return {
      data: {},
      errors: [`Evidence YAML parse error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

async function readEvidence(path: string): Promise<{ data: Record<string, unknown>; errors: string[] }> {
  return parseEvidenceYaml(await readFile(path, "utf-8"));
}

function computeEvidenceScore(data: Record<string, unknown>): number {
  let score = 0;
  if (isKnown(getString(data, "versions.tested"))) score += 20;
  if (isKnown(getString(data, "evidence.source"))) score += 10;
  if (isKnown(getString(data, "evidence.sink"))) score += 10;
  if (isKnown(getString(data, "evidence.guard"))) score += 10;
  if (isKnown(getString(data, "evidence.reproducer")) && getString(data, "evidence.reproducer") !== "none") score += 15;
  if (isKnown(getString(data, "evidence.observed_result"))) score += 10;
  if (isKnown(getString(data, "cvss.vector"))) score += 10;
  if (
    getBoolean(data, "dedup.nvd_searched") &&
    getBoolean(data, "dedup.ghsa_searched") &&
    getBoolean(data, "dedup.ecosystem_db_searched")
  ) {
    score += 10;
  }
  if (getBoolean(data, "disclosure.vendor_contacted")) score += 5;
  return score;
}

function computeSubmissionScore(data: Record<string, unknown>, status: string, projectRoot: string): number {
  let score = computeEvidenceScore(data);
  for (const deduction of submissionDeductions(data, status, projectRoot)) {
    score -= deduction.points;
  }
  score -= cvssConfidencePenalty(data);
  if (status === "blocked") score = 0;
  if (status === "confirmed" && score < SUBMISSION_READY_THRESHOLD) score -= SUBMISSION_DEDUCTIONS.confirmedBelowThreshold;
  return Math.max(0, Math.min(100, score));
}

function submissionDeductions(data: Record<string, unknown>, status: string, projectRoot: string): SubmissionDeduction[] {
  const deductions: SubmissionDeduction[] = [];
  if (!isKnown(getString(data, "evidence.observed_result"))) {
    deductions.push({
      id: "missingObservedResult",
      points: SUBMISSION_DEDUCTIONS.missingObservedResult,
      message: "local observed result is missing",
      fields: ["evidence.observed_result"],
      nextAction: "/omv-repro <id>",
    });
  }
  if (getList(data, "blockers").length > 0) {
    deductions.push({
      id: "unresolvedBlockers",
      points: SUBMISSION_DEDUCTIONS.unresolvedBlockers,
      message: "unresolved blockers remain",
      fields: ["blockers"],
      nextAction: "/omv-audit <id>",
    });
  }
  if (isUnknownPath(data, "versions.affected_range")) {
    deductions.push({
      id: "unknownAffectedRange",
      points: SUBMISSION_DEDUCTIONS.unknownAffectedRange,
      message: "affected version range is unknown",
      fields: ["versions.affected_range"],
      nextAction: "/omv-audit <id>",
    });
  }
  if (!getBoolean(data, "dedup.nvd_searched") || !getBoolean(data, "dedup.ghsa_searched") || !getBoolean(data, "dedup.ecosystem_db_searched")) {
    deductions.push({
      id: "incompleteDedup",
      points: SUBMISSION_DEDUCTIONS.incompleteDedup,
      message: "dedup search is incomplete",
      fields: ["dedup.nvd_searched", "dedup.ghsa_searched", "dedup.ecosystem_db_searched"],
      nextAction: "/omv-audit <id>",
    });
  }
  const exploitability = getString(data, "verdict.exploitability");
  if (exploitability === "blocked" || exploitability === "disproven") {
    deductions.push({
      id: "blockedOrDisproven",
      points: SUBMISSION_DEDUCTIONS.blockedOrDisproven,
      message: `verdict.exploitability is ${exploitability}`,
      fields: ["verdict.exploitability"],
      nextAction: "omv findings archive <id> --reason blocked",
    });
  }
  if (exploitability === "plausible") {
    deductions.push({
      id: "plausibleExploitability",
      points: SUBMISSION_DEDUCTIONS.plausibleExploitability,
      message: "exploitability is plausible but not proven",
      fields: ["verdict.exploitability"],
      nextAction: "/omv-repro <id>",
    });
  }
  const artifacts = getReproArtifacts(data, projectRoot);
  const listedArtifacts = getList(data, "evidence.repro_artifacts");
  if (listedArtifacts.length > 0 && artifacts.length === 0) {
    deductions.push({
      id: "missingReproArtifacts",
      points: SUBMISSION_DEDUCTIONS.missingReproArtifacts,
      message: "listed reproduction artifacts were not found",
      fields: ["evidence.repro_artifacts"],
      nextAction: "omv repro init <id>",
    });
  }
  return deductions;
}

async function readThreatMap(id: string, projectRoot: string): Promise<FindingThreatMap | undefined> {
  const path = threatMapPath(id, projectRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed = parseEvidenceYaml(await readFile(path, "utf-8")).data;
  return { path, rendered: renderThreatMap(parsed) };
}

function renderThreatMap(data: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const paths = getList(data, "paths");
  paths.forEach((item, index) => {
    if (!isRecord(item)) {
      lines.push(`path ${index + 1}: invalid threat map path`);
      return;
    }
    const confidence = getRecordString(item, "confidence");
    lines.push(`path ${index + 1}${confidence ? ` (${confidence} confidence)` : ""}`);
    lines.push(`  source: ${describeThreatNode(item.source, "source")}`);
    const transforms = getList(item, "transforms");
    for (const transform of transforms) {
      lines.push(`  transform: ${describeThreatNode(transform, "transform")}`);
    }
    lines.push(`  sink: ${describeThreatNode(item.sink, "sink")}`);
    const guard = isRecord(item.guard) ? item.guard : {};
    const present = guard.present === true;
    const guardText = getRecordString(guard, "description") || (present ? "guard present" : "no guard");
    const bypassable = guard.bypassable === true ? " (bypassable)" : "";
    lines.push(`  ${present ? "guard" : "guard missing"}: ${guardText}${bypassable}`);
  });

  const summary = isRecord(data.summary) ? data.summary : undefined;
  if (summary) {
    const pathCount = getRecordString(summary, "path_count");
    const confirmed = getRecordString(summary, "confirmed_paths");
    const highest = getRecordString(summary, "highest_confidence");
    const parts: string[] = [];
    if (pathCount) parts.push(`${pathCount} paths`);
    if (confirmed) parts.push(`${confirmed} confirmed`);
    if (highest) parts.push(`highest: ${highest}`);
    if (parts.length > 0) lines.push(`summary: ${parts.join(", ")}`);
  }
  return lines;
}

function describeThreatNode(value: unknown, fallback: string): string {
  if (!isRecord(value)) {
    return fallback;
  }
  const description = getRecordString(value, "description");
  const location = getRecordString(value, "location");
  const type = getRecordString(value, "type");
  const label = description || type || fallback;
  return location ? `${label} — ${location}` : label;
}

function cvssConfidencePenalty(data: Record<string, unknown>): number {
  const confidence = getString(data, "verdict.confidence");
  const unverifiedCount = getList(data, "provenance.unverified_fields").length;
  let penalty = Math.min(20, unverifiedCount * 3);
  if (confidence === "medium") penalty += 5;
  if (confidence === "low") penalty += 15;
  if (confidence === "unknown") penalty += 20;
  return penalty;
}

async function readFindingSummary(path: string, id: string): Promise<FindingSummary> {
  const parsed = parseEvidenceYaml(await readFile(path, "utf-8")).data;
  const evidenceScore = computeEvidenceScore(parsed);
  const projectRoot = projectRootFromFindingPath(path);
  return {
    id,
    path,
    status: getString(parsed, "status") || "unknown",
    ecosystem: getString(parsed, "package.ecosystem") || "unknown",
    package: getString(parsed, "package.registry_name") || getString(parsed, "package.product") || "unknown",
    vulnerability: getString(parsed, "vulnerability.class") || "unknown",
    readiness: evidenceScore,
    evidenceScore,
    submissionScore: computeSubmissionScore(parsed, getString(parsed, "status") || "unknown", projectRoot),
    verdict: getVerdict(parsed),
    reproArtifacts: getReproArtifacts(parsed, projectRoot),
  };
}

// ── Workflow helpers (delegating to workflow.ts) ───────────────────────

function getListFromWarnings(warnings: string[], field: string): string[] {
  return warnings.filter((warning) => warning.startsWith(`${field} `));
}

async function listReportArtifacts(id: string, projectRoot: string): Promise<string[]> {
  const dir = findingReportsDir(id, projectRoot);
  if (!existsSync(dir)) {
    return [];
  }
  const paths: string[] = [];
  await collectReportArtifacts(dir, paths);
  return paths.sort();
}

async function collectReportArtifacts(dir: string, paths: string[]): Promise<void> {
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      await collectReportArtifacts(path, paths);
      continue;
    }
    if (dirent.isFile() && (await stat(path)).size > 0) {
      paths.push(path);
    }
  }
}

async function listEmptyReportArtifacts(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }
  const paths: string[] = [];
  await collectEmptyReportArtifacts(dir, paths);
  return paths.sort();
}

async function collectEmptyReportArtifacts(dir: string, paths: string[]): Promise<void> {
  for (const dirent of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, dirent.name);
    if (dirent.isDirectory()) {
      await collectEmptyReportArtifacts(path, paths);
      continue;
    }
    if (dirent.isFile() && (await stat(path)).size === 0) {
      paths.push(path);
    }
  }
}

function reproReadmeTemplate(id: string): string {
  return `# Reproduction: ${id}

Use this directory for local, reviewer-safe reproduction evidence.

- commands.sh: exact commands executed locally
- observed.txt: copied local output or observation notes
- docker-compose.yml: optional isolated service setup
- screenshots/: optional screenshots or short recordings

Do not place secrets, live target data, or private disclosure material here.
`;
}

async function mergeReproArtifacts(findingPath: string, artifacts: string[]): Promise<boolean> {
  const text = await readFile(findingPath, "utf-8");
  const doc = parseDocument(text);
  const values = getList(parseEvidenceYaml(text).data, "evidence.repro_artifacts").map(String);
  const merged = [...values];
  for (const artifact of artifacts) {
    if (!merged.includes(artifact)) {
      merged.push(artifact);
    }
  }
  if (merged.length === values.length) {
    return false;
  }
  doc.setIn(["evidence", "repro_artifacts"], merged);
  await writeFile(findingPath, String(doc), "utf-8");
  return true;
}

function existingArtifactPaths(paths: string[], projectRoot: string): string[] {
  return paths.filter((path) => artifactExists(path, projectRoot)).map((path) => (isAbsolute(path) ? path : join(projectRoot, path)));
}

function artifactExists(path: string, projectRoot: string): boolean {
  const resolved = isAbsolute(path) ? path : join(projectRoot, path);
  return existsSync(resolved);
}

// ── Validation helpers ──────────────────────────────────────────────────

function requireKnown(
  data: Record<string, unknown>,
  errors: string[],
  path: string,
  options: { rejectNone?: boolean } = {},
): void {
  const value = getString(data, path);
  if (!isKnown(value) || (options.rejectNone && value === "none")) {
    errors.push(`${path} is required for confirmed findings`);
  }
}

function requireEnum(data: Record<string, unknown>, errors: string[], path: string, allowed: Set<string>): void {
  const value = getString(data, path);
  if (!value || value === "unknown") {
    return;
  }
  if (!allowed.has(value)) {
    errors.push(`${path} must be one of: ${Array.from(allowed).join(", ")}`);
  }
}

function requireTriState(data: Record<string, unknown>, errors: string[], path: string): void {
  const value = getString(data, path);
  if (!value || value === "unknown") {
    return;
  }
  if (!VALID_TRI_STATE.has(value)) {
    errors.push(`${path} must be true, false, or unknown`);
  }
}

function requireUrl(data: Record<string, unknown>, errors: string[], path: string): void {
  const value = getString(data, path);
  if (!isKnown(value)) {
    return;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      errors.push(`${path} must be an http or https URL`);
    }
  } catch {
    errors.push(`${path} must be a valid URL`);
  }
}

function requireDate(data: Record<string, unknown>, errors: string[], path: string): void {
  const value = getString(data, path);
  if (!isKnown(value)) {
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    errors.push(`${path} must be an ISO date in YYYY-MM-DD format`);
  }
}

function requireCwe(data: Record<string, unknown>, errors: string[], path: string): void {
  const value = getString(data, path);
  if (!isKnown(value)) {
    return;
  }
  if (!/^CWE-\d+$/.test(value)) {
    errors.push(`${path} must use CWE-<number> format`);
  }
}

function requireCvssVector(data: Record<string, unknown>, errors: string[], path: string): void {
  const value = getString(data, path);
  if (!isKnown(value)) {
    return;
  }
  const cvss31 = /^CVSS:3\.1\/AV:[NALP]\/AC:[LH]\/PR:[NLH]\/UI:[NR]\/S:[UC]\/C:[HLN]\/I:[HLN]\/A:[HLN]$/;
  if (!cvss31.test(value)) {
    errors.push(`${path} must be a valid CVSS v3.1 vector`);
  }
}

function requireTraceableEvidence(data: Record<string, unknown>, errors: string[], path: string): void {
  const value = getString(data, path);
  if (isKnown(value) && !hasFileLineReference(value)) {
    errors.push(`${path} must include a file:line reference for confirmed findings`);
  }
}

function requireTraceableGuard(data: Record<string, unknown>, errors: string[]): void {
  const value = getString(data, "evidence.guard");
  if (!isKnown(value)) {
    return;
  }
  const explicitAbsence = /\b(absent|missing|none|not present|不存在|缺失|无)\b/i.test(value);
  if (!explicitAbsence && !hasFileLineReference(value)) {
    errors.push("evidence.guard must include a file:line reference or explicit absence explanation for confirmed findings");
  }
}

function hasFileLineReference(value: string): boolean {
  return /(?:^|\s)[^\s:]+\.[A-Za-z0-9]+:\d+(?::\d+)?(?:\s|$)/.test(value);
}

function validateUnknownAccounting(
  data: Record<string, unknown>,
  status: string,
  errors: string[],
  warnings: string[],
): void {
  const unverified = new Set(getList(data, "provenance.unverified_fields").map((value) => String(value)));
  for (const path of UNKNOWN_ACCOUNTING_FIELDS) {
    const value = getString(data, path);
    if (value !== "unknown") {
      continue;
    }
    if (status === "confirmed" && REQUIRED_CONFIRMED_FIELDS.includes(path)) {
      errors.push(`${path} is unknown and cannot be unverified for confirmed findings`);
    } else if (!unverified.has(path)) {
      warnings.push(`${path} is unknown but not listed in provenance.unverified_fields`);
    }
  }
}

function addEvidenceQualityWarnings(
  data: Record<string, unknown>,
  status: string,
  warnings: string[],
  projectRoot: string,
): void {
  if (status === "candidate" && getList(data, "blockers").length > 0) {
    warnings.push("blockers remain unresolved for candidate finding");
  }
  if (!isKnown(getString(data, "evidence.observed_result"))) {
    warnings.push("evidence.observed_result is unknown; local reproduction is not complete");
  }
  if (!isKnown(getString(data, "versions.affected_range"))) {
    warnings.push("versions.affected_range is unknown; affected version boundary is not established");
  }
  if (getString(data, "cvss.vector").includes("/PR:N/") && /\b(admin|administrator|authenticated|auth)\b/i.test(getString(data, "evidence.source"))) {
    warnings.push("cvss.vector uses PR:N while source evidence appears to involve admin or authenticated API access");
  }
  if (/\b(default|默认)\b.*\b(block|deny|拦|阻止)\b/i.test(getString(data, "evidence.guard"))) {
    warnings.push("evidence.guard says a default mitigation blocks part of the exploit path; confirm bypass before reporting");
  }
  const listedArtifacts = getList(data, "evidence.repro_artifacts");
  if (listedArtifacts.length > 0 && getReproArtifacts(data, projectRoot).length === 0) {
    warnings.push("evidence.repro_artifacts are listed but no artifact files were found");
  }
  if (status === "confirmed" && listedArtifacts.length === 0) {
    warnings.push(`evidence.repro_artifacts is empty; consider storing local reproduction evidence under ${findingReproDir("<id>", projectRoot)}`);
  }
}

function isKnown(value: string): boolean {
  return value !== "" && value !== "unknown";
}

function isUnknownPath(data: Record<string, unknown>, path: string): boolean {
  return !isKnown(getString(data, path));
}

function getVerdict(data: Record<string, unknown>): FindingVerdict {
  return {
    exploitability: getString(data, "verdict.exploitability") || "unknown",
    confidence: getString(data, "verdict.confidence") || "unknown",
    reason: getString(data, "verdict.reason") || "",
  };
}

function getReproArtifacts(data: Record<string, unknown>, projectRoot: string): string[] {
  return getList(data, "evidence.repro_artifacts")
    .map((value) => String(value))
    .filter((value) => value.trim() !== "")
    .map((value) => (isAbsolute(value) ? value : join(projectRoot, value)))
    .filter((path) => existsSync(path));
}

function getString(data: Record<string, unknown>, path: string): string {
  const value = getValue(data, path);
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function getBoolean(data: Record<string, unknown>, path: string): boolean {
  return getValue(data, path) === true;
}

function getList(data: Record<string, unknown>, path: string): unknown[] {
  const value = getValue(data, path);
  return Array.isArray(value) ? value : [];
}

function getValue(data: Record<string, unknown>, path: string): unknown {
  let current: unknown = data;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function getRecordString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function listFindingFiles(dir: string): Promise<string[]> {
  if (!existsSync(dir)) {
    return [];
  }
  const dirents = await readdir(dir, { withFileTypes: true });
  return dirents
    .filter((dirent) => dirent.isFile() && FINDING_EXTENSIONS.has(extension(dirent.name)))
    .map((dirent) => dirent.name)
    .sort();
}

function resolveFindingPath(target: string, projectRoot: string): string {
  if (target.endsWith(".yaml") || target.endsWith(".yml") || target.includes("/")) {
    return target;
  }

  for (const suffix of [".yaml", ".yml"]) {
    const candidate = join(findingsDir(projectRoot), `${target}${suffix}`);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(findingsDir(projectRoot), `${target}.yaml`);
}

function findingIdFromFile(path: string): string {
  return basename(path).replace(/\.ya?ml$/, "");
}

function normalizeFindingId(id: string): string {
  const normalized = id.replace(/\.ya?ml$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)) {
    throw new Error("finding id must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens");
  }
  return normalized;
}

function projectRootFromFindingPath(path: string): string {
  const marker = `${relative("/", findingsDir("/"))}/`;
  const normalized = path.replaceAll("\\", "/");
  const index = normalized.lastIndexOf(marker);
  return index === -1 ? process.cwd() : normalized.slice(0, index || 1);
}

function extension(path: string): string {
  const match = path.match(/(\.ya?ml)$/);
  return match?.[1] ?? "";
}
