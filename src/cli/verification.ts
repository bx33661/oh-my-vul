import { existsSync } from "fs";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { sha256File } from "./install-manifest.js";
import { findingsDir, verificationPath, verificationsDir } from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

export type VerificationDecisionStatus = "pass" | "fail" | "needs-human-review";

export interface VerificationInitResult {
  id: string;
  path: string;
  findingPath: string;
  findingSha256: string;
  written: boolean;
  skipped: boolean;
}

export interface VerificationValidation {
  id: string;
  path: string;
  findingPath: string;
  exists: boolean;
  ok: boolean;
  status: VerificationDecisionStatus | "unknown";
  stale: boolean;
  errors: string[];
  warnings: string[];
  reviewCount: number;
  disagreements: number;
  requiredChanges: number;
}

export interface VerificationDetail extends VerificationValidation {
  rendered: string[];
}

const VALID_DECISIONS = new Set(["pass", "fail", "needs-human-review"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low", "unknown", ""]);

export async function initVerification(
  target: string,
  projectRoot = process.cwd(),
  options: { force?: boolean } = {},
): Promise<VerificationInitResult> {
  const id = normalizeFindingId(target);
  const findingPath = resolveFindingPath(id, projectRoot);
  if (!existsSync(findingPath)) {
    throw new Error(`${findingPath} does not exist`);
  }

  const dir = verificationsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const path = verificationPath(id, projectRoot);
  const findingSha256 = await sha256File(findingPath);
  const shouldWrite = options.force || !existsSync(path) || (await stat(path)).size === 0;
  if (!shouldWrite) {
    return { id, path, findingPath, findingSha256, written: false, skipped: true };
  }

  await writeFile(path, verificationTemplate(id, findingSha256), "utf-8");
  await appendWorkspaceActivity({ action: "verification.write", id, path }, projectRoot);
  return { id, path, findingPath, findingSha256, written: true, skipped: false };
}

export async function showVerification(id: string, projectRoot = process.cwd()): Promise<VerificationDetail> {
  const normalizedId = normalizeFindingId(id);
  const path = verificationPath(normalizedId, projectRoot);
  const findingPath = resolveFindingPath(normalizedId, projectRoot);
  if (!existsSync(path)) {
    const validation = await validateVerification(normalizedId, projectRoot);
    return { ...validation, rendered: [] };
  }
  const parseResult = parseVerificationYaml(await readFile(path, "utf-8"));
  const validation = await validateParsedVerification(normalizedId, path, findingPath, parseResult);
  const rendered = renderVerification(parseResult.data);
  return { ...validation, rendered };
}

export async function validateVerification(
  target: string,
  projectRoot = process.cwd(),
  options: { requireExisting?: boolean } = {},
): Promise<VerificationValidation> {
  const id = normalizeFindingId(target);
  const path = verificationPath(id, projectRoot);
  const findingPath = resolveFindingPath(id, projectRoot);
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!existsSync(path)) {
    const message = `${path} does not exist`;
    if (options.requireExisting ?? true) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
    return emptyValidation(id, path, findingPath, false, errors, warnings);
  }

  const parseResult = parseVerificationYaml(await readFile(path, "utf-8"));
  return validateParsedVerification(id, path, findingPath, parseResult);
}

async function validateParsedVerification(
  id: string,
  path: string,
  findingPath: string,
  parseResult: { data: Record<string, unknown>; errors: string[] },
): Promise<VerificationValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  errors.push(...parseResult.errors);
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

  const status = normalizeDecision(getString(data, "decision.status"));
  if (status === "unknown") {
    errors.push("decision.status must be pass, fail, or needs-human-review");
  }
  if (!getString(data, "decision.reason")) {
    warnings.push("decision.reason is empty");
  }

  const reviews = getList(data, "reviews");
  let disagreements = 0;
  let requiredChanges = 0;
  reviews.forEach((review, index) => {
    const counts = validateReview(review, index, errors, warnings);
    disagreements += counts.disagreements;
    requiredChanges += counts.requiredChanges;
  });

  if (status === "pass") {
    if (reviews.length === 0) {
      errors.push("reviews must include at least one review when decision.status is pass");
    }
    if (disagreements > 0 || requiredChanges > 0) {
      errors.push("decision.status cannot be pass while disagreements or required_changes remain");
    }
  }
  if (status === "fail" && disagreements === 0) {
    warnings.push("decision.status is fail but no disagreements are recorded");
  }

  let stale = false;
  const recordedHash = getString(data, "finding_sha256");
  if (!recordedHash) {
    errors.push("finding_sha256 is required");
  } else if (!existsSync(findingPath)) {
    warnings.push(`${findingPath} does not exist; cannot check staleness`);
  } else {
    const currentHash = await sha256File(findingPath);
    stale = currentHash !== recordedHash;
    if (stale) {
      warnings.push("finding_sha256 is stale; Evidence.v1 changed after verification");
    }
  }

  return {
    id,
    path,
    findingPath,
    exists: true,
    ok: errors.length === 0,
    status,
    stale,
    errors,
    warnings,
    reviewCount: reviews.length,
    disagreements,
    requiredChanges,
  };
}

export function verificationPasses(validation: VerificationValidation | undefined): boolean {
  return Boolean(validation && validation.ok && !validation.stale && validation.status === "pass");
}

function validateReview(
  value: unknown,
  index: number,
  errors: string[],
  warnings: string[],
): { disagreements: number; requiredChanges: number } {
  const prefix = `reviews[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${prefix} must be a mapping`);
    return { disagreements: 0, requiredChanges: 0 };
  }
  if (!getRecordString(value, "reviewer")) {
    errors.push(`${prefix}.reviewer is required`);
  }
  if (!getRecordString(value, "target")) {
    errors.push(`${prefix}.target is required`);
  }
  if (typeof value.agrees !== "boolean") {
    errors.push(`${prefix}.agrees must be true or false`);
  }
  const confidence = getRecordString(value, "confidence");
  if (!VALID_CONFIDENCE.has(confidence)) {
    errors.push(`${prefix}.confidence must be high, medium, low, or unknown`);
  }
  const reviewedAt = getRecordString(value, "reviewed_at");
  if (reviewedAt && !/^\d{4}-\d{2}-\d{2}$/.test(reviewedAt)) {
    errors.push(`${prefix}.reviewed_at must be an ISO date in YYYY-MM-DD format`);
  }

  const disagreements = getList(value, "disagreements").length;
  const requiredChanges = getList(value, "required_changes").length;
  if (value.agrees === false && disagreements === 0) {
    warnings.push(`${prefix}.agrees is false but disagreements is empty`);
  }
  return { disagreements, requiredChanges };
}

function renderVerification(data: Record<string, unknown>): string[] {
  const lines: string[] = [];
  const status = getString(data, "decision.status") || "unknown";
  const reason = getString(data, "decision.reason");
  lines.push(`decision: ${status}${reason ? ` — ${reason}` : ""}`);
  for (const [index, review] of getList(data, "reviews").entries()) {
    if (!isRecord(review)) {
      lines.push(`review ${index + 1}: invalid`);
      continue;
    }
    const reviewer = getRecordString(review, "reviewer") || "unknown";
    const target = getRecordString(review, "target") || "unknown";
    const agrees = review.agrees === true ? "agrees" : review.agrees === false ? "disagrees" : "unknown";
    const confidence = getRecordString(review, "confidence") || "unknown";
    lines.push(`review ${index + 1}: ${reviewer} ${agrees} on ${target} (${confidence})`);
    for (const item of getList(review, "disagreements").slice(0, 3)) {
      lines.push(`  disagreement: ${String(item)}`);
    }
    for (const item of getList(review, "required_changes").slice(0, 3)) {
      lines.push(`  required change: ${String(item)}`);
    }
  }
  return lines;
}

function emptyValidation(
  id: string,
  path: string,
  findingPath: string,
  exists: boolean,
  errors: string[],
  warnings: string[],
): VerificationValidation {
  return {
    id,
    path,
    findingPath,
    exists,
    ok: errors.length === 0,
    status: "unknown",
    stale: false,
    errors,
    warnings,
    reviewCount: 0,
    disagreements: 0,
    requiredChanges: 0,
  };
}

function verificationTemplate(id: string, findingSha256: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `# Verification.v1 sidecar for ${id}
# Produced by: omv verification init + adversarial verifier workflows
# Schema: contracts/verification.v1.yaml
schema_version: "1"

finding_id: "${id}"
finding_sha256: "${findingSha256}"

reviews: []
# - reviewer: verifier
#   target: threatmap.paths[0]
#   agrees: true
#   disagreements: []
#   required_changes: []
#   confidence: unknown
#   reviewed_at: "${today}"

decision:
  status: needs-human-review
  reason: ""
  required_for_confirmed: true

provenance:
  generated_at: "${today}"
  tool: omv
  tool_version: unknown
`;
}

function normalizeDecision(value: string): VerificationValidation["status"] {
  return VALID_DECISIONS.has(value) ? value as VerificationDecisionStatus : "unknown";
}

function parseVerificationYaml(text: string): { data: Record<string, unknown>; errors: string[] } {
  try {
    const parsed = parseYaml(text);
    if (!isRecord(parsed)) {
      return { data: {}, errors: ["Verification YAML must be a mapping"] };
    }
    return { data: parsed, errors: [] };
  } catch (err) {
    return {
      data: {},
      errors: [`Verification YAML parse error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
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
