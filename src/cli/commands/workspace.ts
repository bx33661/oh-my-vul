import {
  readWorkspaceActivity,
  workspaceStatus,
  type WorkspaceStatus,
} from "../workspace.js";
import { printWorkspaceActivity, printWorkspaceStatus } from "../render.js";
import { workspaceUsage } from "../usage.js";
import { wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "status";
  const json = wantsJson(args);

  switch (subcommand) {
    case "status":
      await printWorkspaceCommandResult(await workspaceStatus(), json);
      return;
    case "log":
      await runWorkspaceLog(json);
      return;
    case "help":
    case "--help":
    case "-h":
      workspaceUsage(undefined);
      return;
    default:
      console.error(`Unknown workspace command: ${subcommand}\n`);
      workspaceUsage(undefined);
      process.exit(1);
  }
}

async function printWorkspaceCommandResult(result: WorkspaceStatus, json: boolean): Promise<void> {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printWorkspaceStatus(result);
}

async function runWorkspaceLog(json: boolean): Promise<void> {
  const entries = await readWorkspaceActivity();
  if (json) {
    console.log(JSON.stringify(entries, null, 2));
    return;
  }
  printWorkspaceActivity(entries);
}
