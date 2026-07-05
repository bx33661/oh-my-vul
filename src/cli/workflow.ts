// workflow.ts — workflow priority and next-action logic
// Extracted from findings.ts. These functions are pure helpers that
// interpret validation results to produce lifecycle guidance.

import type { FindingSummary, FindingValidation, FindingDoctorIssue } from "./findings.js";

// ── Exported helpers ────────────────────────────────────────────────────

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
  if (finding.status === "confirmed" && validation.ok) {
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
  if (finding.status === "candidate" && validation.ok && finding.submissionScore >= 75) {
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
  if (finding.status === "confirmed" && validation.ok) {
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
