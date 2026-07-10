// workflow.ts — workflow priority and next-action logic
// Extracted from findings.ts. These functions are pure helpers that
// interpret validation results to produce lifecycle guidance.
//
// Readiness policy (single source of truth for report recommendation):
//   report-ready when status=confirmed, validation.ok, submissionScore>=threshold,
//   optional ThreatMap is ok when present, and Verification passes when strict.
// workflowNextAction is the lightweight queue hint (score + missing fields).
// doctorFinding / reviewFinding apply the full readiness policy and must remain
// the authoritative next-action for report readiness.

import type { FindingSummary, FindingValidation, FindingDoctorIssue } from "./findings.js";

/** Minimum submission score before recommending /omv-report or priority 100. */
export const SUBMISSION_READY_THRESHOLD = 75;

export interface ReportReadinessInput {
  status: string;
  validationOk: boolean;
  submissionScore: number;
  /** When a ThreatMap sidecar exists, it must validate. Default true if absent. */
  threatMapOk?: boolean;
  /** When strict verification is required, Verification.v1 must pass. Default true. */
  verificationOk?: boolean;
}

// ── Exported helpers ────────────────────────────────────────────────────

export function isSubmissionScoreReady(
  status: string,
  validationOk: boolean,
  submissionScore: number,
): boolean {
  return status === "confirmed" && validationOk && submissionScore >= SUBMISSION_READY_THRESHOLD;
}

/**
 * Full report-readiness gate shared by doctorFinding and reviewFinding.
 * Lightweight workflow queue uses isSubmissionScoreReady only (no sidecar I/O).
 */
export function isReportReady(input: ReportReadinessInput): boolean {
  return (
    isSubmissionScoreReady(input.status, input.validationOk, input.submissionScore) &&
    (input.threatMapOk ?? true) &&
    (input.verificationOk ?? true)
  );
}

/**
 * Prefer report when ready; otherwise surface verification work under strict mode,
 * then fall back to the lightweight workflow next-action.
 */
export function resolveDoctorNextAction(
  id: string,
  reportReady: boolean,
  fallbackNextAction: string,
  options: {
    strictVerification?: boolean;
    verificationReady?: boolean;
    verificationExists?: boolean;
  } = {},
): string {
  if (reportReady) {
    return `/omv-report ${id}`;
  }
  if (options.strictVerification && options.verificationReady === false) {
    return options.verificationExists
      ? `omv verification validate ${id}`
      : `omv verification init ${id}`;
  }
  return fallbackNextAction;
}

export function workflowMissingFields(validation: FindingValidation): string[] {
  const missing = new Set<string>();
  for (const error of validation.errors) {
    const match = error.match(/^([A-Za-z0-9_.]+) /);
    if (match) {
      missing.add(match[1]);
    }
  }
  for (const warning of validation.warnings) {
    const match = warning.match(/^([A-Za-z0-9_.]+) is unknown/);
    if (match) {
      missing.add(match[1]);
    }
  }
  return Array.from(missing).sort();
}

export function workflowBlockers(validation: FindingValidation): string[] {
  const blockers = [
    ...validation.errors,
    ...validation.warnings.filter((warning) => (
      warning.includes("blockers") ||
      warning.includes("observed_result") ||
      warning.includes("affected_range") ||
      warning.includes("cvss.vector") ||
      warning.includes("evidence.guard") ||
      warning.includes("repro_artifacts")
    )),
  ];
  return blockers.slice(0, 5);
}

export function workflowNextAction(
  finding: FindingSummary,
  validation: FindingValidation,
  missingFields: string[],
): string {
  if (finding.status === "blocked") {
    return `omv findings archive ${finding.id} --reason blocked`;
  }
  if (isSubmissionScoreReady(finding.status, validation.ok, finding.submissionScore)) {
    return `/omv-report ${finding.id}`;
  }
  const missing = new Set(missingFields);
  if (getListFromWarnings(validation.warnings, "blockers").length > 0) {
    return `/omv-audit ${finding.id}`;
  }
  if (
    missing.has("evidence.source") ||
    missing.has("evidence.sink") ||
    missing.has("evidence.guard") ||
    missing.has("evidence.reproducer") ||
    missing.has("cvss.vector")
  ) {
    return `/omv-audit ${finding.id}`;
  }
  if (missing.has("evidence.observed_result")) {
    return `/omv-repro ${finding.id}`;
  }
  if (finding.status === "candidate" && validation.ok && finding.submissionScore >= SUBMISSION_READY_THRESHOLD) {
    return `omv findings promote ${finding.id} --status confirmed`;
  }
  return `/omv-audit ${finding.id}`;
}

export function workflowPriority(
  finding: FindingSummary,
  validation: FindingValidation,
  missingFields: string[],
  nextAction: string,
): number {
  if (isSubmissionScoreReady(finding.status, validation.ok, finding.submissionScore)) {
    return 100;
  }
  if (nextAction.includes("--status confirmed")) {
    return 90;
  }
  if (nextAction.startsWith("/omv-repro")) {
    return 80;
  }
  if (nextAction.startsWith("/omv-audit")) {
    return Math.max(20, 70 - missingFields.length);
  }
  if (finding.status === "blocked") {
    return 10;
  }
  return Math.min(60, finding.readiness);
}

export function workflowPriorityReason(priority: number, nextAction: string): string {
  if (priority >= 100) return "confirmed finding ready for report";
  if (priority >= 90) return "submission-ready candidate needs promotion";
  if (priority >= 80) return "only local reproduction is blocking confirmation";
  if (priority >= 20) return "audit evidence still missing";
  if (nextAction.includes("archive")) return "blocked finding can be archived";
  return "low readiness";
}

export function extractFieldRefs(message: string): string[] {
  const refs = new Set<string>();
  for (const match of message.matchAll(/\b[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+\b/g)) {
    refs.add(match[0]);
  }
  if (message.startsWith("blockers ")) {
    refs.add("blockers");
  }
  return Array.from(refs);
}

export function classifyWarning(message: string): string {
  if (message.includes("observed_result")) return "missingObservedResult";
  if (message.includes("affected_range")) return "unknownAffectedRange";
  if (message.includes("dedup search")) return "incompleteDedup";
  if (message.includes("cvss.vector")) return "suspiciousCvss";
  if (message.includes("evidence.guard")) return "guardBlocksExploit";
  if (message.includes("repro_artifacts")) return "missingReproArtifacts";
  if (message.includes("blockers")) return "unresolvedBlockers";
  return "validation-warning";
}

export function warningNextAction(message: string, id: string): string {
  if (message.includes("observed_result") || message.includes("repro_artifacts")) return `/omv-repro ${id}`;
  if (message.includes("blockers")) return `/omv-audit ${id}`;
  if (message.includes("dedup") || message.includes("cvss") || message.includes("guard") || message.includes("affected_range")) return `/omv-audit ${id}`;
  return `omv findings open ${id}`;
}

export function dedupeIssues(issues: FindingDoctorIssue[]): FindingDoctorIssue[] {
  const seen = new Set<string>();
  const result: FindingDoctorIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.id}:${issue.message}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(issue);
  }
  return result;
}

function getListFromWarnings(warnings: string[], field: string): string[] {
  return warnings.filter((warning) => warning.startsWith(`${field} `));
}
