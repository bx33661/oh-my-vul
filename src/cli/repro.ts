// repro.ts — repro artifact and report artifact logic
// Extracted from findings.ts.

import { existsSync } from "fs";
import { mkdir, readFile, readdir, stat, writeFile } from "fs/promises";
import { isAbsolute, join } from "path";
import { parseDocument } from "yaml";
import { findingsDir, findingReportsDir, findingReproDir } from "./paths.js";

// ── Types ───────────────────────────────────────────────────────────────

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

// ── Public API ──────────────────────────────────────────────────────────

export async function initReproArtifacts(
  target: string,
  findingPath: string,
  projectRoot = process.cwd(),
  options: { force?: boolean } = {},
): Promise<ReproInitResult> {
  const id = normalizeFindingId(target);
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

  return { id, path: dir, findingPath, artifacts, written, skipped, updatedFinding };
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

// ── Private helpers ─────────────────────────────────────────────────────

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

function parseEvidenceYaml(text: string): { data: Record<string, unknown>; errors: string[] } {
  const { parse: parseYaml } = requireModule("yaml");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

import { createRequire } from "module";
const requireModule = createRequire(import.meta.url);
