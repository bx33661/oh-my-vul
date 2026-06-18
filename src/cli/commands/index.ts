import { validateArgs } from "../args.js";
import { usage, commandUsage } from "../usage.js";
import { wantsHelp, handleError } from "./shared.js";

import * as version from "./version.js";
import * as setup from "./setup.js";
import * as doctor from "./doctor.js";
import * as dashboard from "./dashboard.js";
import * as workspace from "./workspace.js";
import * as findings from "./findings.js";
import * as radar from "./radar.js";
import * as request from "./request.js";
import * as dedup from "./dedup.js";
import * as disclose from "./disclose.js";
import * as submissions from "./submissions.js";
import * as config from "./config.js";

const REGISTRY: Record<string, (args: string[]) => Promise<void>> = {
  version: version.run,
  setup: setup.run,
  uninstall: setup.runUninstall,
  doctor: doctor.run,
  dashboard: dashboard.run,
  workspace: workspace.run,
  findings: findings.run,
  radar: radar.run,
  request: request.run,
  dedup: dedup.run,
  disclose: disclose.run,
  submissions: submissions.run,
  config: config.run,
};

export async function run(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  const validation = validateArgs(args);
  if (!validation.ok) {
    console.error(`${validation.error}\n`);
    usage();
    process.exit(1);
  }

  if (wantsHelp(args)) {
    const topic = command === "help" ? args[1] : command;
    const subcommand = command === "help" ? args[2] : args[1];
    commandUsage(args, command, topic, subcommand);
    process.exit(0);
  }

  if (command === undefined) {
    usage();
    return;
  }

  const handler = REGISTRY[command];
  if (!handler) {
    console.error(`Unknown command: ${command}\n`);
    usage();
    process.exit(1);
  }

  await handler(args).catch(handleError);
}
