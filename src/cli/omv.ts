#!/usr/bin/env node
import { validateArgs } from "./args.js";
import { runDashboard } from "./commands/dashboard.js";
import { runDoctor } from "./commands/doctor.js";
import { runFindings } from "./commands/findings.js";
import { runReport } from "./commands/report.js";
import { runRepro } from "./commands/repro.js";
import { runSetup } from "./commands/setup.js";
import { runVersion } from "./commands/version.js";
import { runWorkspace } from "./commands/workspace.js";
import { commandUsage, usage } from "./usage.js";

const args = process.argv.slice(2);
const command = args[0];

function wantsHelp(): boolean {
  return args.includes("--help") || args.includes("-h") || command === "help";
}

function run(commandName: string | undefined): Promise<void> | void {
  switch (commandName) {
    case "version":
      return runVersion(args);
    case "setup":
      return runSetup(args);
    case "doctor":
      return runDoctor(args);
    case "dashboard":
      return runDashboard(args);
    case "repro":
      return runRepro(args);
    case "report":
      return runReport(args);
    case "workspace":
      return runWorkspace(args);
    case "findings":
      return runFindings(args);
    case "help":
    case "--help":
    case "-h":
    case undefined:
      usage();
      return;
    default:
      console.error(`Unknown command: ${commandName}\n`);
      usage();
      process.exit(1);
  }
}

const validation = validateArgs(args);
if (!validation.ok) {
  console.error(`${validation.error}\n`);
  usage();
  process.exit(1);
}

if (wantsHelp()) {
  commandUsage(command === "help" ? args[1] : command, command === "help" ? args[2] : args[1]);
  process.exit(0);
}

Promise.resolve(run(command)).catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
