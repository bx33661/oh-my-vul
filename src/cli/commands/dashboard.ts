import {
  listFindingWorkflow,
  type FindingWorkflowSummary,
} from "../findings.js";
import { readWorkspaceActivity, workspaceStatus, type WorkspaceActivityEntry, type WorkspaceStatus } from "../workspace.js";
import { wantsJson } from "./shared.js";
import { command as cmd, empty, kv, panel, readiness, statusBadge, table, title, truncate, warn } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const [status, workflow, activity] = await Promise.all([
    workspaceStatus(),
    listFindingWorkflow(),
    readWorkspaceActivity(),
  ]);
  const result = { status, workflow, activity: activity.slice(-8) };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printDashboard(status, workflow, activity.slice(-8));
}

function printDashboard(
  status: WorkspaceStatus,
  workflow: FindingWorkflowSummary[],
  activity: WorkspaceActivityEntry[],
): void {
  console.log(title("oh-my-vul dashboard"));
  const statuses = Object.entries(status.statusCounts)
    .map(([name, count]) => `${name}=${count}`)
    .join(", ");
  console.log(
    panel("workspace", [
      ...kv([
        ["root", status.root],
        ["active", String(status.activeCount)],
        ["archived", String(status.archivedCount)],
        ["statuses", statuses || "none"],
        ["next", workflow[0] ? cmd(workflow[0].nextAction) : cmd("omv findings init <id>")],
      ]),
      ...status.warnings.map((item) => warn(`warning  ${item}`)),
    ]),
  );

  if (workflow.length === 0) {
    console.log(empty("No active findings. Start with omv findings init <id> or /omv-find."));
  } else {
    console.log(
      table(
      ["id", "status", "evidence", "submission", "next action"],
      workflow.slice(0, 8).map((finding) => [
        truncate(finding.id, 30),
        statusBadge(finding.status),
        readiness(finding.evidenceScore),
        readiness(finding.submissionScore),
        cmd(truncate(finding.nextAction, 54)),
      ]),
      ),
    );
  }

  if (activity.length > 0) {
    console.log(
      table(
        ["time", "action", "id"],
        activity.map((entry) => [
          truncate(entry.timestamp, 27),
          entry.action,
          truncate(entry.id ?? "-", 28),
        ]),
      ),
    );
  }
}
