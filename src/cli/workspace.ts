import { existsSync, statSync } from "fs";
import { appendFile, mkdir, readFile, readdir, writeFile } from "fs/promises";
import { basename, join } from "path";
import { parse as parseYaml } from "yaml";
import {
  archiveMetadataDir,
  archiveMetadataPath,
  archivedFindingsDir,
  findingsDir,
  omvStateDir,
  reproDir,
  workspaceActivityLogPath,
  workspaceIndexPath,
} from "./paths.js";

export interface WorkspaceFindingIndexEntry {
  id: string;
  path: string;
  archived: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  archiveReason?: string;
}

export interface WorkspaceIndex {
  version: 1;
  generatedAt: string;
  findings: WorkspaceFindingIndexEntry[];
}

export interface WorkspaceStatus {
  root: string;
  findingsDir: string;
  archiveDir: string;
  indexPath: string;
  activeCount: number;
  archivedCount: number;
  statusCounts: Record<string, number>;
  staleIndex: boolean;
  warnings: string[];
}

export interface WorkspaceActivityEntry {
  timestamp: string;
  action: "workspace.init" | "finding.init" | "finding.promote" | "finding.archive" | "finding.restore";
  id?: string;
  status?: string;
  archived?: boolean;
  reason?: string;
  path?: string;
  from?: string;
  to?: string;
}

export interface ArchiveMetadata {
  id: string;
  status: string;
  archivedAt: string;
  archiveReason: string;
  sourcePath: string;
  archivePath: string;
  reportArtifactPaths?: string[];
}

export async function initWorkspace(projectRoot = process.cwd()): Promise<WorkspaceStatus> {
  await ensureWorkspaceDirs(projectRoot);
  await rebuildWorkspaceIndex(projectRoot);
  await appendWorkspaceActivity({ action: "workspace.init" }, projectRoot);
  return workspaceStatus(projectRoot);
}

export async function workspaceStatus(projectRoot = process.cwd()): Promise<WorkspaceStatus> {
  await ensureWorkspaceDirs(projectRoot);
  const staleIndex = await isWorkspaceIndexStale(projectRoot);
  if (staleIndex || !existsSync(workspaceIndexPath(projectRoot))) {
    await rebuildWorkspaceIndex(projectRoot);
  }
  const index = await readWorkspaceIndex(projectRoot);
  const statusCounts: Record<string, number> = {};
  for (const finding of index.findings.filter((entry) => !entry.archived)) {
    statusCounts[finding.status] = (statusCounts[finding.status] ?? 0) + 1;
  }

  return {
    root: omvStateDir(projectRoot),
    findingsDir: findingsDir(projectRoot),
    archiveDir: archivedFindingsDir(projectRoot),
    indexPath: workspaceIndexPath(projectRoot),
    activeCount: index.findings.filter((entry) => !entry.archived).length,
    archivedCount: index.findings.filter((entry) => entry.archived).length,
    statusCounts,
    staleIndex,
    warnings: await workspaceWarnings(projectRoot),
  };
}

export async function ensureWorkspaceDirs(projectRoot = process.cwd()): Promise<void> {
  await mkdir(findingsDir(projectRoot), { recursive: true });
  await mkdir(reproDir(projectRoot), { recursive: true });
  await mkdir(archivedFindingsDir(projectRoot), { recursive: true });
  await mkdir(archiveMetadataDir(projectRoot), { recursive: true });
}

export async function rebuildWorkspaceIndex(projectRoot = process.cwd()): Promise<WorkspaceIndex> {
  await ensureWorkspaceDirs(projectRoot);
  const generatedAt = new Date().toISOString();
  const existing = existsSync(workspaceIndexPath(projectRoot)) ? await readWorkspaceIndex(projectRoot) : emptyIndex();
  const existingByKey = new Map(existing.findings.map((entry) => [entryKey(entry.id, entry.archived), entry]));
  const active = await indexFindingDir(findingsDir(projectRoot), false, existingByKey, generatedAt, projectRoot);
  const archived = await indexFindingDir(archivedFindingsDir(projectRoot), true, existingByKey, generatedAt, projectRoot);
  const index: WorkspaceIndex = { version: 1, generatedAt, findings: [...active, ...archived] };
  await writeWorkspaceIndex(projectRoot, index);
  return index;
}

export async function readWorkspaceIndex(projectRoot = process.cwd()): Promise<WorkspaceIndex> {
  if (!existsSync(workspaceIndexPath(projectRoot))) {
    return emptyIndex();
  }
  const parsed = JSON.parse(await readFile(workspaceIndexPath(projectRoot), "utf-8")) as WorkspaceIndex;
  return {
    version: 1,
    generatedAt: parsed.generatedAt ?? "",
    findings: Array.isArray(parsed.findings) ? parsed.findings : [],
  };
}

export async function touchWorkspaceFinding(
  id: string,
  status: string,
  projectRoot = process.cwd(),
  options: { archived?: boolean; archiveReason?: string; archivedAt?: string } = {},
): Promise<void> {
  await ensureWorkspaceDirs(projectRoot);
  const now = new Date().toISOString();
  const index = existsSync(workspaceIndexPath(projectRoot)) ? await readWorkspaceIndex(projectRoot) : await rebuildWorkspaceIndex(projectRoot);
  const archived = options.archived ?? false;
  const key = entryKey(id, archived);
  const current = index.findings.find((entry) => entryKey(entry.id, entry.archived) === key);
  const path = join(archived ? archivedFindingsDir(projectRoot) : findingsDir(projectRoot), `${id}.yaml`);
  const entry: WorkspaceFindingIndexEntry = {
    id,
    path,
    archived,
    status,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    archivedAt: options.archivedAt ?? current?.archivedAt,
    archiveReason: options.archiveReason ?? current?.archiveReason,
  };
  const next = index.findings.filter((item) => entryKey(item.id, item.archived) !== key);
  next.push(entry);
  await writeWorkspaceIndex(projectRoot, { version: 1, generatedAt: now, findings: next.sort(compareEntries) });
}

export async function removeWorkspaceFinding(id: string, archived: boolean, projectRoot = process.cwd()): Promise<void> {
  const index = await readWorkspaceIndex(projectRoot);
  const now = new Date().toISOString();
  const findings = index.findings.filter((entry) => entryKey(entry.id, entry.archived) !== entryKey(id, archived));
  await writeWorkspaceIndex(projectRoot, { version: 1, generatedAt: now, findings });
}

export async function writeArchiveMetadata(metadata: ArchiveMetadata, projectRoot = process.cwd()): Promise<void> {
  await ensureWorkspaceDirs(projectRoot);
  await writeFile(archiveMetadataPath(metadata.id, projectRoot), `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
}

export async function readArchiveMetadata(id: string, projectRoot = process.cwd()): Promise<ArchiveMetadata | undefined> {
  const path = archiveMetadataPath(id, projectRoot);
  if (!existsSync(path)) {
    return undefined;
  }
  const parsed = JSON.parse(await readFile(path, "utf-8")) as ArchiveMetadata;
  return {
    id: parsed.id ?? id,
    status: parsed.status ?? "unknown",
    archivedAt: parsed.archivedAt ?? "unknown",
    archiveReason: parsed.archiveReason ?? "unknown",
    sourcePath: parsed.sourcePath ?? "",
    archivePath: parsed.archivePath ?? "",
    reportArtifactPaths: Array.isArray(parsed.reportArtifactPaths) ? parsed.reportArtifactPaths.map(String) : undefined,
  };
}

export async function appendWorkspaceActivity(
  entry: Omit<WorkspaceActivityEntry, "timestamp">,
  projectRoot = process.cwd(),
): Promise<WorkspaceActivityEntry> {
  await ensureWorkspaceDirs(projectRoot);
  const activity = { timestamp: new Date().toISOString(), ...entry };
  await appendFile(workspaceActivityLogPath(projectRoot), `${JSON.stringify(activity)}\n`, "utf-8");
  return activity;
}

export async function readWorkspaceActivity(projectRoot = process.cwd()): Promise<WorkspaceActivityEntry[]> {
  const path = workspaceActivityLogPath(projectRoot);
  if (!existsSync(path)) {
    return [];
  }
  const lines = (await readFile(path, "utf-8")).split(/\r?\n/).filter(Boolean);
  const entries: WorkspaceActivityEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as WorkspaceActivityEntry);
    } catch {
      // Ignore malformed manual edits; this is a local audit trail, not a contract.
    }
  }
  return entries;
}

async function writeWorkspaceIndex(projectRoot: string, index: WorkspaceIndex): Promise<void> {
  await ensureWorkspaceDirs(projectRoot);
  await writeFile(workspaceIndexPath(projectRoot), `${JSON.stringify(index, null, 2)}\n`, "utf-8");
}

async function indexFindingDir(
  dir: string,
  archived: boolean,
  existing: Map<string, WorkspaceFindingIndexEntry>,
  now: string,
  projectRoot: string,
): Promise<WorkspaceFindingIndexEntry[]> {
  if (!existsSync(dir)) {
    return [];
  }
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((dirent) => dirent.isFile() && /\.ya?ml$/.test(dirent.name))
    .map((dirent) => dirent.name)
    .sort();
  const entries: WorkspaceFindingIndexEntry[] = [];
  for (const file of files) {
    const path = join(dir, file);
    const id = basename(file).replace(/\.ya?ml$/, "");
    const previous = existing.get(entryKey(id, archived));
    const metadata = archived ? await readArchiveMetadata(id, projectRoot) : undefined;
    entries.push({
      id,
      path,
      archived,
      status: await readFindingStatus(path),
      createdAt: previous?.createdAt ?? now,
      updatedAt: previous?.updatedAt ?? now,
      archivedAt: metadata?.archivedAt ?? previous?.archivedAt,
      archiveReason: metadata?.archiveReason ?? previous?.archiveReason,
    });
  }
  return entries;
}

async function readFindingStatus(path: string): Promise<string> {
  try {
    const parsed = parseYaml(await readFile(path, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const status = (parsed as Record<string, unknown>).status;
      return typeof status === "string" ? status : "unknown";
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

async function isWorkspaceIndexStale(projectRoot: string): Promise<boolean> {
  const indexPath = workspaceIndexPath(projectRoot);
  if (!existsSync(indexPath)) {
    return true;
  }
  const indexMtime = statSync(indexPath).mtimeMs;
  for (const dir of [findingsDir(projectRoot), archivedFindingsDir(projectRoot)]) {
    if (!existsSync(dir)) {
      continue;
    }
    const files = await readdir(dir, { withFileTypes: true });
    for (const file of files) {
      if (file.isFile() && /\.ya?ml$/.test(file.name) && statSync(join(dir, file.name)).mtimeMs > indexMtime) {
        return true;
      }
    }
  }
  return false;
}

async function workspaceWarnings(projectRoot: string): Promise<string[]> {
  const gitignorePath = join(projectRoot, ".gitignore");
  if (!existsSync(gitignorePath)) {
    return [".omv/ is local research state; add .omv/ to .gitignore before publishing"];
  }
  const gitignore = await readFile(gitignorePath, "utf-8");
  const ignored = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".omv/" || line === ".omv" || line === "/.omv/" || line === "/.omv");
  return ignored ? [] : [".omv/ is local research state; add .omv/ to .gitignore before publishing"];
}

function emptyIndex(): WorkspaceIndex {
  return { version: 1, generatedAt: "", findings: [] };
}

function entryKey(id: string, archived: boolean): string {
  return `${archived ? "archived" : "active"}:${id}`;
}

function compareEntries(left: WorkspaceFindingIndexEntry, right: WorkspaceFindingIndexEntry): number {
  return Number(left.archived) - Number(right.archived) || left.id.localeCompare(right.id);
}
