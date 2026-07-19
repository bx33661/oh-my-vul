import { readFile, writeFile } from "fs/promises";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { resolveProjectRoot } from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

export interface DedupQueryPlan {
  id: string;
  path: string;
  queries: string[];
}

export interface DedupUpdateResult extends DedupQueryPlan {
  updated: boolean;
}

export async function planDedup(targetPath: string, id: string): Promise<DedupQueryPlan> {
  const parsed = parseEvidence(await readFile(targetPath, "utf-8"));
  const pkg = getString(parsed, "package.registry_name") || getString(parsed, "package.product") || id;
  const ecosystem = getString(parsed, "package.ecosystem") || "unknown";
  const vuln = getString(parsed, "vulnerability.class") || "vulnerability";
  const cwe = getString(parsed, "vulnerability.cwe");
  const affected = getString(parsed, "versions.affected_range");
  const terms = [pkg, vuln, cwe, affected].filter((value) => value && value !== "unknown");
  return {
    id,
    path: targetPath,
    queries: [
      `NVD: ${terms.join(" ")}`,
      `GHSA: ${terms.join(" ")}`,
      `OSV: ecosystem:${ecosystem} package:${pkg} ${vuln}`,
      `${ecosystem} advisory db: ${terms.join(" ")}`,
    ],
  };
}

export async function updateDedup(
  targetPath: string,
  id: string,
  input: { existingCve: string; notes: string; confirmed: boolean; projectRoot?: string },
): Promise<DedupUpdateResult> {
  const plan = await planDedup(targetPath, id);
  if (!input.confirmed) {
    return { ...plan, updated: false };
  }
  const parsed = parseEvidence(await readFile(targetPath, "utf-8"));
  const dedup = isRecord(parsed.dedup) ? parsed.dedup : {};
  parsed.dedup = {
    ...dedup,
    nvd_searched: true,
    ghsa_searched: true,
    ecosystem_db_searched: true,
    existing_cve: input.existingCve,
    notes: input.notes,
  };
  await writeFile(targetPath, stringifyYaml(parsed), "utf-8");
  await appendWorkspaceActivity({ action: "dedup.update", id, path: targetPath }, input.projectRoot ?? resolveProjectRoot());
  return { ...plan, updated: true };
}

function parseEvidence(text: string): Record<string, unknown> {
  const parsed = parseYaml(text);
  return isRecord(parsed) ? parsed : {};
}

function getString(data: Record<string, unknown>, path: string): string {
  let current: unknown = data;
  for (const part of path.split(".")) {
    if (!isRecord(current)) return "";
    current = current[part];
  }
  return typeof current === "string" ? current : current === undefined || current === null ? "" : String(current);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
