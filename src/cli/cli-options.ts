import type { EvidenceStatus } from "./findings.js";

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

export function parseOptionalScopeOrExit(args: string[]): "user" | "project" | undefined {
  const index = args.indexOf("--scope");
  if (index === -1) {
    return undefined;
  }
  return parseScopeOrExit(args, "user");
}

export function parseScopeOrExit(args: string[], defaultScope: "user" | "project"): "user" | "project" {
  const index = args.indexOf("--scope");
  const raw = index === -1 ? defaultScope : args[index + 1];
  if (raw === "user" || raw === "project") {
    return raw;
  }
  console.error(`Invalid --scope: ${raw ?? ""}. Valid values: user, project`);
  process.exit(1);
}

function optionTakesValue(option: string): boolean {
  return option === "--scope" || option === "--status" || option === "--reason";
}
