// threatmap.ts — ThreatMap.v1 read/write/render
// Extracted from findings.ts.

import { existsSync } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { findingsDir, threatMapPath, threatMapsDir } from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

// ── Types ───────────────────────────────────────────────────────────────

export interface FindingThreatMap {
  path: string;
  rendered: string[];
  validation: ThreatMapValidation;
}

export interface ThreatMapWriteResult {
  id: string;
  path: string;
  findingPath: string;
  written: boolean;
  skipped: boolean;
}

export interface ThreatMapValidation {
  id: string;
  path: string;
  exists: boolean;
  ok: boolean;
  errors: string[];
  warnings: string[];
  rendered: string[];
}

// ── Public API ──────────────────────────────────────────────────────────

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

export async function readThreatMap(id: string, projectRoot: string): Promise<FindingThreatMap | undefined> {
  const path = threatMapPath(id, projectRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  const validation = await validateThreatMap(id, projectRoot, { requireExisting: true });
  return { path: validation.path, rendered: validation.rendered, validation };
}

export async function validateThreatMap(
  target: string,
  projectRoot = process.cwd(),
  options: { requireExisting?: boolean; evidence?: Record<string, unknown> } = {},
): Promise<ThreatMapValidation> {
  const id = normalizeFindingId(target);
  const path = threatMapPath(id, projectRoot);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(path)) {
    const message = `${path} does not exist`;
    if (options.requireExisting ?? true) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
    return { id, path, exists: false, ok: errors.length === 0, errors, warnings, rendered: [] };
  }

  const parseResult = parseEvidenceYaml(await readFile(path, "utf-8"));
  errors.push(...parseResult.errors.map((message) => message.replace(/^Evidence YAML/, "ThreatMap YAML")));
  const data = parseResult.data;

  if (getString(data, "schema_version") !== "1") {
    errors.push("schema_version must be 1");
  }
  const findingId = getString(data, "finding_id");
  if (!findingId) {
    errors.push("finding_id is required");
  } else if (findingId !== id) {
    errors.push(`finding_id must match ${id}`);
  }
  if (!getString(data, "package.ecosystem")) {
    warnings.push("package.ecosystem is empty");
  }
  if (!getString(data, "package.registry_name") && !getString(data, "package.repository_url")) {
    warnings.push("package.registry_name or package.repository_url should be set");
  }

  const paths = getList(data, "paths");
  if (paths.length === 0) {
    errors.push("paths must include at least one source-to-sink path");
  }
  paths.forEach((item, index) => validateThreatPath(item, index, errors, warnings));

  const summaryCount = Number(getString(data, "summary.path_count"));
  if (Number.isFinite(summaryCount) && summaryCount > 0 && summaryCount !== paths.length) {
    warnings.push(`summary.path_count is ${summaryCount} but paths has ${paths.length} entr${paths.length === 1 ? "y" : "ies"}`);
  }

  const evidence = options.evidence ?? await readEvidenceIfPresent(id, projectRoot);
  if (evidence) {
    addEvidenceConsistencyWarnings(data, evidence, warnings);
  }

  return {
    id,
    path,
    exists: true,
    ok: errors.length === 0,
    errors,
    warnings,
    rendered: renderThreatMap(data),
  };
}

// ── Private helpers ─────────────────────────────────────────────────────

function threatMapTemplate(id: string, finding: Record<string, unknown>): string {
  const ecosystem = getString(finding, "package.ecosystem") || "";
  const registryName = getString(finding, "package.registry_name") || getString(finding, "package.product") || "";
  const repositoryUrl = getString(finding, "package.repository_url") || "";
  return `# ThreatMap.v1 — ${id}
# Auto-generated by omv threat-map init.
# Fill in paths[] with actual source → transform → sink dataflow entries.
# Schema: contracts/threat-map.v1.yaml

schema_version: "1"
finding_id: "${id}"

package:
  ecosystem: ${ecosystem}
  registry_name: "${registryName}"
  repository_url: "${repositoryUrl}"

paths: []

summary:
  path_count: 0
  confirmed_paths: 0
  highest_confidence: ""
`;
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

function validateThreatPath(value: unknown, index: number, errors: string[], warnings: string[]): void {
  const prefix = `paths[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${prefix} must be a mapping`);
    return;
  }
  validateThreatNode(value.source, `${prefix}.source`, errors);
  validateThreatNode(value.sink, `${prefix}.sink`, errors);
  for (const [transformIndex, transform] of getList(value, "transforms").entries()) {
    validateThreatNode(transform, `${prefix}.transforms[${transformIndex}]`, errors);
  }
  if (!isRecord(value.guard)) {
    errors.push(`${prefix}.guard must be a mapping`);
  } else {
    if (typeof value.guard.present !== "boolean") {
      errors.push(`${prefix}.guard.present must be true or false`);
    }
    if (value.guard.bypassable !== undefined && typeof value.guard.bypassable !== "boolean") {
      errors.push(`${prefix}.guard.bypassable must be true or false when present`);
    }
    if (!getRecordString(value.guard, "description")) {
      warnings.push(`${prefix}.guard.description is empty`);
    }
  }
  const confidence = getRecordString(value, "confidence");
  if (!["high", "medium", "low", "unknown", ""].includes(confidence)) {
    errors.push(`${prefix}.confidence must be high, medium, low, or unknown`);
  }
}

function validateThreatNode(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be a mapping`);
    return;
  }
  if (!getRecordString(value, "type")) {
    errors.push(`${path}.type is required`);
  }
  if (!getRecordString(value, "location") && !getRecordString(value, "description")) {
    errors.push(`${path}.location or ${path}.description is required`);
  }
}

function addEvidenceConsistencyWarnings(
  threatMap: Record<string, unknown>,
  evidence: Record<string, unknown>,
  warnings: string[],
): void {
  const graphText = JSON.stringify(threatMap);
  for (const [field, label] of [
    ["evidence.source", "source"],
    ["evidence.sink", "sink"],
    ["evidence.guard", "guard"],
  ] as const) {
    const value = getString(evidence, field);
    const refs = fileLineReferences(value);
    for (const ref of refs) {
      if (!graphText.includes(ref)) {
        warnings.push(`Evidence ${label} reference ${ref} is not present in ThreatMap.v1`);
      }
    }
  }

  const guardSummary = getString(evidence, "evidence.guard");
  const saysMissing = /\b(absent|missing|none|not present|不存在|缺失|无)\b/i.test(guardSummary);
  const paths = getList(threatMap, "paths");
  if (saysMissing && paths.some((path) => isRecord(path) && isRecord(path.guard) && path.guard.present === true)) {
    warnings.push("Evidence guard summary says missing/absent but ThreatMap.v1 has a present guard");
  }
}

function fileLineReferences(value: string): string[] {
  return [...value.matchAll(/\b[^\s:]+\.[A-Za-z0-9]+:\d+(?::\d+)?\b/g)].map((match) => match[0]);
}

async function readEvidenceIfPresent(id: string, projectRoot: string): Promise<Record<string, unknown> | undefined> {
  const path = resolveFindingPath(id, projectRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  return (await readEvidence(path)).data;
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

function getString(data: Record<string, unknown>, path: string): string {
  const value = getValue(data, path);
  return typeof value === "string" ? value : value === undefined || value === null ? "" : String(value);
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

function normalizeFindingId(id: string): string {
  const normalized = id.replace(/\.ya?ml$/, "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(normalized)) {
    throw new Error("finding id must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens");
  }
  return normalized;
}

function resolveFindingPath(target: string, projectRoot: string): string {
  if (target.endsWith(".yaml") || target.endsWith(".yml") || target.includes("/")) {
    return target;
  }
  for (const suffix of [".yaml", ".yml"]) {
    const candidate = join(findingsDir(projectRoot), `${target}${suffix}`);
    if (existsSync(candidate)) return candidate;
  }
  return join(findingsDir(projectRoot), `${target}.yaml`);
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
