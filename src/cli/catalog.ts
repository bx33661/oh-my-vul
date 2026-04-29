import { readFile } from "fs/promises";
import { join } from "path";
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
  const lines = text.split(/\r?\n/);
  const catalog: OmvCatalog = {
    name: "",
    version: "",
    platform: "",
    updated: "",
    skills: [],
  };

  for (const line of lines) {
    const match = line.match(/^([a-z_]+):\s*(.+)$/);
    if (!match) {
      if (line.trim() === "skills:") {
        break;
      }
      continue;
    }
    const [, key, value] = match;
    if (key === "name" || key === "version" || key === "platform" || key === "updated") {
      catalog[key] = parseScalar(value);
    }
  }

  let inSkills = false;
  let current: SkillCatalogEntry | null = null;
  let currentListKey: "produces" | "consumes" | null = null;

  for (const line of lines) {
    if (line.trim() === "skills:") {
      inSkills = true;
      continue;
    }
    if (inSkills && /^[a-z_]+:/.test(line)) {
      break;
    }
    if (!inSkills || !line.trim()) {
      continue;
    }

    const itemMatch = line.match(/^  - name:\s*(.+)$/);
    if (itemMatch) {
      if (current) {
        catalog.skills.push(current);
      }
      current = {
        name: parseScalar(itemMatch[1]),
        path: "",
        invocation: "",
        status: "",
        description: "",
        produces: [],
        consumes: [],
      };
      currentListKey = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const keyMatch = line.match(/^    ([a-z_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, rawKey, rawValue] = keyMatch;
      const key = rawKey as keyof SkillCatalogEntry;
      if (rawKey === "produces" || rawKey === "consumes") {
        currentListKey = rawKey;
        current[rawKey] = parseInlineList(rawValue);
        continue;
      }
      currentListKey = null;
      if (key === "name" || key === "path" || key === "invocation" || key === "status" || key === "category" || key === "description") {
        current[key] = parseScalar(rawValue);
      }
      continue;
    }

    const listMatch = line.match(/^      -\s*(.+)$/);
    if (listMatch && currentListKey) {
      current[currentListKey].push(parseScalar(listMatch[1]));
    }
  }

  if (current) {
    catalog.skills.push(current);
  }

  return catalog;
}

function parseInlineList(value: string): string[] {
  const trimmed = stripComment(value).trim();
  if (trimmed === "[]") {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    const body = trimmed.slice(1, -1).trim();
    if (!body) {
      return [];
    }
    return body.split(",").map(parseScalar);
  }
  return [];
}

function parseScalar(value: string): string {
  const trimmed = stripComment(value).trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function stripComment(value: string): string {
  return value.replace(/\s+#.*$/, "");
}
