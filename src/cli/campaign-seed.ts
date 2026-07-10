import { existsSync } from "node:fs";
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
import { campaignSurfacesPath, findingsDir } from "./paths.js";
import { readSurfaceList, selectedSeedTargets, type AttackSurfaceCard } from "./surfaces.js";

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
  seedMode: "lanes" | "surfaces";
  created: FindingTemplateResult[];
  skipped: CampaignSeedSkipped[];
  failed: CampaignSeedFailure[];
  nextAction: string;
}

interface SeedTarget {
  findingId: string;
  vulnerabilityClass: string;
  surface?: AttackSurfaceCard;
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

  const { targets, seedMode } = await resolveSeedTargets(detail.campaign.id, detail.campaign.lanes, projectRoot);

  for (const target of targets) {
    const existing = await existingFindingPath(target.findingId, projectRoot);
    if (existing) {
      skipped.push({ id: target.findingId, path: existing, reason: "already exists" });
      continue;
    }

    try {
      created.push(await createFinding(target.findingId, {
        projectRoot,
        seed: {
          researcherGoal: evidenceGoal(detail.campaign.goal.output),
          product: detail.campaign.target.name,
          ecosystem: ecosystem as EvidenceEcosystem,
          vulnerabilityClass: target.vulnerabilityClass,
        },
      }));
    } catch (error) {
      const raced = await existingFindingPath(target.findingId, projectRoot);
      if (raced) {
        skipped.push({ id: target.findingId, path: raced, reason: "already exists" });
      } else {
        failed.push({
          id: target.findingId,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return {
    campaignId: detail.campaign.id,
    campaignPath: detail.yamlPath,
    seedMode,
    created,
    skipped,
    failed,
    nextAction: failed.length > 0
      ? `omv campaign seed ${detail.campaign.id}`
      : "omv findings workflow",
  };
}

async function resolveSeedTargets(
  campaignId: string,
  lanes: Array<{ finding_id: string; vulnerability_class: string }>,
  projectRoot: string,
): Promise<{ targets: SeedTarget[]; seedMode: "lanes" | "surfaces" }> {
  const surfacesPath = campaignSurfacesPath(campaignId, projectRoot);
  if (!existsSync(surfacesPath)) {
    return {
      seedMode: "lanes",
      targets: lanes.map((lane) => ({
        findingId: lane.finding_id,
        vulnerabilityClass: lane.vulnerability_class,
      })),
    };
  }

  const list = await readSurfaceList(surfacesPath, campaignId);
  const selected = selectedSeedTargets(list);
  if (selected.length === 0) {
    throw new Error(
      `${surfacesPath} has no selected cards; run omv campaign surfaces select ${campaignId} --cards <id,id> first`,
    );
  }
  return {
    seedMode: "surfaces",
    targets: selected.map((card) => ({
      findingId: card.finding_id,
      vulnerabilityClass: card.vulnerability_class,
      surface: card,
    })),
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
