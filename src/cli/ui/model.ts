import { existsSync } from "node:fs";
import { listCampaigns, showCampaign, type CampaignSummary } from "../campaign.js";
import {
  listFindingWorkflow,
  showFinding,
  type FindingDetail,
  type FindingWorkflowSummary,
} from "../findings.js";
import { omvStateDir, resolveProjectRoot } from "../paths.js";
import { detectProjectContext, type ProjectContext } from "../start.js";
import {
  readWorkspaceActivity,
  workspaceStatus,
  type WorkspaceActivityEntry,
  type WorkspaceStatus,
} from "../workspace.js";

export interface InteractiveWorkspaceModel {
  initialized: boolean;
  project: ProjectContext;
  status?: WorkspaceStatus;
  campaigns: CampaignSummary[];
  findings: FindingWorkflowSummary[];
  activity: WorkspaceActivityEntry[];
  loadedAt: string;
}

export const INTERACTIVE_ACTIVITY_LIMIT = 200;

export function retainInteractiveActivity(activity: WorkspaceActivityEntry[]): WorkspaceActivityEntry[] {
  return activity.slice(-INTERACTIVE_ACTIVITY_LIMIT);
}

export async function loadInteractiveWorkspace(
  projectRoot = resolveProjectRoot(),
): Promise<InteractiveWorkspaceModel> {
  const detectedProject = await detectProjectContext(projectRoot);
  if (!existsSync(omvStateDir(projectRoot))) {
    return {
      initialized: false,
      project: detectedProject,
      campaigns: [],
      findings: [],
      activity: [],
      loadedAt: new Date().toISOString(),
    };
  }

  const [status, campaigns, findings, activity] = await Promise.all([
    workspaceStatus(projectRoot),
    listCampaigns(projectRoot),
    listFindingWorkflow(projectRoot),
    readWorkspaceActivity(projectRoot),
  ]);
  const campaignDetail = campaigns[0] ? await showCampaign(campaigns[0].id, projectRoot) : undefined;
  const project = campaignDetail ? {
    ...detectedProject,
    target: campaignDetail.campaign.target.name,
    version: campaignDetail.campaign.target.version,
    source: campaignDetail.campaign.target.source,
    ecosystem: campaignDetail.campaign.target.ecosystem,
    detectedFrom: [...detectedProject.detectedFrom, "Campaign.v1"],
  } : detectedProject;
  return {
    initialized: true,
    project,
    status,
    campaigns,
    findings,
    activity: retainInteractiveActivity(activity),
    loadedAt: new Date().toISOString(),
  };
}

export function loadInteractiveFinding(
  id: string,
  projectRoot = resolveProjectRoot(),
): Promise<FindingDetail> {
  return showFinding(id, projectRoot);
}
