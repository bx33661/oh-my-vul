import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { packageRoot } from "../../paths.js";

export type PublicJsonType = "array" | "boolean" | "null" | "number" | "object" | "string";

export interface PublicJsonCommandContract {
  command: string;
  result_kind: "array" | "object";
  required: Record<string, PublicJsonType>;
  item_required?: Record<string, PublicJsonType>;
  exit_behavior: string;
}

export interface PublicJsonContractInventory {
  schema_version: "1";
  compatibility: {
    additive_fields: boolean;
    one_document: boolean;
    stderr_is_not_json: boolean;
  };
  commands: PublicJsonCommandContract[];
}

export async function loadPublicJsonContracts(): Promise<PublicJsonContractInventory> {
  const path = join(packageRoot(), "contracts", "cli-json.v1.json");
  return JSON.parse(await readFile(path, "utf-8")) as PublicJsonContractInventory;
}

export function validatePublicJsonResult(
  contract: PublicJsonCommandContract,
  value: unknown,
): string[] {
  const errors: string[] = [];
  const actualKind = jsonType(value);
  if (actualKind !== contract.result_kind) {
    return [`result must be ${contract.result_kind}, got ${actualKind}`];
  }
  validateFields(contract.required, value, "result", errors);
  if (Array.isArray(value) && contract.item_required) {
    value.forEach((item, index) => validateFields(contract.item_required ?? {}, item, `result[${index}]`, errors));
  }
  return errors;
}

function validateFields(
  fields: Record<string, PublicJsonType>,
  value: unknown,
  label: string,
  errors: string[],
): void {
  if (!isRecord(value)) {
    if (Object.keys(fields).length > 0) errors.push(`${label} must be an object`);
    return;
  }
  for (const [path, expected] of Object.entries(fields)) {
    const resolved = resolvePath(value, path);
    if (!resolved.found) {
      errors.push(`${label}.${path} is required`);
    } else if (jsonType(resolved.value) !== expected) {
      errors.push(`${label}.${path} must be ${expected}, got ${jsonType(resolved.value)}`);
    }
  }
}

function resolvePath(value: Record<string, unknown>, path: string): { found: boolean; value?: unknown } {
  let current: unknown = value;
  for (const segment of path.split(".")) {
    if (!isRecord(current) || !(segment in current)) return { found: false };
    current = current[segment];
  }
  return { found: true, value: current };
}

function jsonType(value: unknown): PublicJsonType | "undefined" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "undefined";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
