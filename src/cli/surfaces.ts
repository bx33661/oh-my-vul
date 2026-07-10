// surfaces.ts — Attack Surface Cards for Campaign first-mile research
// Deterministic proposals from the shared surface catalog, selected before seed.

import { existsSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { showCampaign, type Campaign } from "./campaign.js";
import { campaignSurfacesPath, packageRoot } from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

export const SURFACE_CARD_STATUSES = ["proposed", "selected", "skipped"] as const;
export type SurfaceCardStatus = (typeof SURFACE_CARD_STATUSES)[number];

export interface SurfacePackDefinition {
  id: string;
  title: string;
  vulnerability_classes: string[];
  discovery_hints: string[];
  sources: string[];
  sinks: string[];
  guards: string[];
  false_positive_checks: string[];
}

export interface SurfaceCatalog {
  schema_version: string;
  catalog_version: string;
  packs: SurfacePackDefinition[];
}

export interface AttackSurfaceCard {
  id: string;
  title: string;
  pack: string;
  vulnerability_class: string;
  status: SurfaceCardStatus;
  finding_id: string;
  sources: string[];
  sinks: string[];
  guards: string[];
  discovery_hints: string[];
  false_positive_checks: string[];
  why: string;
}

export interface AttackSurfaceList {
  schema_version: "1";
  campaign_id: string;
  generated_at: string;
  updated_at: string;
  catalog_version: string;
  cards: AttackSurfaceCard[];
}

export interface ProposeSurfacesResult {
  campaignId: string;
  path: string;
  list: AttackSurfaceList;
  created: boolean;
  overwritten: boolean;
  nextAction: string;
}

export interface SelectSurfacesResult {
  campaignId: string;
  path: string;
  list: AttackSurfaceList;
  selected: string[];
  skipped: string[];
  nextAction: string;
}

export interface ShowSurfacesResult {
  campaignId: string;
  path: string;
  list: AttackSurfaceList | null;
  nextAction: string;
}

const ROOT_KEYS = new Set([
  "schema_version",
  "campaign_id",
  "generated_at",
  "updated_at",
  "catalog_version",
  "cards",
]);
const CARD_KEYS = new Set([
  "id",
  "title",
  "pack",
  "vulnerability_class",
  "status",
  "finding_id",
  "sources",
  "sinks",
  "guards",
  "discovery_hints",
  "false_positive_checks",
  "why",
]);
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function loadSurfaceCatalog(root = packageRoot()): Promise<SurfaceCatalog> {
  const path = join(root, "shared", "surface-catalog", "packs.v1.json");
  const raw = await readFile(path, "utf-8");
  const parsed = JSON.parse(raw) as SurfaceCatalog;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.packs)) {
    throw new Error(`invalid surface catalog at ${path}`);
  }
  return parsed;
}

export function proposeCardsForCampaign(
  campaign: Campaign,
  catalog: SurfaceCatalog,
  now = () => new Date(),
): AttackSurfaceList {
  const classes = campaign.priorities.vulnerability_classes;
  const cards: AttackSurfaceCard[] = [];
  const seen = new Set<string>();

  for (const pack of catalog.packs) {
    const matchedClass = pickMatchedClass(pack.vulnerability_classes, classes);
    if (!matchedClass) continue;
    const id = pack.id;
    if (seen.has(id)) continue;
    seen.add(id);
    cards.push({
      id,
      title: pack.title,
      pack: pack.id,
      vulnerability_class: matchedClass,
      status: "proposed",
      finding_id: `${campaign.id}-${id}`,
      sources: [...pack.sources],
      sinks: [...pack.sinks],
      guards: [...pack.guards],
      discovery_hints: [...pack.discovery_hints],
      false_positive_checks: [...pack.false_positive_checks],
      why: `priority class ${matchedClass} intersects pack ${pack.id}`,
    });
  }

  const timestamp = now().toISOString();
  return {
    schema_version: "1",
    campaign_id: campaign.id,
    generated_at: timestamp,
    updated_at: timestamp,
    catalog_version: String(catalog.catalog_version ?? "1"),
    cards,
  };
}

export async function proposeSurfaces(
  id: string,
  projectRoot = process.cwd(),
  options: { force?: boolean; now?: () => Date } = {},
): Promise<ProposeSurfacesResult> {
  const detail = await showCampaign(id, projectRoot);
  const catalog = await loadSurfaceCatalog();
  const path = campaignSurfacesPath(detail.campaign.id, projectRoot);
  const existed = existsSync(path);
  if (existed && !options.force) {
    throw new Error(`${path} already exists (pass --force to regenerate proposed cards)`);
  }

  const list = proposeCardsForCampaign(detail.campaign, catalog, options.now);
  if (list.cards.length === 0) {
    throw new Error(
      `no attack-surface cards match vulnerability classes: ${detail.campaign.priorities.vulnerability_classes.join(", ")}`,
    );
  }

  await writeFile(path, stringifyYaml(list), "utf-8");
  await appendWorkspaceActivity(
    { action: "campaign.surfaces.propose", id: detail.campaign.id, path },
    projectRoot,
  );

  return {
    campaignId: detail.campaign.id,
    path,
    list,
    created: !existed,
    overwritten: existed,
    nextAction: `omv campaign surfaces select ${detail.campaign.id} --cards ${list.cards.map((card) => card.id).join(",")}`,
  };
}

export async function showSurfaces(
  id: string,
  projectRoot = process.cwd(),
): Promise<ShowSurfacesResult> {
  const detail = await showCampaign(id, projectRoot);
  const path = campaignSurfacesPath(detail.campaign.id, projectRoot);
  if (!existsSync(path)) {
    return {
      campaignId: detail.campaign.id,
      path,
      list: null,
      nextAction: `omv campaign surfaces propose ${detail.campaign.id}`,
    };
  }
  const list = await readSurfaceList(path, detail.campaign.id);
  const selected = list.cards.filter((card) => card.status === "selected");
  return {
    campaignId: detail.campaign.id,
    path,
    list,
    nextAction: selected.length > 0
      ? `omv campaign seed ${detail.campaign.id}`
      : `omv campaign surfaces select ${detail.campaign.id} --cards <id,id>`,
  };
}

export async function selectSurfaces(
  id: string,
  cardIds: string[],
  projectRoot = process.cwd(),
  options: { now?: () => Date } = {},
): Promise<SelectSurfacesResult> {
  const detail = await showCampaign(id, projectRoot);
  const path = campaignSurfacesPath(detail.campaign.id, projectRoot);
  if (!existsSync(path)) {
    throw new Error(`${path} does not exist; run omv campaign surfaces propose ${detail.campaign.id} first`);
  }

  const wanted = normalizeCardIds(cardIds);
  if (wanted.length === 0) {
    throw new Error("at least one --cards id is required");
  }

  const list = await readSurfaceList(path, detail.campaign.id);
  const known = new Set(list.cards.map((card) => card.id));
  for (const cardId of wanted) {
    if (!known.has(cardId)) {
      throw new Error(`unknown surface card id: ${cardId}`);
    }
  }

  const selectedSet = new Set(wanted);
  const nextCards = list.cards.map((card) => ({
    ...card,
    status: (selectedSet.has(card.id) ? "selected" : "skipped") as SurfaceCardStatus,
  }));
  const updated: AttackSurfaceList = {
    ...list,
    updated_at: (options.now ?? (() => new Date()))().toISOString(),
    cards: nextCards,
  };
  await writeFile(path, stringifyYaml(updated), "utf-8");
  await appendWorkspaceActivity(
    { action: "campaign.surfaces.select", id: detail.campaign.id, path },
    projectRoot,
  );

  const selected = nextCards.filter((card) => card.status === "selected").map((card) => card.id);
  const skipped = nextCards.filter((card) => card.status === "skipped").map((card) => card.id);
  return {
    campaignId: detail.campaign.id,
    path,
    list: updated,
    selected,
    skipped,
    nextAction: `omv campaign seed ${detail.campaign.id}`,
  };
}

export async function readSurfaceList(
  path: string,
  expectedCampaignId?: string,
): Promise<AttackSurfaceList> {
  const text = await readFile(path, "utf-8");
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    throw new Error(`${path}: AttackSurfaceList YAML parse error: ${error instanceof Error ? error.message : String(error)}`);
  }
  const list = validateSurfaceList(parsed, path);
  if (expectedCampaignId && list.campaign_id !== expectedCampaignId) {
    throw new Error(`${path}: campaign_id must be ${expectedCampaignId}; received ${list.campaign_id}`);
  }
  return list;
}

export function validateSurfaceList(value: unknown, source = "AttackSurfaceList.v1"): AttackSurfaceList {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source}: must be a mapping`);
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!ROOT_KEYS.has(key)) {
      throw new Error(`${source}: undeclared field ${key}`);
    }
  }
  if (record.schema_version !== "1") {
    throw new Error(`${source}: schema_version must be "1"`);
  }
  const campaignId = requireString(record, "campaign_id", source);
  if (!SAFE_ID.test(campaignId)) {
    throw new Error(`${source}: campaign_id must be a safe slug`);
  }
  const generatedAt = requireString(record, "generated_at", source);
  const updatedAt = requireString(record, "updated_at", source);
  requireIso(generatedAt, `${source}: generated_at`);
  requireIso(updatedAt, `${source}: updated_at`);
  const catalogVersion = requireString(record, "catalog_version", source);
  if (!Array.isArray(record.cards) || record.cards.length === 0) {
    throw new Error(`${source}: cards must be a non-empty list`);
  }

  const cards: AttackSurfaceCard[] = [];
  const seen = new Set<string>();
  for (const [index, raw] of record.cards.entries()) {
    const path = `${source}: cards[${index}]`;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error(`${path}: must be a mapping`);
    }
    const card = raw as Record<string, unknown>;
    for (const key of Object.keys(card)) {
      if (!CARD_KEYS.has(key)) {
        throw new Error(`${path}: undeclared field ${key}`);
      }
    }
    const id = requireString(card, "id", path);
    if (!SAFE_ID.test(id)) throw new Error(`${path}: id must be a safe slug`);
    if (seen.has(id)) throw new Error(`${path}: duplicate card id ${id}`);
    seen.add(id);
    const status = requireString(card, "status", path);
    if (!SURFACE_CARD_STATUSES.includes(status as SurfaceCardStatus)) {
      throw new Error(`${path}: status must be one of ${SURFACE_CARD_STATUSES.join(", ")}`);
    }
    const findingId = requireString(card, "finding_id", path);
    if (findingId !== `${campaignId}-${id}`) {
      throw new Error(`${path}: finding_id must be ${campaignId}-${id}`);
    }
    cards.push({
      id,
      title: requireString(card, "title", path),
      pack: requireString(card, "pack", path),
      vulnerability_class: requireString(card, "vulnerability_class", path),
      status: status as SurfaceCardStatus,
      finding_id: findingId,
      sources: requireStringList(card, "sources", path),
      sinks: requireStringList(card, "sinks", path),
      guards: requireStringList(card, "guards", path),
      discovery_hints: requireStringList(card, "discovery_hints", path),
      false_positive_checks: requireStringList(card, "false_positive_checks", path),
      why: requireString(card, "why", path),
    });
  }

  return {
    schema_version: "1",
    campaign_id: campaignId,
    generated_at: generatedAt,
    updated_at: updatedAt,
    catalog_version: catalogVersion,
    cards,
  };
}

export function selectedSeedTargets(list: AttackSurfaceList): AttackSurfaceCard[] {
  return list.cards.filter((card) => card.status === "selected");
}

function pickMatchedClass(packClasses: string[], campaignClasses: string[]): string | undefined {
  const packSet = new Set(packClasses.map((value) => value.toLowerCase()));
  // normalize aliases used in catalog vs campaign class slugs
  const aliasMap: Record<string, string> = {
    traversal: "path-traversal",
    "path-traversal": "path-traversal",
    proto: "prototype-pollution",
    "prototype-pollution": "prototype-pollution",
  };
  for (const campaignClass of campaignClasses) {
    const normalized = aliasMap[campaignClass] ?? campaignClass;
    if (packSet.has(campaignClass) || packSet.has(normalized)) {
      return campaignClass;
    }
    for (const packClass of packClasses) {
      if ((aliasMap[packClass] ?? packClass) === normalized) {
        return campaignClass;
      }
    }
  }
  return undefined;
}

function normalizeCardIds(values: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    for (const part of value.split(",")) {
      const id = part.trim().toLowerCase();
      if (!id || seen.has(id)) continue;
      if (!SAFE_ID.test(id)) {
        throw new Error(`invalid surface card id: ${id}`);
      }
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

function requireString(record: Record<string, unknown>, key: string, source: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${source}: ${key} must be a non-empty string`);
  }
  return value.trim();
}

function requireStringList(record: Record<string, unknown>, key: string, source: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) {
    throw new Error(`${source}: ${key} must be a non-empty string list`);
  }
  return value.map((item) => String(item).trim());
}

function requireIso(value: string, source: string): void {
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${source} must be an ISO 8601 timestamp`);
  }
}
