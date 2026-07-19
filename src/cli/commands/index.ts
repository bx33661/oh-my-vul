import { validateArgs } from "../args.js";
import { usage, commandUsage, commandSuggestions } from "../usage.js";
import { wantsHelp, handleError } from "./shared.js";
import { existsSync } from "node:fs";
import { omvStateDir } from "../paths.js";
import { printWelcome } from "../render.js";
import { plainPresenterRequested, shouldLaunchBareTui } from "../presenter.js";

import * as version from "./version.js";
import * as start from "./start.js";
import * as setup from "./setup.js";
import * as doctor from "./doctor.js";
import * as dashboard from "./dashboard.js";
import * as tui from "./tui.js";
import * as evalCommand from "./eval.js";
import * as review from "./review.js";
import * as campaign from "./campaign.js";
import * as workspace from "./workspace.js";
import * as findings from "./findings.js";
import * as radar from "./radar.js";
import * as request from "./request.js";
import * as dedup from "./dedup.js";
import * as disclose from "./disclose.js";
import * as submissions from "./submissions.js";
import * as config from "./config.js";
import * as repro from "./repro.js";
import * as report from "./report.js";
import * as sources from "./sources.js";
import * as threatMap from "./threat-map.js";
import * as verification from "./verification.js";

const REGISTRY: Record<string, (args: string[]) => Promise<void>> = {
  start: start.run,
  version: version.run,
  setup: setup.run,
  uninstall: setup.runUninstall,
  doctor: doctor.run,
  dashboard: dashboard.run,
  tui: tui.run,
  eval: evalCommand.run,
  campaign: campaign.run,
  review: review.run,
  workspace: workspace.run,
  findings: findings.run,
  radar: radar.run,
  request: request.run,
  dedup: dedup.run,
  disclose: disclose.run,
  submissions: submissions.run,
  config: config.run,
  repro: repro.run,
  report: report.run,
  sources: sources.run,
  "threat-map": threatMap.run,
  verification: verification.run,
};

export async function run(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const noTuiFlag = rawArgs.includes("--no-tui");
  const withoutNoTui = rawArgs.filter((argument) => argument !== "--no-tui");
  const rootExtraction = extractProjectRootOption(withoutNoTui);
  if (rootExtraction.error) {
    console.error(rootExtraction.error);
    console.error("\nRun 'omv help' to see the main commands.");
    process.exit(1);
  }
  if (rootExtraction.root) {
    // Prefer explicit CLI root over ambient env for this process.
    process.env.OMV_PROJECT_ROOT = rootExtraction.root;
  }
  const args = rootExtraction.args;
  const command = args[0];
  const presenterEnvironment = {
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    noTuiFlag,
    noTuiEnvironment: process.env.OMV_NO_TUI,
    ci: process.env.CI !== undefined && process.env.CI !== "false",
  };

  const validation = validateArgs(args);
  if (!validation.ok) {
    console.error(validation.error);
    if (command && validation.error?.startsWith("Unknown command:")) {
      const suggestions = commandSuggestions(command);
      if (suggestions.length > 0) {
        console.error(`\nDid you mean:\n${suggestions.map((item) => `  ${item}`).join("\n")}`);
      }
    }
    console.error("\nRun 'omv help' to see the main commands.");
    process.exit(1);
  }

  if (wantsHelp(args)) {
    const topic = command === "help" ? args[1] : command;
    const subcommand = command === "help" ? args[2] : args[1];
    commandUsage(topic, subcommand);
    process.exit(0);
  }

  if (command === undefined) {
    if (shouldLaunchBareTui(presenterEnvironment)) {
      const { launchInteractiveWorkspace } = await import("../ui/launcher.js");
      await launchInteractiveWorkspace().catch(handleError);
    } else {
      await runPlainEntry();
    }
    return;
  }

  if (command === "tui" && plainPresenterRequested(presenterEnvironment)) {
    await runPlainEntry();
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

async function runPlainEntry(): Promise<void> {
  if (existsSync(omvStateDir())) {
    await dashboard.run([]).catch(handleError);
  } else {
    printWelcome();
  }
}

/** Strip global `--root <path>` / `--root=<path>` before command validation. */
export function extractProjectRootOption(args: string[]): {
  args: string[];
  root?: string;
  error?: string;
} {
  const next: string[] = [];
  let root: string | undefined;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--root") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        return { args, error: "--root requires a directory path" };
      }
      root = value;
      i += 1;
      continue;
    }
    if (arg.startsWith("--root=")) {
      const value = arg.slice("--root=".length);
      if (!value) {
        return { args, error: "--root requires a directory path" };
      }
      root = value;
      continue;
    }
    next.push(arg);
  }
  return { args: next, root };
}
