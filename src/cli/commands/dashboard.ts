import { listFindingWorkflow } from "../findings.js";
import { printDashboard } from "../render.js";
import { readWorkspaceActivity, workspaceStatus } from "../workspace.js";
import { listCampaigns } from "../campaign.js";
import { wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const [status, campaigns, workflow, activity] = await Promise.all([
    workspaceStatus(),
    listCampaigns(),
    listFindingWorkflow(),
    readWorkspaceActivity(),
  ]);
  const result = { status, campaigns, workflow, activity: activity.slice(-8) };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printDashboard(status, campaigns, workflow, activity.slice(-8));
}
