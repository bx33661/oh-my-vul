import {
  initWorkspace,
  readWorkspaceActivity,
  workspaceStatus,
  type WorkspaceActivityEntry,
  type WorkspaceStatus,
} from "../workspace.js";
import { workspaceUsage } from "../usage.js";
import { wantsJson } from "./shared.js";
import { empty, kv, muted, panel, statusIcon, table, title, truncate, warn } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "status";
  const json = wantsJson(args);

  switch (subcommand) {
    case "init":
      await printWorkspaceCommandResult(await initWorkspace(process.cwd(), { gitignore: args.includes("--gitignore") }), json);
      return;
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

function printWorkspaceStatus(result: WorkspaceStatus): void {
  const statuses = Object.entries(result.statusCounts)
    .map(([status, count]) => `${status}=${count}`)
    .join(", ");
  console.log(title("oh-my-vul workspace"));
  console.log(
    panel("workspace", [
      ...kv([
        ["root", result.root],
        ["findings", result.findingsDir],
        ["archive", result.archiveDir],
        ["active", String(result.activeCount)],
        ["archived", String(result.archivedCount)],
        ["statuses", statuses || "none"],
        ["index", result.staleIndex ? "rebuilt from stale cache" : result.indexPath],
      ]),
      ...result.warnings.map((item) => warn(`warning  ${item}`)),
    ]),
  );
}

function printWorkspaceActivity(entries: WorkspaceActivityEntry[]): void {
  if (entries.length === 0) {
    console.log(empty("No workspace activity yet."));
    return;
  }
  console.log(title("activity log"));
  console.log(
    table(
      ["time", "action", "id", "detail"],
      entries.map((entry) => [
        truncate(entry.timestamp, 27),
        entry.action,
        truncate(entry.id ?? "-", 26),
        entry.reason ? `reason=${entry.reason}` : entry.status ? `status=${entry.status}` : entry.path ?? "",
      ]),
    ),
  );
}
