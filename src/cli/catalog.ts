import { readFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml } from "yaml";
import { packageRoot } from "./paths.js";

export interface SkillCatalogEntry {
  name: string;
  path: string;
  invocation: string;
  status: string;
  category?: string;
  description: string;
  produces: string[];
  consumes: string[];
}

export interface OmvCatalog {
  name: string;
  version: string;
  platform: string;
  updated: string;
  skills: SkillCatalogEntry[];
}

const INSTALLABLE_STATUSES = new Set(["active", "internal", "stable"]);

export async function readCatalog(registryPath = join(packageRoot(), "registry.yaml")): Promise<OmvCatalog> {
  const text = await readFile(registryPath, "utf-8");
  return parseCatalog(text);
}

export function getInstallableSkills(catalog: OmvCatalog): SkillCatalogEntry[] {
  return catalog.skills.filter((skill) => INSTALLABLE_STATUSES.has(skill.status));
}

export function parseCatalog(text: string): OmvCatalog {
  const parsed = parseYaml(text);
  const data = isRecord(parsed) ? parsed : {};
  return {
    name: asString(data.name),
    version: asString(data.version),
    platform: asString(data.platform),
    updated: asString(data.updated),
    skills: asList(data.skills).filter(isRecord).map(skillFromYaml),
  };
}

function skillFromYaml(data: Record<string, unknown>): SkillCatalogEntry {
  return {
    name: asString(data.name),
    path: asString(data.path),
    invocation: asString(data.invocation),
    status: asString(data.status),
    category: asOptionalString(data.category),
    description: asString(data.description),
    produces: asStringList(data.produces),
    consumes: asStringList(data.consumes),
  };
}

function asString(value: unknown): string {
  return value === undefined || value === null ? "" : String(value);
}

function asOptionalString(value: unknown): string | undefined {
  return value === undefined || value === null ? undefined : String(value);
}

function asStringList(value: unknown): string[] {
  return asList(value).map((item) => String(item));
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
