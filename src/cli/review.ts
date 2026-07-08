import { doctorFinding, type FindingDoctorIssue, type FindingDoctorResult } from "./findings.js";

export type ReviewVerdict = "ready" | "needs-repro" | "needs-audit" | "needs-verification" | "blocked";

export interface FindingReview {
  id: string;
  verdict: ReviewVerdict;
  reportReady: boolean;
  strict: boolean;
  nextAction: string;
  summary: string;
  blockers: string[];
  warnings: string[];
  doctor: FindingDoctorResult;
}

const NON_BLOCKING_ISSUES = new Set(["report-artifact-error", "report-artifact-warning"]);
const REPRO_ISSUES = new Set(["missingObservedResult", "plausibleExploitability"]);
const VERIFICATION_ISSUES = new Set(["verification-error", "verification-warning", "verification-not-passing"]);

export async function reviewFinding(
  target: string,
  projectRoot = process.cwd(),
  options: { strict?: boolean } = {},
): Promise<FindingReview> {
  const strict = options.strict ?? false;
  const doctor = await doctorFinding(target, projectRoot, { strictVerification: strict });
  const verdict = classifyReview(doctor, strict);
  const nextAction = nextActionForVerdict(doctor, verdict);
  return {
    id: doctor.id,
    verdict,
    reportReady: verdict === "ready",
    strict,
    nextAction,
    summary: summaryForVerdict(verdict),
    blockers: blockingIssues(doctor.issues).map(formatIssue),
    warnings: warningIssues(doctor.issues).map(formatIssue),
    doctor,
  };
}

function classifyReview(doctor: FindingDoctorResult, strict: boolean): ReviewVerdict {
  if (doctor.status === "blocked" || hasIssue(doctor, "blockedOrDisproven")) {
    return "blocked";
  }
  if (strict && hasVerificationWork(doctor)) {
    return "needs-verification";
  }
  if (hasAnyIssue(doctor, REPRO_ISSUES)) {
    return "needs-repro";
  }
  if (doctor.reportReady && blockingIssues(doctor.issues).length === 0) {
    return "ready";
  }
  return "needs-audit";
}

function nextActionForVerdict(doctor: FindingDoctorResult, verdict: ReviewVerdict): string {
  if (verdict === "ready") {
    return `/omv-report ${doctor.id}`;
  }
  if (verdict === "blocked") {
    return doctor.nextAction.includes("archive")
      ? doctor.nextAction
      : `omv findings archive ${doctor.id} --reason blocked`;
  }
  if (verdict === "needs-verification") {
    return firstIssueAction(doctor, VERIFICATION_ISSUES) ?? doctor.nextAction;
  }
  if (verdict === "needs-repro") {
    return firstIssueAction(doctor, REPRO_ISSUES) ?? `/omv-repro ${doctor.id}`;
  }
  return doctor.nextAction;
}

function summaryForVerdict(verdict: ReviewVerdict): string {
  switch (verdict) {
    case "ready":
      return "Finding is ready for report generation.";
    case "needs-repro":
      return "Local reproduction evidence is incomplete.";
    case "needs-audit":
      return "Audit evidence or metadata still needs work.";
    case "needs-verification":
      return "Strict review requires a passing, non-stale adversarial verification.";
    case "blocked":
      return "Finding is blocked, disproven, or ready to archive as blocked.";
  }
}

function blockingIssues(issues: FindingDoctorIssue[]): FindingDoctorIssue[] {
  return issues.filter((issue) => issue.severity === "error" && !NON_BLOCKING_ISSUES.has(issue.id));
}

function warningIssues(issues: FindingDoctorIssue[]): FindingDoctorIssue[] {
  return issues.filter((issue) => issue.severity !== "error" || NON_BLOCKING_ISSUES.has(issue.id));
}

function hasVerificationWork(doctor: FindingDoctorResult): boolean {
  if (!doctor.verification || doctor.verification.status !== "pass" || doctor.verification.stale || !doctor.verification.ok) {
    return true;
  }
  return hasAnyIssue(doctor, VERIFICATION_ISSUES);
}

function hasIssue(doctor: FindingDoctorResult, id: string): boolean {
  return doctor.issues.some((issue) => issue.id === id);
}

function hasAnyIssue(doctor: FindingDoctorResult, ids: Set<string>): boolean {
  return doctor.issues.some((issue) => ids.has(issue.id));
}

function firstIssueAction(doctor: FindingDoctorResult, ids: Set<string>): string | undefined {
  return doctor.issues.find((issue) => ids.has(issue.id))?.nextAction;
}

function formatIssue(issue: FindingDoctorIssue): string {
  const fields = issue.fields.length > 0 ? ` [${issue.fields.join(", ")}]` : "";
  return `${issue.severity}: ${issue.message}${fields} -> ${issue.nextAction}`;
}
