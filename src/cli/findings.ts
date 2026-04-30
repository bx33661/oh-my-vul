import { existsSync } from "fs";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import { parse as parseYaml } from "yaml";
import { findingsDir, packageRoot } from "./paths.js";

export type EvidenceStatus = "candidate" | "confirmed" | "blocked";

export interface FindingSummary {
  id: string;
  path: string;
  status: string;
  ecosystem: string;
  package: string;
  vulnerability: string;
  readiness: number;
}

export interface FindingValidation {
  id: string;
  path: string;
  ok: boolean;
  status: string;
  readiness: number;
  errors: string[];
  warnings: string[];
}

export interface FindingTemplateResult {
  id: string;
  path: string;
  status: EvidenceStatus;
  created: boolean;
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
];

export async function listFindings(projectRoot = process.cwd()): Promise<FindingSummary[]> {
  const dir = findingsDir(projectRoot);
  const files = await listFindingFiles(dir);
  const summaries: FindingSummary[] = [];

  for (const file of files) {
    const path = join(dir, file);
    const parsed = parseEvidenceYaml(await readFile(path, "utf-8")).data;
    summaries.push({
      id: findingIdFromFile(file),
      path,
      status: getString(parsed, "status") || "unknown",
      ecosystem: getString(parsed, "package.ecosystem") || "unknown",
      package: getString(parsed, "package.registry_name") || getString(parsed, "package.product") || "unknown",
      vulnerability: getString(parsed, "vulnerability.class") || "unknown",
      readiness: computeReadiness(parsed),
    });
  }

  return summaries.sort((left, right) => left.id.localeCompare(right.id));
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
  validateEvidenceData(parsed, status, errors, warnings);

  const readiness = computeReadiness(parsed);

  return {
    id: findingIdFromFile(path),
    path,
    ok: errors.length === 0,
    status: status || "unknown",
    readiness,
    errors,
    warnings,
  };
}

function validateEvidenceData(
  parsed: Record<string, unknown>,
  status: string,
  errors: string[],
  warnings: string[],
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
  requireDate(parsed, errors, "disclosure.contact_date");
  requireDate(parsed, errors, "disclosure.planned_disclosure_date");
  requireDate(parsed, errors, "provenance.verification_date");

  const readiness = computeReadiness(parsed);

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
  validateEvidenceData(parseResult.data, status, errors, warnings);
  if (errors.length > 0) {
    return {
      id: findingIdFromFile(path),
      path,
      ok: false,
      status: previousStatus || "unknown",
      readiness: computeReadiness(parseResult.data),
      errors,
      warnings,
    };
  }
  const updated = text.match(/^status:\s*.*$/m)
    ? text.replace(/^status:\s*.*$/m, `status: ${status}`)
    : `${text.trimEnd()}\nstatus: ${status}\n`;
  await writeFile(path, updated, "utf-8");
  return validateFinding(path, projectRoot);
}

export async function ensureFindingsDir(projectRoot = process.cwd()): Promise<string> {
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

function computeReadiness(data: Record<string, unknown>): number {
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

function isKnown(value: string): boolean {
  return value !== "" && value !== "unknown";
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

function extension(path: string): string {
  const match = path.match(/(\.ya?ml)$/);
  return match?.[1] ?? "";
}
