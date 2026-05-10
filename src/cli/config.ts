import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname } from "path";
import { claudeHome } from "./paths.js";

export interface ConfigStore {
  scope?: "user" | "project";
}

export function configPath(): string {
  return `${claudeHome()}/.omv/config.json`;
}

export async function readConfig(): Promise<ConfigStore> {
  const path = configPath();
  if (!existsSync(path)) {
    return {};
  }
  try {
    const parsed = JSON.parse(await readFile(path, "utf-8")) as unknown;
    if (isRecord(parsed)) {
      return {
        scope: parsed.scope === "project" ? "project" : parsed.scope === "user" ? "user" : undefined,
      };
    }
  } catch {
    // fall through
  }
  return {};
}

export async function writeConfig(config: ConfigStore): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

export async function configGet(key: string): Promise<string | undefined> {
  const config = await readConfig();
  if (key === "scope") return config.scope;
  return undefined;
}

export async function configSet(key: string, value: string): Promise<void> {
  const config = await readConfig();
  if (key === "scope") {
    if (value !== "user" && value !== "project") {
      throw new Error(`scope must be "user" or "project", got "${value}"`);
    }
    config.scope = value;
  } else {
    throw new Error(`Unknown config key: ${key}. Valid keys: scope`);
  }
  await writeConfig(config);
}

export async function configUnset(key: string): Promise<void> {
  const config = await readConfig();
  if (key === "scope") {
    delete config.scope;
  } else {
    throw new Error(`Unknown config key: ${key}. Valid keys: scope`);
  }
  await writeConfig(config);
}

export async function configList(): Promise<Record<string, string>> {
  const config = await readConfig();
  const result: Record<string, string> = {};
  if (config.scope) {
    result.scope = config.scope;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
