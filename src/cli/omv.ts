#!/usr/bin/env node
import { setup } from "./setup.js";
import { doctor } from "./doctor.js";
import {
  listFindings,
  validateFinding,
  validateFindings,
  promoteFinding,
  createFindingTemplate,
  type FindingTemplateResult,
  type EvidenceStatus,
  type FindingSummary,
  type FindingValidation,
} from "./findings.js";

const args = process.argv.slice(2);
const command = args[0];

function usage(): void {
  console.log(`oh-my-vul — vulnerability research skills for Claude Code

Usage:
  omv setup [--scope user|project] [--force] [--dry-run]
                                     Install skills to ~/.claude/skills/ or ./.claude/skills/
  omv doctor [--scope user|project] [--json]
                                     Check installation health
  omv findings list [--json]        List .omv/findings evidence files
  omv findings init <id> [--status candidate|confirmed|blocked] [--force] [--json]
                                     Create an Evidence.v1 finding template
  omv findings validate [id|path] [--json]
                                     Validate one finding or the whole ledger
  omv findings promote <id|path> --status candidate|confirmed|blocked
                                     Update a finding status and revalidate it
  omv help                           Show this message

Examples:
  npx oh-my-vul setup
  npx oh-my-vul setup --scope project
  npx oh-my-vul setup --force
  omv doctor
  omv doctor --json
  omv findings list
  omv findings init demo
  omv findings validate
  omv findings promote demo --status confirmed
`);
}

async function runSetup(): Promise<void> {
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const scope = parseScope("user");

  if (dryRun) {
    console.log("Dry run — no files will be written.\n");
  }

  const result = await setup({ force, dryRun, scope });

  console.log(`Scope: ${result.scope}`);
  console.log(`Destination: ${result.destination}\n`);

  for (const name of result.installed) {
    console.log(`  installed  ${name}`);
  }
  for (const name of result.skipped) {
    console.log(`  skipped    ${name}  (already installed; use --force to overwrite)`);
  }
  for (const msg of result.errors) {
    console.error(`  error      ${msg}`);
  }

  const total = result.installed.length + result.skipped.length;
  if (result.errors.length === 0) {
    console.log(`\n${result.installed.length}/${total} skill(s) installed.`);
  } else {
    console.error(`\n${result.errors.length} error(s). ${result.installed.length} installed.`);
    process.exit(1);
  }
}

async function runDoctor(): Promise<void> {
  const json = args.includes("--json");
  const scope = parseOptionalScope();
  const result = await doctor({ scope });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      process.exit(1);
    }
    return;
  }

  console.log(`Scope: ${result.scope}`);
  console.log(`Skills: ${result.skillsDir}\n`);

  for (const check of result.checks) {
    const icon = check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗";
    console.log(`  ${icon}  ${check.name.padEnd(24)} ${check.message}`);
  }

  if (result.ok) {
    console.log(result.warnings ? "\nChecks passed with warnings." : "\nAll checks passed.");
  } else {
    console.error("\nSome checks failed.");
    process.exit(1);
  }
}

async function runFindings(): Promise<void> {
  const subcommand = args[1] ?? "list";
  const json = args.includes("--json");

  switch (subcommand) {
    case "list":
      await runFindingsList(json);
      return;
    case "init":
      await runFindingsInit(json);
      return;
    case "validate":
      await runFindingsValidate(json);
      return;
    case "promote":
      await runFindingsPromote(json);
      return;
    case "help":
    case "--help":
    case "-h":
      usage();
      return;
    default:
      console.error(`Unknown findings command: ${subcommand}\n`);
      usage();
      process.exit(1);
  }
}

async function runFindingsList(json: boolean): Promise<void> {
  const findings = await listFindings();
  if (json) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }

  if (findings.length === 0) {
    console.log("No findings yet. Add Evidence.v1 YAML files under .omv/findings/.");
    return;
  }

  printFindingSummaries(findings);
}

async function runFindingsInit(json: boolean): Promise<void> {
  const id = firstPositionalAfter("init");
  const status = parseStatus() ?? "candidate";
  const force = args.includes("--force");

  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await createFindingTemplate(id, { status, force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printFindingTemplateResult(result);
}

async function runFindingsValidate(json: boolean): Promise<void> {
  const target = firstPositionalAfter("validate");
  const results = target ? [await validateFinding(target)] : await validateFindings();
  const ok = results.every((result) => result.ok);

  if (json) {
    console.log(JSON.stringify(target ? results[0] : results, null, 2));
    if (!ok) {
      process.exit(1);
    }
    return;
  }

  if (results.length === 0) {
    console.log("No findings to validate.");
    return;
  }

  for (const result of results) {
    printFindingValidation(result);
  }

  if (!ok) {
    process.exit(1);
  }
}

async function runFindingsPromote(json: boolean): Promise<void> {
  const target = firstPositionalAfter("promote");
  const status = parseStatus();

  if (!target) {
    console.error("Missing finding id or path.");
    process.exit(1);
  }
  if (!status) {
    console.error("Missing --status. Valid values: candidate, confirmed, blocked");
    process.exit(1);
  }

  const result = await promoteFinding(target, status);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printFindingValidation(result);
  }
  if (!result.ok) {
    process.exit(1);
  }
}

function printFindingSummaries(findings: FindingSummary[]): void {
  console.log("ID".padEnd(24) + "STATUS".padEnd(12) + "READY".padEnd(8) + "PACKAGE".padEnd(28) + "VULNERABILITY");
  for (const finding of findings) {
    console.log(
      finding.id.padEnd(24) +
        finding.status.padEnd(12) +
        `${finding.readiness}/100`.padEnd(8) +
        `${finding.ecosystem}:${finding.package}`.padEnd(28) +
        finding.vulnerability,
    );
  }
}

function printFindingValidation(result: FindingValidation): void {
  const marker = result.ok ? "OK" : "FAIL";
  console.log(`${marker} ${result.id} (${result.status}, readiness ${result.readiness}/100)`);
  for (const error of result.errors) {
    console.log(`  error   ${error}`);
  }
  for (const warning of result.warnings) {
    console.log(`  warning ${warning}`);
  }
}

function printFindingTemplateResult(result: FindingTemplateResult): void {
  console.log(`Created ${result.path}`);
  console.log(`Status: ${result.status}`);
  console.log(`Next: fill verified evidence, then run: omv findings validate ${result.id}`);
}

function firstPositionalAfter(subcommand: string): string | undefined {
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

function optionTakesValue(option: string): boolean {
  return option === "--scope" || option === "--status";
}

function parseStatus(): EvidenceStatus | undefined {
  const index = args.indexOf("--status");
  const raw = index === -1 ? undefined : args[index + 1];
  if (raw === "candidate" || raw === "confirmed" || raw === "blocked") {
    return raw;
  }
  return undefined;
}

function parseOptionalScope(): "user" | "project" | undefined {
  const index = args.indexOf("--scope");
  if (index === -1) {
    return undefined;
  }
  return parseScope("user");
}

function parseScope(defaultScope: "user" | "project"): "user" | "project" {
  const index = args.indexOf("--scope");
  const raw = index === -1 ? defaultScope : args[index + 1];
  if (raw === "user" || raw === "project") {
    return raw;
  }
  console.error(`Invalid --scope: ${raw ?? ""}. Valid values: user, project`);
  process.exit(1);
}

switch (command) {
  case "setup":
    runSetup().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "doctor":
    runDoctor().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "findings":
    runFindings().catch((err) => {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    });
    break;
  case "help":
  case "--help":
  case "-h":
  case undefined:
    usage();
    break;
  default:
    console.error(`Unknown command: ${command}\n`);
    usage();
    process.exit(1);
}
