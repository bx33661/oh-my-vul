import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { sha256File } from "./install-manifest.js";
import { findingsDir, sourceRefPath, sourcesDir, resolveProjectRoot } from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

export type SourceRefKind = "repository" | "registry" | "archive" | "file" | "advisory" | "other";

export interface SourceRefEntry {
  kind: SourceRefKind;
  locator: string;
  revision: string;
  path: string;
  sha256: string;
}

export interface SourceRef {
  schema_version: "1";
  finding_id: string;
  finding_sha256: string;
  captured_at: string;
  sources: SourceRefEntry[];
}

export interface SourceRefInitOptions {
  force?: boolean;
  now?: () => Date;
}

export interface SourceRefInitResult {
  id: string;
  path: string;
  findingPath: string;
  sourceRef: SourceRef;
  overwritten: boolean;
  warnings: string[];
}

export interface SourceRefValidation {
  id: string;
  path: string;
  findingPath: string;
  sourceRef: SourceRef;
  ok: boolean;
  stale: boolean;
  errors: string[];
  warnings: string[];
}

export type SourceRefDetail = SourceRefValidation;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SOURCE_KINDS = new Set<SourceRefKind>([
  "repository",
  "registry",
  "archive",
  "file",
  "advisory",
  "other",
]);
const ROOT_KEYS = new Set(["schema_version", "finding_id", "finding_sha256", "captured_at", "sources"]);
const SOURCE_KEYS = new Set(["kind", "locator", "revision", "path", "sha256"]);

export async function initSourceRef(
  target: string,
  projectRoot = resolveProjectRoot(),
  options: SourceRefInitOptions = {},
): Promise<SourceRefInitResult> {
  const id = normalizeSourceId(target);
  const findingPath = resolveFindingPath(id, projectRoot);
  if (!existsSync(findingPath)) {
    throw new Error(`${findingPath} does not exist`);
  }

  const evidence = parseEvidence(await readFile(findingPath, "utf-8"), findingPath);
  const current = (options.now ?? (() => new Date()))();
  if (!(current instanceof Date) || Number.isNaN(current.getTime())) {
    throw new Error("now must return a valid Date");
  }
  const sources = sourceEntriesFromEvidence(evidence);
  const sourceRef: SourceRef = {
    schema_version: "1",
    finding_id: id,
    finding_sha256: await sha256File(findingPath),
    captured_at: current.toISOString(),
    sources,
  };
  validateSourceRefObject(sourceRef, "SourceRef.v1");

  await mkdir(sourcesDir(projectRoot), { recursive: true });
  const path = sourceRefPath(id, projectRoot);
  const overwritten = existsSync(path);
  if (overwritten && !options.force) {
    throw new Error(`SourceRef already exists: ${path}; pass --force to replace it`);
  }
  await writeAtomic(path, stringifyYaml(sourceRef), Boolean(options.force));
  const warnings = sources.length === 0
    ? ["Evidence contains no known source identity; SourceRef sources remain empty"]
    : [];
  try {
    await appendWorkspaceActivity({ action: "source.init", id, path }, projectRoot);
  } catch (error) {
    warnings.push(`SourceRef written, but activity recording failed: ${errorMessage(error)}`);
  }
  return {
    id,
    path,
    findingPath,
    sourceRef,
    overwritten,
    warnings,
  };
}

export async function validateSourceRef(
  target: string,
  projectRoot = resolveProjectRoot(),
): Promise<SourceRefValidation> {
  const id = normalizeSourceId(target);
  const path = sourceRefPath(id, projectRoot);
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist`);
  }
  const sourceRef = parseSourceRefYaml(await readFile(path, "utf-8"), path);
  const findingPath = resolveFindingPath(id, projectRoot);
  const warnings: string[] = [];
  let stale = false;
  if (!existsSync(findingPath)) {
    warnings.push(`${findingPath} does not exist; cannot check SourceRef freshness`);
  } else {
    stale = await sha256File(findingPath) !== sourceRef.finding_sha256;
    if (stale) {
      warnings.push("SourceRef finding_sha256 is stale; Evidence.v1 changed after source capture");
    }
  }
  return {
    id,
    path,
    findingPath,
    sourceRef,
    ok: true,
    stale,
    errors: [],
    warnings,
  };
}

export async function showSourceRef(
  target: string,
  projectRoot = resolveProjectRoot(),
): Promise<SourceRefDetail> {
  return validateSourceRef(target, projectRoot);
}

export function parseSourceRefYaml(text: string, source = "SourceRef.v1 YAML"): SourceRef {
  let value: unknown;
  try {
    value = parseYaml(text);
  } catch (error) {
    throw new Error(`${source}: SourceRef YAML parse error: ${errorMessage(error)}`);
  }
  const sourceRef = validateSourceRefObject(value, source);
  const fileId = sourceIdFromPath(source);
  if (fileId && sourceRef.finding_id !== fileId) {
    throw new Error(`${source}: finding id must match filename id ${fileId}`);
  }
  return sourceRef;
}

function validateSourceRefObject(value: unknown, source: string): SourceRef {
  const errors: string[] = [];
  if (!isRecord(value)) {
    throw new Error(`${source}: SourceRef.v1 must be a mapping`);
  }
  rejectUnknown(value, ROOT_KEYS, "", errors);
  if (value.schema_version !== "1") errors.push("schema_version must be 1");
  const findingId = textValue(value.finding_id);
  if (!SAFE_ID.test(findingId)) errors.push("finding_id must be a safe filename id");
  const findingHash = textValue(value.finding_sha256);
  if (!SHA256.test(findingHash)) errors.push("finding_sha256 must be a lowercase SHA-256");
  const capturedAt = textValue(value.captured_at);
  if (!isCanonicalTimestamp(capturedAt)) errors.push("captured_at must be a real ISO 8601 UTC timestamp");
  if (!Array.isArray(value.sources)) {
    errors.push("sources must be a list");
  } else {
    value.sources.forEach((item, index) => validateSourceEntry(item, index, errors));
  }
  if (errors.length > 0) {
    throw new Error(`${source}: SourceRef.v1 validation failed:\n- ${errors.join("\n- ")}`);
  }
  return value as unknown as SourceRef;
}

function validateSourceEntry(value: unknown, index: number, errors: string[]): void {
  const prefix = `sources[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${prefix} must be a mapping`);
    return;
  }
  rejectUnknown(value, SOURCE_KEYS, prefix, errors);
  if (!SOURCE_KINDS.has(value.kind as SourceRefKind)) {
    errors.push(`${prefix}.kind must be repository, registry, archive, file, advisory, or other`);
  }
  for (const key of ["locator", "revision", "path"] as const) {
    const text = textValue(value[key]);
    if (!text || text !== text.trim() || hasControl(text)) {
      errors.push(`${prefix}.${key} must be non-empty canonical single-line text`);
    }
  }
  const hash = textValue(value.sha256);
  if (hash !== "unknown" && !SHA256.test(hash)) {
    errors.push(`${prefix}.sha256 must be unknown or a lowercase SHA-256`);
  }
}

function sourceEntriesFromEvidence(evidence: Record<string, unknown>): SourceRefEntry[] {
  const entries: SourceRefEntry[] = [];
  const repository = nestedString(evidence, "package.repository_url");
  if (known(repository)) {
    entries.push(unknownSource("repository", repository));
  }
  const ecosystem = nestedString(evidence, "package.ecosystem");
  const registryName = nestedString(evidence, "package.registry_name");
  if (known(ecosystem) && known(registryName)) {
    entries.push(unknownSource("registry", `${ecosystem}:${registryName}`));
  }
  return entries;
}

function unknownSource(kind: SourceRefKind, locator: string): SourceRefEntry {
  return { kind, locator, revision: "unknown", path: "unknown", sha256: "unknown" };
}

function parseEvidence(text: string, source: string): Record<string, unknown> {
  try {
    const parsed = parseYaml(text);
    if (!isRecord(parsed)) throw new Error("Evidence YAML must be a mapping");
    return parsed;
  } catch (error) {
    throw new Error(`${source}: ${errorMessage(error)}`);
  }
}

function resolveFindingPath(id: string, projectRoot: string): string {
  for (const suffix of [".yaml", ".yml"]) {
    const path = join(findingsDir(projectRoot), `${id}${suffix}`);
    if (existsSync(path)) return path;
  }
  return join(findingsDir(projectRoot), `${id}.yaml`);
}

function normalizeSourceId(target: string): string {
  const id = target.replace(/\.ya?ml$/i, "");
  if (!SAFE_ID.test(id)) {
    throw new Error("source id must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens");
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
        throw new Error(`SourceRef already exists: ${path}; pass --force to replace it`);
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

function sourceIdFromPath(source: string): string | undefined {
  const name = basename(source);
  return /\.ya?ml$/i.test(name) ? name.replace(/\.ya?ml$/i, "") : undefined;
}

function isCanonicalTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function nestedString(value: Record<string, unknown>, path: string): string {
  let current: unknown = value;
  for (const part of path.split(".")) {
    if (!isRecord(current)) return "";
    current = current[part];
  }
  return typeof current === "string" ? current.trim() : "";
}

function textValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function known(value: string): boolean {
  return Boolean(value) && value.toLowerCase() !== "unknown";
}

function hasControl(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
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
