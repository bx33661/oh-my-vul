import { lstat } from "node:fs/promises";
import { join } from "node:path";
import { showCampaign } from "./campaign.js";
import {
  EVIDENCE_ECOSYSTEMS,
  createFindingTemplate,
  type CreateFindingTemplateOptions,
  type EvidenceEcosystem,
  type EvidenceResearcherGoal,
  type FindingTemplateResult,
} from "./findings.js";
import { findingsDir } from "./paths.js";

export interface CampaignSeedSkipped {
  id: string;
  path: string;
  reason: "already exists";
}

export interface CampaignSeedFailure {
  id: string;
  message: string;
}

export interface CampaignSeedResult {
  campaignId: string;
  campaignPath: string;
  created: FindingTemplateResult[];
  skipped: CampaignSeedSkipped[];
  failed: CampaignSeedFailure[];
  nextAction: string;
}

export type CampaignFindingCreator = (
  id: string,
  options: CreateFindingTemplateOptions,
) => Promise<FindingTemplateResult>;

export interface SeedCampaignDependencies {
  createFinding?: CampaignFindingCreator;
}

export async function seedCampaign(
  id: string,
  projectRoot = process.cwd(),
  dependencies: SeedCampaignDependencies = {},
): Promise<CampaignSeedResult> {
  const detail = await showCampaign(id, projectRoot);
  const ecosystem = detail.campaign.target.ecosystem;
  if (ecosystem === "unknown" || !EVIDENCE_ECOSYSTEMS.includes(ecosystem as EvidenceEcosystem)) {
    throw new Error("target.ecosystem must be a supported Evidence ecosystem before seeding");
  }

  const createFinding = dependencies.createFinding ?? createFindingTemplate;
  const created: FindingTemplateResult[] = [];
  const skipped: CampaignSeedSkipped[] = [];
  const failed: CampaignSeedFailure[] = [];

  for (const lane of detail.campaign.lanes) {
    const existing = await existingFindingPath(lane.finding_id, projectRoot);
    if (existing) {
      skipped.push({ id: lane.finding_id, path: existing, reason: "already exists" });
      continue;
    }

    try {
      created.push(await createFinding(lane.finding_id, {
        projectRoot,
        seed: {
          researcherGoal: evidenceGoal(detail.campaign.goal.output),
          product: detail.campaign.target.name,
          ecosystem: ecosystem as EvidenceEcosystem,
          vulnerabilityClass: lane.vulnerability_class,
        },
      }));
    } catch (error) {
      const raced = await existingFindingPath(lane.finding_id, projectRoot);
      if (raced) {
        skipped.push({ id: lane.finding_id, path: raced, reason: "already exists" });
      } else {
        failed.push({
          id: lane.finding_id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    campaignId: detail.campaign.id,
    campaignPath: detail.yamlPath,
    created,
    skipped,
    failed,
    nextAction: failed.length > 0
      ? `omv campaign seed ${detail.campaign.id}`
      : "omv findings workflow",
  };
}

function evidenceGoal(output: string): EvidenceResearcherGoal {
  switch (output) {
    case "cve":
      return "CVE";
    case "vuldb":
      return "VulDB";
    case "course-report":
    case "internal-report":
      return "advisory";
    default:
      return "triage";
  }
}

async function existingFindingPath(id: string, projectRoot: string): Promise<string | undefined> {
  for (const suffix of [".yaml", ".yml"]) {
    const path = join(findingsDir(projectRoot), `${id}${suffix}`);
    try {
      await lstat(path);
      return path;
    } catch (error) {
      if (!(error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT")) {
        throw error;
      }
    }
  }
  return undefined;
}
