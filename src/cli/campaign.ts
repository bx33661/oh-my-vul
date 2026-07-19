import { existsSync } from "fs";
import { link, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, rmdir, unlink, writeFile } from "fs/promises";
import { basename, join } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { campaignPath, campaignRunbookPath, campaignsDir, workspaceActivityLogPath, resolveProjectRoot } from "./paths.js";
import { appendWorkspaceActivity } from "./workspace.js";

export const CAMPAIGN_MODES = ["whitebox", "graybox", "local-lab", "passive", "mixed"] as const;
export const CAMPAIGN_OUTPUTS = [
  "course-report",
  "cve",
  "vuldb",
  "internal-report",
  "research-notes",
] as const;
export const CAMPAIGN_DEPTHS = ["quick", "standard", "deep"] as const;
export const CAMPAIGN_LOCAL_REPRODUCTIONS = ["yes", "no", "unknown"] as const;
export const CAMPAIGN_ECOSYSTEMS = [
  "unknown",
  "npm",
  "python",
  "go",
  "rust",
  "java",
  "ruby",
  "php",
  "csharp",
  "swift",
  "dart",
  "elixir",
  "perl",
  "r",
  "lua",
] as const;

export type CampaignMode = (typeof CAMPAIGN_MODES)[number];
export type CampaignOutput = (typeof CAMPAIGN_OUTPUTS)[number];
export type CampaignDepth = (typeof CAMPAIGN_DEPTHS)[number];
export type CampaignLocalReproduction = (typeof CAMPAIGN_LOCAL_REPRODUCTIONS)[number];
export type CampaignEcosystem = (typeof CAMPAIGN_ECOSYSTEMS)[number];
export type CampaignStatus = "active";
export type CampaignProfile = "generic";

export interface CampaignTarget {
  name: string;
  version: string;
  source: string;
  ecosystem: CampaignEcosystem;
}

export interface CampaignScope {
  mode: CampaignMode;
  local_reproduction: CampaignLocalReproduction;
  boundaries: string[];
}

export interface CampaignLane {
  id: string;
  title: string;
  vulnerability_class: string;
  finding_id: string;
}

export interface Campaign {
  schema_version: "1";
  id: string;
  title: string;
  status: CampaignStatus;
  profile: CampaignProfile;
  created_at: string;
  updated_at: string;
  target: CampaignTarget;
  scope: CampaignScope;
  goal: {
    output: CampaignOutput;
  };
  budget: {
    depth: CampaignDepth;
  };
  priorities: {
    vulnerability_classes: string[];
  };
  lanes: CampaignLane[];
}

export interface CampaignInput {
  id?: string;
  target?: string;
  version?: string;
  source?: string;
  ecosystem?: string;
  mode?: CampaignMode;
  output?: CampaignOutput;
  depth?: CampaignDepth;
  vulnerabilities?: string[];
  localReproduction?: CampaignLocalReproduction;
}

export interface CampaignPromptAdapter {
  askTarget(): Promise<string>;
  askVulnerabilities(): Promise<string>;
  close(): void;
}

export interface InitCampaignOptions {
  projectRoot?: string;
  force?: boolean;
  now?: CampaignClock;
}

export interface InitCampaignResult {
  campaign: Campaign;
  yamlPath: string;
  runbookPath: string;
  overwritten: boolean;
  nextAction: string;
  warnings: string[];
}

export interface CampaignSummary {
  id: string;
  title: string;
  status: CampaignStatus;
  target: string;
  version: string;
  laneCount: number;
  nextAction: string;
}

export interface ShowCampaignResult {
  campaign: Campaign;
  yamlPath: string;
  runbookPath: string;
  runbookExists: boolean;
  nextAction: string;
}

export interface ResolveCampaignInputOptions {
  interactive: boolean;
  prompt?: CampaignPromptAdapter;
}

export type CampaignClock = () => Date;

export const CAMPAIGN_SAFETY_BOUNDARIES = [
  "local or explicitly authorized assets only",
  "no live third-party testing",
  "no automatic exploitation",
] as const;

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SAFE_CLASS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|([+-])(\d{2}):(\d{2}))$/;
const MODE_SET = new Set<string>(CAMPAIGN_MODES);
const OUTPUT_SET = new Set<string>(CAMPAIGN_OUTPUTS);
const DEPTH_SET = new Set<string>(CAMPAIGN_DEPTHS);
const LOCAL_REPRODUCTION_SET = new Set<string>(CAMPAIGN_LOCAL_REPRODUCTIONS);
const ECOSYSTEM_SET = new Set<string>(CAMPAIGN_ECOSYSTEMS);
const CAMPAIGN_KEYS = new Set([
  "schema_version",
  "id",
  "title",
  "status",
  "profile",
  "created_at",
  "updated_at",
  "target",
  "scope",
  "goal",
  "budget",
  "priorities",
  "lanes",
]);
const TARGET_KEYS = new Set(["name", "version", "source", "ecosystem"]);
const SCOPE_KEYS = new Set(["mode", "local_reproduction", "boundaries"]);
const GOAL_KEYS = new Set(["output"]);
const BUDGET_KEYS = new Set(["depth"]);
const PRIORITIES_KEYS = new Set(["vulnerability_classes"]);
const LANE_KEYS = new Set(["id", "title", "vulnerability_class", "finding_id"]);

export function normalizeCampaignId(id: string): string {
  const normalized = typeof id === "string" ? id.trim() : "";
  if (!SAFE_ID.test(normalized)) {
    throw new Error(
      "campaign id must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens",
    );
  }
  return normalized;
}

export function normalizeVulnerabilityClasses(values: readonly string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    throw new Error("at least one vulnerability class is required");
  }

  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const slug = typeof value === "string" ? asciiSlug(value) : "";
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      normalized.push(slug);
    }
  }
  if (normalized.length === 0) {
    throw new Error("at least one usable vulnerability class is required");
  }
  return normalized;
}

export function buildCampaign(input: CampaignInput, now: CampaignClock = () => new Date()): Campaign {
  const targetName = trimText(input.target);
  if (!targetName) {
    throw new Error("target is required and must be non-empty");
  }

  const version = optionalText(input.version);
  const source = optionalText(input.source);
  const ecosystem = optionalText(input.ecosystem);
  const mode = trimText(input.mode) || "passive";
  const output = trimText(input.output) || "research-notes";
  const depth = trimText(input.depth) || "standard";
  const localReproduction = optionalText(input.localReproduction);
  requireAllowed(ecosystem, ECOSYSTEM_SET, "target.ecosystem", CAMPAIGN_ECOSYSTEMS);
  requireAllowed(mode, MODE_SET, "scope.mode", CAMPAIGN_MODES);
  requireAllowed(localReproduction, LOCAL_REPRODUCTION_SET, "scope.local_reproduction", CAMPAIGN_LOCAL_REPRODUCTIONS);
  requireAllowed(output, OUTPUT_SET, "goal.output", CAMPAIGN_OUTPUTS);
  requireAllowed(depth, DEPTH_SET, "budget.depth", CAMPAIGN_DEPTHS);

  const vulnerabilityClasses = normalizeVulnerabilityClasses(input.vulnerabilities);
  let id: string;
  if (input.id !== undefined) {
    id = normalizeCampaignId(input.id);
  } else {
    const targetSlug = asciiSlug(targetName);
    if (!targetSlug) {
      throw new Error("target must produce a safe ASCII campaign id");
    }
    if (version === "unknown") {
      id = targetSlug;
    } else {
      const versionSlug = asciiSlug(version);
      if (!versionSlug) {
        throw new Error("known version must produce a safe ASCII campaign id segment");
      }
      id = `${targetSlug}-${versionSlug}`;
    }
  }

  const current = now();
  if (!(current instanceof Date) || Number.isNaN(current.getTime())) {
    throw new Error("now must return a valid Date");
  }
  const timestamp = current.toISOString();
  const campaign: Campaign = {
    schema_version: "1",
    id,
    title: campaignTitle(targetName, version),
    status: "active",
    profile: "generic",
    created_at: timestamp,
    updated_at: timestamp,
    target: {
      name: targetName,
      version,
      source,
      ecosystem: ecosystem as CampaignEcosystem,
    },
    scope: {
      mode: mode as CampaignMode,
      local_reproduction: localReproduction as CampaignLocalReproduction,
      boundaries: [...CAMPAIGN_SAFETY_BOUNDARIES],
    },
    goal: { output: output as CampaignOutput },
    budget: { depth: depth as CampaignDepth },
    priorities: { vulnerability_classes: vulnerabilityClasses },
    lanes: vulnerabilityClasses.map((vulnerabilityClass) => ({
      id: vulnerabilityClass,
      title: `Review ${vulnerabilityClass} hypotheses`,
      vulnerability_class: vulnerabilityClass,
      finding_id: `${id}-${vulnerabilityClass}`,
    })),
  };
  return validateCampaign(campaign);
}

export function validateCampaign(value: unknown): Campaign {
  return validateCampaignFromSource(value, "Campaign.v1");
}

export function parseCampaignYaml(text: string, source = "Campaign.v1 YAML"): Campaign {
  let parsed: unknown;
  try {
    parsed = parseYaml(text);
  } catch (error) {
    throw new Error(`${source}: Campaign YAML parse error: ${errorMessage(error)}`);
  }

  const campaign = validateCampaignFromSource(parsed, source);
  const fileId = campaignIdFromSource(source);
  if (fileId && campaign.id !== fileId) {
    throw new Error(`${source}: id must match filename id ${fileId}; received ${campaign.id}`);
  }
  return campaign;
}

export function renderCampaignRunbook(campaign: Campaign): string {
  const normalized = validateCampaign(campaign);
  const lines = [
    `# ${escapeMarkdownText(normalized.title)}`,
    "",
    `Campaign ID: ${normalized.id}`,
    "",
    "This campaign records unproven candidate hypotheses. It does not claim discovery or proof.",
    "",
    "## Target",
    "",
    `- Target: ${escapeMarkdownText(normalized.target.name)}`,
    `- Version: ${escapeMarkdownText(normalized.target.version)}`,
    `- Source: ${escapeMarkdownText(normalized.target.source)}`,
    `- Ecosystem: ${normalized.target.ecosystem}`,
    "",
    "## Scope",
    "",
    `- Mode: ${normalized.scope.mode}`,
    `- Local reproduction: ${normalized.scope.local_reproduction}`,
    `- Output: ${normalized.goal.output}`,
    `- Depth: ${normalized.budget.depth}`,
    "",
    "### Safety boundaries",
    "",
    ...normalized.scope.boundaries.map((boundary) => `- ${escapeMarkdownText(boundary)}`),
    "",
    "## Candidate hypothesis lanes",
    "",
  ];

  for (const lane of normalized.lanes) {
    lines.push(
      `### ${lane.title}`,
      "",
      `- Vulnerability class: ${lane.vulnerability_class}`,
      `- Finding ID: ${lane.finding_id}`,
      "- State: unproven candidate hypothesis",
      `- Audit after seeding: \`/omv-audit ${lane.finding_id}\``,
      "",
    );
  }

  lines.push(
    "## Next actions",
    "",
    `1. Review the normalized campaign: \`omv campaign show ${normalized.id}\``,
  );
  if (normalized.target.ecosystem === "unknown") {
    lines.push(
      "2. Set `target.ecosystem` to a supported value in the Campaign YAML.",
      `3. Only after setting the ecosystem, create candidate finding templates: \`omv campaign seed ${normalized.id}\``,
      "4. Audit each candidate separately before making any security claim.",
      "",
    );
  } else {
    lines.push(
      `2. Create candidate finding templates: \`omv campaign seed ${normalized.id}\``,
      "3. Audit each candidate separately before making any security claim.",
      "",
    );
  }
  return `${lines.join("\n")}\n`;
}

export async function initCampaign(
  input: CampaignInput,
  options: InitCampaignOptions = {},
): Promise<InitCampaignResult> {
  const campaign = buildCampaign(input, options.now);
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  const force = options.force ?? false;
  await ensureRealCampaignDirectory(projectRoot);
  const result = await withCampaignLock(
    campaign.id,
    projectRoot,
    () => commitCampaignArtifacts(campaign, projectRoot, force),
  );
  try {
    await appendWorkspaceActivity({ action: "campaign.init", id: campaign.id, path: result.yamlPath }, projectRoot);
    return result;
  } catch (error) {
    return {
      ...result,
      warnings: [
        `Campaign artifacts committed, but activity recording failed at ${workspaceActivityLogPath(projectRoot)}: ${errorMessage(error)}`,
      ],
    };
  }
}

export async function listCampaigns(projectRoot = resolveProjectRoot()): Promise<CampaignSummary[]> {
  const dir = campaignsDir(projectRoot);
  if (!existsSync(dir)) {
    return [];
  }

  // Only Campaign.v1 sources: <id>.yaml / <id>.yml.
  // Sidecars such as <id>.surfaces.yaml share the campaigns directory and must not be listed.
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((dirent) => dirent.isFile() && isCampaignSourceFileName(dirent.name))
    .map((dirent) => dirent.name);
  const summaries: CampaignSummary[] = [];
  const ids = [...new Set(files.map((file) => file.replace(/\.ya?ml$/i, "")))];
  for (const id of ids) {
    const path = resolveCampaignSource(id, projectRoot);
    if (!path) {
      continue;
    }
    const campaign = parseCampaignYaml(await readFile(path, "utf-8"), path);
    summaries.push({
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      target: campaign.target.name,
      version: campaign.target.version,
      laneCount: campaign.lanes.length,
      nextAction: campaignNextAction(campaign),
    });
  }
  return summaries.sort((left, right) => left.id.localeCompare(right.id));
}

/** True for Campaign.v1 filenames; false for sidecars (e.g. *.surfaces.yaml) and other artifacts. */
export function isCampaignSourceFileName(name: string): boolean {
  if (/\.surfaces\.ya?ml$/i.test(name)) {
    return false;
  }
  return /\.ya?ml$/i.test(name);
}

export async function showCampaign(
  id: string,
  projectRoot = resolveProjectRoot(),
): Promise<ShowCampaignResult> {
  const normalizedId = normalizeCampaignId(id);
  const yamlPath = resolveCampaignSource(normalizedId, projectRoot);
  if (!yamlPath) {
    throw new Error(`${campaignPath(normalizedId, projectRoot)} does not exist`);
  }

  const campaign = parseCampaignYaml(await readFile(yamlPath, "utf-8"), yamlPath);
  const runbookPath = campaignRunbookPath(normalizedId, projectRoot);
  return {
    campaign,
    yamlPath,
    runbookPath,
    runbookExists: existsSync(runbookPath),
    nextAction: campaignNextAction(campaign),
  };
}

export async function resolveCampaignInput(
  input: CampaignInput,
  options: ResolveCampaignInputOptions,
): Promise<CampaignInput> {
  let target = trimText(input.target);
  let vulnerabilities = splitVulnerabilityClasses(input.vulnerabilities);
  const needsTarget = !target;
  const needsVulnerabilities = vulnerabilities.length === 0;

  if (options.interactive && (needsTarget || needsVulnerabilities) && !options.prompt) {
    throw new Error(
      `Campaign prompt adapter is required for missing fields: ${missingRequiredFields(target, vulnerabilities).join(", ")}`,
    );
  }
  if (options.interactive && options.prompt) {
    if (needsTarget) {
      target = trimText(await options.prompt.askTarget());
    }
    if (needsVulnerabilities) {
      vulnerabilities = splitVulnerabilityClasses([await options.prompt.askVulnerabilities()]);
    }
  }

  const missing = missingRequiredFields(target, vulnerabilities);
  if (missing.length > 0) {
    throw new Error(`Campaign initialization is missing required fields: ${missing.join(", ")}`);
  }
  return {
    ...input,
    target,
    vulnerabilities,
  };
}

function validateCampaignFromSource(value: unknown, source: string): Campaign {
  const errors: string[] = [];
  if (!isRecord(value)) {
    throw new Error(`${source}: Campaign.v1 must be a mapping`);
  }

  rejectUnknownKeys(value, CAMPAIGN_KEYS, "", errors);
  requireExact(value, "schema_version", "1", errors);
  const id = requireText(value, "id", errors);
  if (id && !SAFE_ID.test(id)) {
    errors.push("id must start with a letter or number and contain only letters, numbers, dots, underscores, or hyphens");
  }
  const title = requireCanonicalText(value, "title", errors);
  requireExact(value, "status", "active", errors);
  requireExact(value, "profile", "generic", errors);
  const createdAt = requireIsoTimestamp(value, "created_at", errors);
  const updatedAt = requireIsoTimestamp(value, "updated_at", errors);
  if (createdAt && updatedAt && Date.parse(updatedAt) < Date.parse(createdAt)) {
    errors.push("updated_at must not be earlier than created_at");
  }

  const target = requireMapping(value, "target", errors);
  let targetName = "";
  let targetVersion = "";
  if (target) {
    rejectUnknownKeys(target, TARGET_KEYS, "target", errors);
    targetName = requireCanonicalText(target, "name", errors, "target.name");
    targetVersion = requireCanonicalText(target, "version", errors, "target.version");
    const targetSource = requireCanonicalText(target, "source", errors, "target.source");
    requireCanonicalUnknown(targetVersion, "target.version", errors);
    requireCanonicalUnknown(targetSource, "target.source", errors);
    requireEnum(target, "ecosystem", ECOSYSTEM_SET, CAMPAIGN_ECOSYSTEMS, errors, "target.ecosystem");
  }
  if (title && targetName && targetVersion) {
    const expectedTitle = campaignTitle(targetName, targetVersion);
    if (title !== expectedTitle) {
      errors.push(`title must equal ${expectedTitle}`);
    }
  }

  const scope = requireMapping(value, "scope", errors);
  if (scope) {
    rejectUnknownKeys(scope, SCOPE_KEYS, "scope", errors);
    requireEnum(scope, "mode", MODE_SET, CAMPAIGN_MODES, errors, "scope.mode");
    requireEnum(
      scope,
      "local_reproduction",
      LOCAL_REPRODUCTION_SET,
      CAMPAIGN_LOCAL_REPRODUCTIONS,
      errors,
      "scope.local_reproduction",
    );
    const boundaries = requireStringList(scope, "boundaries", errors, "scope.boundaries", true);
    boundaries.forEach((boundary, index) => {
      if (boundary && boundary !== boundary.trim()) {
        errors.push(`scope.boundaries[${index}] must not contain surrounding whitespace`);
      }
      requireSingleLineText(boundary, `scope.boundaries[${index}]`, errors);
    });
    for (const boundary of CAMPAIGN_SAFETY_BOUNDARIES) {
      if (!boundaries.includes(boundary)) {
        errors.push(`scope.boundaries must include baseline boundary: ${boundary}`);
      }
    }
  }

  const goal = requireMapping(value, "goal", errors);
  if (goal) {
    rejectUnknownKeys(goal, GOAL_KEYS, "goal", errors);
    requireEnum(goal, "output", OUTPUT_SET, CAMPAIGN_OUTPUTS, errors, "goal.output");
  }
  const budget = requireMapping(value, "budget", errors);
  if (budget) {
    rejectUnknownKeys(budget, BUDGET_KEYS, "budget", errors);
    requireEnum(budget, "depth", DEPTH_SET, CAMPAIGN_DEPTHS, errors, "budget.depth");
  }

  const priorities = requireMapping(value, "priorities", errors);
  if (priorities) {
    rejectUnknownKeys(priorities, PRIORITIES_KEYS, "priorities", errors);
  }
  const vulnerabilityClasses = priorities
    ? requireStringList(
        priorities,
        "vulnerability_classes",
        errors,
        "priorities.vulnerability_classes",
        true,
      )
    : [];
  const seenClasses = new Set<string>();
  vulnerabilityClasses.forEach((vulnerabilityClass, index) => {
    const path = `priorities.vulnerability_classes[${index}]`;
    if (!SAFE_CLASS.test(vulnerabilityClass)) {
      errors.push(`${path} must be a normalized lowercase ASCII slug`);
    }
    if (seenClasses.has(vulnerabilityClass)) {
      errors.push(`${path} must be unique`);
    }
    seenClasses.add(vulnerabilityClass);
  });

  const lanesValue = value.lanes;
  const lanes = Array.isArray(lanesValue) ? lanesValue : [];
  if (!Array.isArray(lanesValue)) {
    errors.push("lanes must be a list");
  } else if (lanes.length !== vulnerabilityClasses.length) {
    errors.push(`lanes must contain exactly one lane per priorities.vulnerability_classes entry`);
  }
  const seenFindingIds = new Set<string>();
  lanes.forEach((lane, index) => {
    const prefix = `lanes[${index}]`;
    if (!isRecord(lane)) {
      errors.push(`${prefix} must be a mapping`);
      return;
    }
    rejectUnknownKeys(lane, LANE_KEYS, prefix, errors);
    const laneId = requireText(lane, "id", errors, `${prefix}.id`);
    const title = requireText(lane, "title", errors, `${prefix}.title`);
    const vulnerabilityClass = requireText(
      lane,
      "vulnerability_class",
      errors,
      `${prefix}.vulnerability_class`,
    );
    const findingId = requireText(lane, "finding_id", errors, `${prefix}.finding_id`);
    const expectedClass = vulnerabilityClasses[index];
    if (expectedClass !== undefined) {
      if (laneId && laneId !== expectedClass) {
        errors.push(`${prefix}.id must equal priorities.vulnerability_classes[${index}] (${expectedClass})`);
      }
      if (title && title !== `Review ${expectedClass} hypotheses`) {
        errors.push(`${prefix}.title must be Review ${expectedClass} hypotheses`);
      }
      if (vulnerabilityClass && vulnerabilityClass !== expectedClass) {
        errors.push(`${prefix}.vulnerability_class must equal ${expectedClass}`);
      }
      if (id && findingId && findingId !== `${id}-${expectedClass}`) {
        errors.push(`${prefix}.finding_id must equal ${id}-${expectedClass}`);
      }
    }
    if (findingId) {
      if (!SAFE_ID.test(findingId)) {
        errors.push(`${prefix}.finding_id must be a safe filename id`);
      }
      if (seenFindingIds.has(findingId)) {
        errors.push(`${prefix}.finding_id must be unique`);
      }
      seenFindingIds.add(findingId);
    }
  });

  if (errors.length > 0) {
    throw new Error(`${source}: Campaign.v1 validation failed:\n- ${errors.join("\n- ")}`);
  }
  return value as unknown as Campaign;
}

function requireMapping(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
): Record<string, unknown> | undefined {
  const nested = value[key];
  if (!isRecord(nested)) {
    errors.push(`${key} must be a mapping`);
    return undefined;
  }
  return nested;
}

function requireText(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key,
): string {
  const nested = value[key];
  if (typeof nested !== "string" || !nested.trim()) {
    errors.push(`${path} is required and must be a non-empty string`);
    return "";
  }
  return nested;
}

function requireCanonicalText(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
  path = key,
): string {
  const text = requireText(value, key, errors, path);
  if (text && text !== text.trim()) {
    errors.push(`${path} must not contain surrounding whitespace`);
  }
  requireSingleLineText(text, path, errors);
  return text;
}

function requireSingleLineText(value: string, path: string, errors: string[]): void {
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    errors.push(`${path} must be single-line text without control characters`);
  }
}

function requireExact(
  value: Record<string, unknown>,
  key: string,
  expected: string,
  errors: string[],
): void {
  if (value[key] !== expected) {
    errors.push(`${key} must be ${expected}`);
  }
}

function requireEnum(
  value: Record<string, unknown>,
  key: string,
  allowed: Set<string>,
  allowedValues: readonly string[],
  errors: string[],
  path: string,
): void {
  const nested = value[key];
  if (typeof nested !== "string" || !allowed.has(nested)) {
    errors.push(`${path} must be one of: ${allowedValues.join(", ")}`);
  }
}

function requireStringList(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
  path: string,
  requireNonEmpty: boolean,
): string[] {
  const nested = value[key];
  if (!Array.isArray(nested)) {
    errors.push(`${path} must be a list`);
    return [];
  }
  if (requireNonEmpty && nested.length === 0) {
    errors.push(`${path} must contain at least one value`);
  }
  return nested.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      errors.push(`${path}[${index}] must be a non-empty string`);
      return "";
    }
    return item;
  });
}

function requireIsoTimestamp(
  value: Record<string, unknown>,
  key: string,
  errors: string[],
): string | undefined {
  const timestamp = value[key];
  if (typeof timestamp !== "string" || !isRealIsoTimestamp(timestamp)) {
    errors.push(`${key} must be an ISO 8601 timestamp`);
    return undefined;
  }
  return timestamp;
}

function isRealIsoTimestamp(timestamp: string): boolean {
  const match = ISO_TIMESTAMP.exec(timestamp);
  if (!match || match[0] !== timestamp) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    month < 1
    || month > 12
    || day < 1
    || day > daysInMonth(year, month)
    || hour > 23
    || minute > 59
    || second > 59
  ) {
    return false;
  }
  if (match[8] !== "Z") {
    const offsetHour = Number(match[10]);
    const offsetMinute = Number(match[11]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) {
      return false;
    }
  }
  return !Number.isNaN(Date.parse(timestamp));
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function requireCanonicalUnknown(value: string, path: string, errors: string[]): void {
  if (value.toLowerCase() === "unknown" && value !== "unknown") {
    errors.push(`${path} must use canonical unknown`);
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  prefix: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${prefix ? `${prefix}.` : ""}${key} is not allowed`);
    }
  }
}

function requireAllowed(
  value: string,
  allowed: Set<string>,
  path: string,
  allowedValues: readonly string[],
): void {
  if (!allowed.has(value)) {
    throw new Error(`${path} must be one of: ${allowedValues.join(", ")}`);
  }
}

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function optionalText(value: unknown): string {
  const normalized = trimText(value);
  return !normalized || normalized.toLowerCase() === "unknown" ? "unknown" : normalized;
}

function asciiSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function campaignIdFromSource(source: string): string | undefined {
  const name = basename(source);
  return /\.ya?ml$/i.test(name) ? name.replace(/\.ya?ml$/i, "") : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function campaignNextAction(campaign: Campaign): string {
  return campaign.target.ecosystem === "unknown"
    ? `Set target.ecosystem to a supported value before running omv campaign seed ${campaign.id}`
    : `omv campaign seed ${campaign.id}`;
}

function resolveCampaignSource(id: string, projectRoot: string): string | undefined {
  const candidates = [
    campaignPath(id, projectRoot),
    join(campaignsDir(projectRoot), `${id}.yml`),
  ];
  const existing = candidates.filter((path) => existsSync(path));
  if (existing.length > 1) {
    throw new Error(`Duplicate Campaign sources for ${id}: ${existing.join(", ")}; remove one source file`);
  }
  return existing[0];
}

async function ensureRealCampaignDirectory(projectRoot: string): Promise<string> {
  const dir = campaignsDir(projectRoot);
  await mkdir(dir, { recursive: true });
  const entry = await lstat(dir);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error(`Campaign directory must be a real directory: ${dir}`);
  }
  return dir;
}

interface TransactionBackup {
  originalPath: string;
  backupPath: string;
}

interface TransactionLink {
  destinationPath: string;
  stagedPath: string;
}

async function commitCampaignArtifacts(
  campaign: Campaign,
  projectRoot: string,
  force: boolean,
): Promise<InitCampaignResult> {
  const dir = campaignsDir(projectRoot);
  const yamlPath = campaignPath(campaign.id, projectRoot);
  const alternativeYamlPath = join(dir, `${campaign.id}.yml`);
  const runbookPath = campaignRunbookPath(campaign.id, projectRoot);
  const transactionDir = await mkdtemp(join(dir, `.${campaign.id}.transaction-`));
  const stagedYamlPath = join(transactionDir, "campaign.yaml");
  const stagedRunbookPath = join(transactionDir, "runbook.md");
  const backups: TransactionBackup[] = [];
  const createdLinks: TransactionLink[] = [];
  let cleanupTransaction = true;

  try {
    await writeFile(stagedYamlPath, stringifyYaml(campaign), { encoding: "utf-8", flag: "wx" });
    await writeFile(stagedRunbookPath, renderCampaignRunbook(campaign), { encoding: "utf-8", flag: "wx" });

    const destinations = [yamlPath, alternativeYamlPath, runbookPath];
    const entries = await Promise.all(destinations.map(async (path) => ({ path, entry: await lstatIfExists(path) })));
    const existing = entries.filter((item) => item.entry !== undefined);
    for (const item of existing) {
      if (!item.entry?.isFile() && !item.entry?.isSymbolicLink()) {
        const kind = item.entry?.isDirectory() ? "directory" : "special entry";
        throw new Error(`Campaign artifact destination is a ${kind} and is not supported: ${item.path}`);
      }
    }
    const existingPaths = existing.map((item) => item.path);
    const overwritten = existingPaths.length > 0;
    if (overwritten && !force) {
      throw new Error(`Campaign artifact already exists: ${existingPaths.join(", ")}; pass --force to replace both artifacts`);
    }

    if (force) {
      for (const [index, item] of existing.entries()) {
        const backupPath = join(transactionDir, `backup-${index}`);
        await rename(item.path, backupPath);
        backups.push({ originalPath: item.path, backupPath });
      }
    }

    await link(stagedYamlPath, yamlPath);
    createdLinks.push({ destinationPath: yamlPath, stagedPath: stagedYamlPath });
    await link(stagedRunbookPath, runbookPath);
    createdLinks.push({ destinationPath: runbookPath, stagedPath: stagedRunbookPath });

    return {
      campaign,
      yamlPath,
      runbookPath,
      overwritten,
      nextAction: campaignNextAction(campaign),
      warnings: [],
    };
  } catch (error) {
    try {
      await rollbackCampaignTransaction(createdLinks, backups);
    } catch (rollbackError) {
      cleanupTransaction = false;
      throw new Error(
        `${errorMessage(error)}; rollback failed: ${errorMessage(rollbackError)}; recovery data remains at ${transactionDir}`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    if (cleanupTransaction) {
      await rm(transactionDir, { recursive: true, force: true });
    }
  }
}

async function rollbackCampaignTransaction(
  createdLinks: readonly TransactionLink[],
  backups: readonly TransactionBackup[],
): Promise<void> {
  for (const created of [...createdLinks].reverse()) {
    const [destination, staged] = await Promise.all([
      lstatIfExists(created.destinationPath),
      lstatIfExists(created.stagedPath),
    ]);
    if (destination && staged && destination.dev === staged.dev && destination.ino === staged.ino) {
      await unlink(created.destinationPath);
    }
  }
  for (const backup of [...backups].reverse()) {
    if (await lstatIfExists(backup.originalPath)) {
      throw new Error(`cannot restore ${backup.originalPath} because the destination is occupied`);
    }
    await rename(backup.backupPath, backup.originalPath);
  }
}

async function withCampaignLock<T>(
  id: string,
  projectRoot: string,
  operation: () => Promise<T>,
): Promise<T> {
  const lockPath = join(campaignsDir(projectRoot), `${id}.lock`);
  try {
    await mkdir(lockPath);
  } catch (error) {
    if (errorCode(error) === "EEXIST") {
      throw new Error(`Campaign ${id} is busy: lock already exists at ${lockPath}`);
    }
    throw error;
  }
  try {
    return await operation();
  } finally {
    await rmdir(lockPath);
  }
}

function errorCode(error: unknown): string | undefined {
  return isRecord(error) && typeof error.code === "string" ? error.code : undefined;
}

async function lstatIfExists(path: string): Promise<Awaited<ReturnType<typeof lstat>> | undefined> {
  try {
    return await lstat(path);
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function campaignTitle(targetName: string, version: string): string {
  return `${targetName}${version === "unknown" ? "" : ` ${version}`} research campaign`;
}

function escapeMarkdownText(value: string): string {
  const specials = new Set(["`", "*", "_", "[", "]", "<", ">", "#", "|"]);
  return Array.from(value, (character) => {
    if (character === "\\") {
      return "\\\\";
    }
    return specials.has(character) ? `\\${character}` : character;
  }).join("");
}

function splitVulnerabilityClasses(values: readonly string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  return values.flatMap((value) =>
    typeof value === "string"
      ? value.split(",").map((part) => part.trim()).filter(Boolean)
      : [],
  );
}

function missingRequiredFields(target: string, vulnerabilities: readonly string[]): string[] {
  const missing: string[] = [];
  if (!target) {
    missing.push("target");
  }
  if (vulnerabilities.length === 0) {
    missing.push("vulnerability classes");
  }
  return missing;
}
