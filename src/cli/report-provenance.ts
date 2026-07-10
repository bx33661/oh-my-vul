import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { sha256File } from "./install-manifest.js";
import {
  findingReportsDir,
  findingsDir,
  reportProvenancePath,
  sourceRefPath,
  threatMapPath,
  verificationPath,
} from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

export type ReportProvenanceRole =
  | "evidence"
  | "report"
  | "source-ref"
  | "threat-map"
  | "verification"
  | "reproduction";

export interface ReportProvenanceInput {
  role: ReportProvenanceRole;
  path: string;
  sha256: string;
}

export interface ReportProvenanceManifest {
  schema_version: "1";
  finding_id: string;
  generated_at: string;
  inputs: ReportProvenanceInput[];
}

export interface CreateReportProvenanceOptions {
  force?: boolean;
  now?: () => Date;
}

export interface ReportProvenanceResult {
  id: string;
  path: string;
  manifest: ReportProvenanceManifest;
  overwritten: boolean;
  warnings: string[];
}

export interface ReportProvenanceValidation {
  id: string;
  path: string;
  exists: true;
  ok: boolean;
  fresh: boolean;
  manifest: ReportProvenanceManifest;
  staleInputs: string[];
  missingInputs: string[];
  errors: string[];
  warnings: string[];
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ROOT_KEYS = new Set(["schema_version", "finding_id", "generated_at", "inputs"]);
const INPUT_KEYS = new Set(["role", "path", "sha256"]);
const ROLES = new Set<ReportProvenanceRole>([
  "evidence",
  "report",
  "source-ref",
  "threat-map",
  "verification",
  "reproduction",
]);

export async function createReportProvenance(
  target: string,
  projectRoot = process.cwd(),
  options: CreateReportProvenanceOptions = {},
): Promise<ReportProvenanceResult> {
  const id = normalizeId(target);
  const findingPath = resolveFindingPath(id, projectRoot);
  if (!existsSync(findingPath)) throw new Error(`${findingPath} does not exist`);
  const reportPaths = await listReportFiles(id, projectRoot);
  if (reportPaths.length === 0) {
    throw new Error(`no non-empty report artifacts found under ${findingReportsDir(id, projectRoot)}`);
  }

  const current = (options.now ?? (() => new Date()))();
  if (!(current instanceof Date) || Number.isNaN(current.getTime())) {
    throw new Error("now must return a valid Date");
  }
  const evidence = parseEvidence(await readFile(findingPath, "utf-8"), findingPath);
  const warnings: string[] = [];
  const inputs: ReportProvenanceInput[] = [];
  await addInput(inputs, "evidence", findingPath, projectRoot);
  for (const path of reportPaths) await addInput(inputs, "report", path, projectRoot);
  for (const [role, path] of [
    ["source-ref", sourceRefPath(id, projectRoot)],
    ["threat-map", threatMapPath(id, projectRoot)],
    ["verification", verificationPath(id, projectRoot)],
  ] as const) {
    if (existsSync(path) && (await stat(path)).isFile()) await addInput(inputs, role, path, projectRoot);
  }
  const seen = new Set(inputs.map((input) => resolveInputPath(input.path, projectRoot)));
  for (const declared of stringList(evidence, "evidence.repro_artifacts")) {
    const path = isAbsolute(declared) ? declared : join(projectRoot, declared);
    if (!existsSync(path)) {
      warnings.push(`declared reproduction dependency is missing and was not hashed: ${declared}`);
      continue;
    }
    if (!(await stat(path)).isFile()) {
      warnings.push(`declared reproduction dependency is not a file and was not hashed: ${declared}`);
      continue;
    }
    const resolved = resolve(path);
    if (!seen.has(resolved)) {
      await addInput(inputs, "reproduction", path, projectRoot);
      seen.add(resolved);
    }
  }

  const manifest: ReportProvenanceManifest = {
    schema_version: "1",
    finding_id: id,
    generated_at: current.toISOString(),
    inputs,
  };
  validateManifestObject(manifest, "ReportProvenance.v1");
  const path = reportProvenancePath(id, projectRoot);
  const overwritten = existsSync(path);
  if (overwritten && !options.force) {
    throw new Error(`report provenance already exists: ${path}; pass --force to replace it`);
  }
  await mkdir(findingReportsDir(id, projectRoot), { recursive: true });
  await writeAtomic(path, `${JSON.stringify(manifest, null, 2)}\n`, Boolean(options.force));
  try {
    await appendWorkspaceActivity({ action: "report.provenance", id, path }, projectRoot);
  } catch (error) {
    warnings.push(`report provenance written, but activity recording failed: ${errorMessage(error)}`);
  }
  return { id, path, manifest, overwritten, warnings };
}

export async function validateReportProvenance(
  target: string,
  projectRoot = process.cwd(),
): Promise<ReportProvenanceValidation> {
  const id = normalizeId(target);
  const path = reportProvenancePath(id, projectRoot);
  if (!existsSync(path)) throw new Error(`${path} does not exist`);
  const manifest = parseReportProvenanceJson(await readFile(path, "utf-8"), path);
  if (manifest.finding_id !== id) {
    throw new Error(`${path}: finding_id must match report directory id ${id}`);
  }
  const staleInputs: string[] = [];
  const missingInputs: string[] = [];
  for (const input of manifest.inputs) {
    const inputPath = resolveInputPath(input.path, projectRoot);
    if (!existsSync(inputPath) || !(await stat(inputPath)).isFile()) {
      missingInputs.push(input.path);
    } else if (await sha256File(inputPath) !== input.sha256) {
      staleInputs.push(input.path);
    }
  }
  const fresh = staleInputs.length === 0 && missingInputs.length === 0;
  return {
    id,
    path,
    exists: true,
    ok: true,
    fresh,
    manifest,
    staleInputs,
    missingInputs,
    errors: [],
    warnings: fresh ? [] : ["report provenance inputs are stale or missing"],
  };
}

export function parseReportProvenanceJson(
  text: string,
  source = "ReportProvenance.v1 JSON",
): ReportProvenanceManifest {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: JSON parse error: ${errorMessage(error)}`);
  }
  return validateManifestObject(value, source);
}

export async function listReportFiles(id: string, projectRoot = process.cwd()): Promise<string[]> {
  const normalized = normalizeId(id);
  const dir = findingReportsDir(normalized, projectRoot);
  if (!existsSync(dir)) return [];
  const paths: string[] = [];
  await collectReportFiles(dir, reportProvenancePath(normalized, projectRoot), paths);
  return paths.sort();
}

async function collectReportFiles(dir: string, manifestPath: string, paths: string[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectReportFiles(path, manifestPath, paths);
    } else if (entry.isFile() && path !== manifestPath && (await stat(path)).size > 0) {
      paths.push(path);
    }
  }
}

async function addInput(
  inputs: ReportProvenanceInput[],
  role: ReportProvenanceRole,
  path: string,
  projectRoot: string,
): Promise<void> {
  inputs.push({ role, path: portablePath(path, projectRoot), sha256: await sha256File(path) });
}

function validateManifestObject(value: unknown, source: string): ReportProvenanceManifest {
  const errors: string[] = [];
  if (!isRecord(value)) throw new Error(`${source}: ReportProvenance.v1 must be an object`);
  rejectUnknown(value, ROOT_KEYS, "", errors);
  if (value.schema_version !== "1") errors.push("schema_version must be 1");
  const id = textValue(value.finding_id);
  if (!SAFE_ID.test(id)) errors.push("finding_id must be a safe filename id");
  const generatedAt = textValue(value.generated_at);
  if (!isCanonicalTimestamp(generatedAt)) errors.push("generated_at must be a real ISO 8601 UTC timestamp");
  const roles: ReportProvenanceRole[] = [];
  const paths = new Set<string>();
  if (!Array.isArray(value.inputs)) {
    errors.push("inputs must be a list");
  } else {
    value.inputs.forEach((item, index) => {
      const prefix = `inputs[${index}]`;
      if (!isRecord(item)) {
        errors.push(`${prefix} must be an object`);
        return;
      }
      rejectUnknown(item, INPUT_KEYS, prefix, errors);
      if (!ROLES.has(item.role as ReportProvenanceRole)) errors.push(`${prefix}.role is unsupported`);
      else roles.push(item.role as ReportProvenanceRole);
      const path = textValue(item.path);
      if (!path || path !== path.trim() || /[\u0000-\u001f\u007f]/.test(path)) {
        errors.push(`${prefix}.path must be canonical single-line text`);
      } else if (paths.has(path)) errors.push(`${prefix}.path must be unique`);
      paths.add(path);
      if (!SHA256.test(textValue(item.sha256))) errors.push(`${prefix}.sha256 must be a lowercase SHA-256`);
    });
  }
  if (roles.filter((role) => role === "evidence").length !== 1) errors.push("inputs must contain exactly one evidence role");
  if (!roles.includes("report")) errors.push("inputs must contain at least one report role");
  if (errors.length > 0) {
    throw new Error(`${source}: ReportProvenance.v1 validation failed:\n- ${errors.join("\n- ")}`);
  }
  return value as unknown as ReportProvenanceManifest;
}

function portablePath(path: string, projectRoot: string): string {
  const root = resolve(projectRoot);
  const absolute = resolve(path);
  const candidate = relative(root, absolute);
  return candidate && candidate !== ".." && !candidate.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)
    ? candidate
    : absolute;
}

function resolveInputPath(path: string, projectRoot: string): string {
  return isAbsolute(path) ? path : join(projectRoot, path);
}

function parseEvidence(text: string, source: string): Record<string, unknown> {
  try {
    const value = parseYaml(text);
    if (!isRecord(value)) throw new Error("Evidence YAML must be a mapping");
    return value;
  } catch (error) {
    throw new Error(`${source}: ${errorMessage(error)}`);
  }
}

function stringList(value: Record<string, unknown>, path: string): string[] {
  let current: unknown = value;
  for (const part of path.split(".")) {
    if (!isRecord(current)) return [];
    current = current[part];
  }
  return Array.isArray(current)
    ? current.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function resolveFindingPath(id: string, projectRoot: string): string {
  for (const suffix of [".yaml", ".yml"]) {
    const path = join(findingsDir(projectRoot), `${id}${suffix}`);
    if (existsSync(path)) return path;
  }
  return join(findingsDir(projectRoot), `${id}.yaml`);
}

function normalizeId(target: string): string {
  const id = target.replace(/\.ya?ml$/i, "");
  if (!SAFE_ID.test(id)) {
    throw new Error("finding id must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens");
  }
  return id;
}

async function writeAtomic(path: string, text: string, force: boolean): Promise<void> {
  if (!force) {
    try {
      await writeFile(path, text, { encoding: "utf-8", flag: "wx" });
      return;
    } catch (error) {
      if (errorCode(error) === "EEXIST") {
        throw new Error(`report provenance already exists: ${path}; pass --force to replace it`);
      }
      throw error;
    }
  }
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, text, { encoding: "utf-8", flag: "wx" });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function rejectUnknown(value: Record<string, unknown>, allowed: Set<string>, prefix: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`unknown field ${prefix ? `${prefix}.` : ""}${key}`);
  }
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === "string" ? error.code : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
