import { readConfig } from "../config.js";
import type { EvidenceStatus } from "../findings.js";

/** Shared argument-parsing helpers and error handling for command modules.
 *  All helpers take the raw argv slice so command handlers stay pure. */

const VALUE_FLAGS = new Set([
  "--scope",
  "--status",
  "--reason",
  "--existing-cve",
  "--notes",
  "--days",
  "--platform",
  "--submission-id",
  "--url",
  "--cve",
  "--accept",
  "--target",
  "--version",
  "--source",
  "--ecosystem",
  "--mode",
  "--goal",
  "--budget",
  "--vuln",
  "--local-lab",
  "--id",
  "--skill",
  "--eval-id",
  "--output",
]);

export function wantsHelp(args: string[]): boolean {
  const command = args[0];
  return args.includes("--help") || args.includes("-h") || command === "help";
}

export function wantsJson(args: string[]): boolean {
  return args.includes("--json");
}

export function optionTakesValue(option: string): boolean {
  return VALUE_FLAGS.has(option);
}

export function firstPositionalAfter(args: string[], subcommand: string): string | undefined {
  const start = args.indexOf(subcommand) + 1;
  for (let index = start; index < args.length; index += 1) {
    const value = args[index];
    if (value.startsWith("--")) {
      index += optionTakesValue(value) ? 1 : 0;
      continue;
    }
    return value;
  }
  return undefined;
}

export function parseStatus(args: string[]): EvidenceStatus | undefined {
  const index = args.indexOf("--status");
  const raw = index === -1 ? undefined : args[index + 1];
  if (raw === "candidate" || raw === "confirmed" || raw === "blocked") {
    return raw;
  }
  return undefined;
}

export function parseReason(args: string[]): string | undefined {
  const index = args.indexOf("--reason");
  const raw = index === -1 ? undefined : args[index + 1];
  return raw && !raw.startsWith("--") ? raw : undefined;
}

export function parseOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  const raw = index === -1 ? undefined : args[index + 1];
  return raw && !raw.startsWith("--") ? raw : undefined;
}

export function requireOption(args: string[], name: string): string {
  const value = parseOption(args, name);
  if (!value) {
    throw new Error(`${name} requires a value`);
  }
  return value;
}

export async function resolveOptionalScope(args: string[]): Promise<"user" | "project" | undefined> {
  const index = args.indexOf("--scope");
  if (index === -1) {
    return undefined;
  }
  return resolveScope(args, "user");
}

export async function resolveScope(args: string[], defaultScope: "user" | "project"): Promise<"user" | "project"> {
  const index = args.indexOf("--scope");
  if (index === -1) {
    const config = await readConfig();
    return config.scope ?? defaultScope;
  }
  const raw = args[index + 1];
  if (raw === "user" || raw === "project") {
    return raw;
  }
  console.error(`Invalid --scope: ${raw ?? ""}. Valid values: user, project`);
  process.exit(1);
}

export function handleError(err: unknown): void {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
