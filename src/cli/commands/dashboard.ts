import { listFindingWorkflow } from "../findings.js";
import { printDashboard } from "../render.js";
import { readWorkspaceActivity, workspaceStatus } from "../workspace.js";
import { wantsJson } from "./shared.js";

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
