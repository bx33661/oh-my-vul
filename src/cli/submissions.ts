import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { submissionPath, submissionsDir, resolveProjectRoot } from "./paths.js";
import { appendWorkspaceActivity, ensureWorkspaceDirs } from "./workspace.js";

export interface SubmissionRecord {
  platform: string;
  submissionId: string;
  url: string;
  status: "open" | "closed";
  recordedAt: string;
  closedAt?: string;
  cve?: string;
}

export interface FindingSubmissions {
  schema_version: "1";
  finding_id: string;
  records: SubmissionRecord[];
}

export async function recordSubmission(
  id: string,
  input: { platform: string; submissionId: string; url: string },
  projectRoot = resolveProjectRoot(),
): Promise<FindingSubmissions> {
  validatePlatform(input.platform);
  validateUrl(input.url);
  await ensureWorkspaceDirs(projectRoot);
  await mkdir(submissionsDir(projectRoot), { recursive: true });
  const current = await readSubmissions(id, projectRoot);
  const now = new Date().toISOString();
  const next: FindingSubmissions = {
    ...current,
    records: [
      ...current.records.filter((record) => record.platform !== input.platform || record.submissionId !== input.submissionId),
      {
        platform: input.platform,
        submissionId: input.submissionId,
        url: input.url,
        status: "open" as const,
        recordedAt: now,
      },
    ].sort((left, right) => left.platform.localeCompare(right.platform) || left.submissionId.localeCompare(right.submissionId)),
  };
  await writeSubmissions(id, next, projectRoot);
  await appendWorkspaceActivity({ action: "submission.record", id, path: submissionPath(id, projectRoot) }, projectRoot);
  return next;
}

export async function trackSubmissions(id: string, projectRoot = resolveProjectRoot()): Promise<FindingSubmissions> {
  return readSubmissions(id, projectRoot);
}

export async function closeSubmission(id: string, cve: string, projectRoot = resolveProjectRoot()): Promise<FindingSubmissions> {
  if (!/^CVE-\d{4}-\d{4,}$/.test(cve)) {
    throw new Error("--cve must use CVE-YYYY-NNNN format");
  }
  const current = await readSubmissions(id, projectRoot);
  if (current.records.length === 0) {
    throw new Error(`no submission records found for ${id}`);
  }
  const now = new Date().toISOString();
  const next: FindingSubmissions = {
    ...current,
    records: current.records.map((record) => ({
      ...record,
      status: "closed",
      closedAt: record.closedAt ?? now,
      cve,
    })),
  };
  await writeSubmissions(id, next, projectRoot);
  await appendWorkspaceActivity({ action: "submission.close", id, status: "closed", path: submissionPath(id, projectRoot) }, projectRoot);
  return next;
}

export async function readSubmissions(id: string, projectRoot = resolveProjectRoot()): Promise<FindingSubmissions> {
  const path = submissionPath(id, projectRoot);
  if (!existsSync(path)) {
    return { schema_version: "1", finding_id: id, records: [] };
  }
  const parsed = parseYaml(await readFile(path, "utf-8"));
  if (!isRecord(parsed)) {
    return { schema_version: "1", finding_id: id, records: [] };
  }
  const records = Array.isArray(parsed.records) ? parsed.records.filter(isRecord).map(normalizeRecord) : [];
  return {
    schema_version: "1",
    finding_id: typeof parsed.finding_id === "string" ? parsed.finding_id : id,
    records,
  };
}

async function writeSubmissions(id: string, data: FindingSubmissions, projectRoot: string): Promise<void> {
  await mkdir(submissionsDir(projectRoot), { recursive: true });
  await writeFile(submissionPath(id, projectRoot), stringifyYaml(data), "utf-8");
}

function normalizeRecord(record: Record<string, unknown>): SubmissionRecord {
  const status = record.status === "closed" ? "closed" : "open";
  return {
    platform: String(record.platform ?? "unknown"),
    submissionId: String(record.submissionId ?? record.submission_id ?? "unknown"),
    url: String(record.url ?? ""),
    status,
    recordedAt: String(record.recordedAt ?? record.recorded_at ?? ""),
    closedAt: typeof record.closedAt === "string" ? record.closedAt : typeof record.closed_at === "string" ? record.closed_at : undefined,
    cve: typeof record.cve === "string" ? record.cve : undefined,
  };
}

function validatePlatform(platform: string): void {
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(platform)) {
    throw new Error("--platform must be 1-64 letters, numbers, dots, underscores, or hyphens");
  }
}

function validateUrl(value: string): void {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("--url must be an http or https URL");
    }
  } catch {
    throw new Error("--url must be a valid URL");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
