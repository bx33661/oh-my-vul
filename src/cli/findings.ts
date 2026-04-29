import { existsSync } from "fs";
import { mkdir, readFile, readdir, writeFile } from "fs/promises";
import { basename, join } from "path";
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

export async function listFindings(projectRoot = process.cwd()): Promise<FindingSummary[]> {
  const dir = findingsDir(projectRoot);
  const files = await listFindingFiles(dir);
  const summaries: FindingSummary[] = [];

  for (const file of files) {
    const path = join(dir, file);
    const parsed = parseEvidenceYaml(await readFile(path, "utf-8"));
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
  const parsed = parseEvidenceYaml(text);
  const status = getString(parsed, "status");
  const errors: string[] = [];
  const warnings: string[] = [];

  if (getString(parsed, "schema_version") !== "1") {
    errors.push("schema_version must be 1");
  }
  if (getString(parsed, "handoff_version") !== "1.0") {
    errors.push("handoff_version must be 1.0");
  }
  if (!VALID_STATUSES.has(status as EvidenceStatus)) {
    errors.push("status must be candidate, confirmed, or blocked");
  }
  if (!getString(parsed, "package.ecosystem")) {
    errors.push("package.ecosystem is required");
  }
  if (!getString(parsed, "package.registry_name") && !getString(parsed, "package.product")) {
    errors.push("package.registry_name or package.product is required");
  }

  const readiness = computeReadiness(parsed);

  if (status === "confirmed") {
    requireKnown(parsed, errors, "versions.tested");
    requireKnown(parsed, errors, "evidence.source");
    requireKnown(parsed, errors, "evidence.sink");
    requireKnown(parsed, errors, "evidence.guard");
    requireKnown(parsed, errors, "evidence.reproducer", { rejectNone: true });
    requireKnown(parsed, errors, "evidence.observed_result");
    if (readiness < 75) {
      warnings.push(`readiness ${readiness}/100 is below submission-ready threshold 75`);
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

function parseEvidenceYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentObjectKey: string | null = null;
  let currentListKey: string | null = null;
  let pendingEmptyKey: string | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim() || rawLine.trimStart().startsWith("#")) {
      continue;
    }

    const top = rawLine.match(/^([a-z_]+):\s*(.*)$/);
    if (top) {
      const [, key, rawValue] = top;
      const value = parseValue(rawValue);
      result[key] = value;
      currentObjectKey = value && typeof value === "object" && !Array.isArray(value) ? key : null;
      currentListKey = Array.isArray(value) ? key : null;
      pendingEmptyKey = stripComment(rawValue).trim() === "" ? key : null;
      continue;
    }

    const nested = rawLine.match(/^  ([a-z_]+):\s*(.*)$/);
    if (nested && currentObjectKey) {
      const [, key, rawValue] = nested;
      const value = parseValue(rawValue);
      (result[currentObjectKey] as Record<string, unknown>)[key] = value;
      currentListKey = Array.isArray(value) ? `${currentObjectKey}.${key}` : null;
      pendingEmptyKey = stripComment(rawValue).trim() === "" ? `${currentObjectKey}.${key}` : null;
      continue;
    }

    const listItem = rawLine.match(/^  -\s*(.*)$/);
    if (listItem && (currentListKey || pendingEmptyKey)) {
      const listKey = currentListKey ?? pendingEmptyKey;
      if (listKey) {
        ensureList(result, listKey);
        pushListValue(result, listKey, parseValue(listItem[1]));
        currentListKey = listKey;
        pendingEmptyKey = null;
      }
    }
  }

  return result;
}

function parseValue(rawValue: string): unknown {
  const value = stripComment(rawValue).trim();
  if (value === "") {
    return {};
  }
  if (value === "[]") {
    return [];
  }
  if (value === "{}") {
    return {};
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function stripComment(value: string): string {
  return value.replace(/\s+#.*$/, "");
}

function pushListValue(root: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  const key = parts.pop();
  if (!key) {
    return;
  }
  let current: Record<string, unknown> = root;
  for (const part of parts) {
    current = current[part] as Record<string, unknown>;
  }
  const list = current[key];
  if (Array.isArray(list)) {
    list.push(value);
  }
}

function ensureList(root: Record<string, unknown>, path: string): void {
  const parts = path.split(".");
  const key = parts.pop();
  if (!key) {
    return;
  }
  let current: Record<string, unknown> = root;
  for (const part of parts) {
    if (!current[part] || typeof current[part] !== "object") {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  if (!Array.isArray(current[key])) {
    current[key] = [];
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
