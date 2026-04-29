#!/usr/bin/env node
import { setup } from "./setup.js";
import { doctor } from "./doctor.js";

const args = process.argv.slice(2);
const command = args[0];

function usage(): void {
  console.log(`oh-my-vul — vulnerability research skills for Codex

Usage:
  omv setup [--force] [--dry-run]   Install skills to ~/.codex/skills/
  omv doctor                         Check installation health
  omv help                           Show this message

Examples:
  npx oh-my-vul setup
  npx oh-my-vul setup --force
  omv doctor
`);
}

async function runSetup(): Promise<void> {
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");

  if (dryRun) {
    console.log("Dry run — no files will be written.\n");
  }

  const result = await setup({ force, dryRun });

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
  const result = await doctor();

  for (const check of result.checks) {
    const icon = check.passed ? "✓" : "✗";
    console.log(`  ${icon}  ${check.name.padEnd(24)} ${check.message}`);
  }

  if (result.ok) {
    console.log("\nAll checks passed.");
  } else {
    console.error("\nSome checks failed.");
    process.exit(1);
  }
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
