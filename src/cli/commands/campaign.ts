import {
  initCampaign,
  listCampaigns,
  resolveCampaignInput,
  showCampaign,
  type CampaignDepth,
  type CampaignEcosystem,
  type CampaignInput,
  type CampaignLocalReproduction,
  type CampaignMode,
  type CampaignOutput,
} from "../campaign.js";
import { ReadlineCampaignPrompt } from "../campaign-prompt.js";
import { seedCampaign } from "../campaign-seed.js";
import {
  printCampaignDetail,
  printCampaignInitResult,
  printCampaignSeedResult,
  printCampaignSummaries,
  printSurfacesProposeResult,
  printSurfacesSelectResult,
  printSurfacesShowResult,
} from "../render.js";
import { proposeSurfaces, selectSurfaces, showSurfaces } from "../surfaces.js";
import { campaignUsage } from "../usage.js";
import { firstPositionalAfter, parseOption, wantsJson } from "./shared.js";

type CampaignSubcommand = "init" | "list" | "show" | "seed" | "surfaces" | "help";
type SurfacesSubcommand = "propose" | "show" | "select" | "help";

export async function run(args: string[]): Promise<void> {
  const subcommand = campaignSubcommand(args);
  const json = wantsJson(args);

  switch (subcommand) {
    case "init":
      await runInit(args, json);
      return;
    case "list": {
      const result = await listCampaigns();
      if (json) console.log(JSON.stringify(result, null, 2));
      else printCampaignSummaries(result);
      return;
    }
    case "show": {
      const id = firstPositionalAfter(args, "show");
      if (!id) throw new Error("Campaign show requires an id");
      const result = await showCampaign(id);
      if (json) console.log(JSON.stringify(result, null, 2));
      else printCampaignDetail(result);
      return;
    }
    case "seed": {
      const id = firstPositionalAfter(args, "seed");
      if (!id) throw new Error("Campaign seed requires an id");
      const result = await seedCampaign(id);
      if (json) console.log(JSON.stringify(result, null, 2));
      else printCampaignSeedResult(result);
      if (result.failed.length > 0) process.exit(1);
      return;
    }
    case "surfaces":
      await runSurfaces(args, json);
      return;
    case "help":
      campaignUsage(undefined, args[0] === "first");
      return;
  }
}

async function runSurfaces(args: string[], json: boolean): Promise<void> {
  const action = surfacesSubcommand(args);
  switch (action) {
    case "propose": {
      const id = firstPositionalAfter(args, "propose");
      if (!id) throw new Error("Campaign surfaces propose requires an id");
      const result = await proposeSurfaces(id, process.cwd(), { force: args.includes("--force") });
      if (json) console.log(JSON.stringify(result, null, 2));
      else printSurfacesProposeResult(result);
      return;
    }
    case "show": {
      const id = firstPositionalAfter(args, "show");
      if (!id) throw new Error("Campaign surfaces show requires an id");
      const result = await showSurfaces(id);
      if (json) console.log(JSON.stringify(result, null, 2));
      else printSurfacesShowResult(result);
      return;
    }
    case "select": {
      const id = firstPositionalAfter(args, "select");
      if (!id) throw new Error("Campaign surfaces select requires an id");
      const cards = parseOption(args, "--cards");
      if (!cards) throw new Error("Campaign surfaces select requires --cards <id,id>");
      const result = await selectSurfaces(id, [cards]);
      if (json) console.log(JSON.stringify(result, null, 2));
      else printSurfacesSelectResult(result);
      return;
    }
    case "help":
      campaignUsage("surfaces", false);
      return;
  }
}

async function runInit(args: string[], json: boolean): Promise<void> {
  const input: CampaignInput = {
    id: parseOption(args, "--id"),
    target: parseOption(args, "--target"),
    version: parseOption(args, "--version"),
    source: parseOption(args, "--source"),
    ecosystem: parseOption(args, "--ecosystem") as CampaignEcosystem | undefined,
    mode: parseOption(args, "--mode") as CampaignMode | undefined,
    output: parseOption(args, "--goal") as CampaignOutput | undefined,
    depth: parseOption(args, "--budget") as CampaignDepth | undefined,
    localReproduction: parseOption(args, "--local-lab") as CampaignLocalReproduction | undefined,
    vulnerabilities: parseOption(args, "--vuln") ? [parseOption(args, "--vuln") as string] : undefined,
  };
  const interactive = !json
    && !args.includes("--no-interactive")
    && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const prompt = interactive ? new ReadlineCampaignPrompt() : undefined;
  try {
    const resolved = await resolveCampaignInput(input, { interactive, prompt });
    const result = await initCampaign(resolved, { force: args.includes("--force") });
    if (json) console.log(JSON.stringify(result, null, 2));
    else printCampaignInitResult(result);
  } finally {
    prompt?.close();
  }
}

function campaignSubcommand(args: string[]): CampaignSubcommand {
  const firstAlias = args[0] === "first";
  const candidate = args[1];
  if (firstAlias && (candidate === undefined || candidate.startsWith("-"))) return "init";
  if (!firstAlias && (candidate === undefined || candidate.startsWith("-"))) return "list";
  if (
    candidate === "init"
    || candidate === "list"
    || candidate === "show"
    || candidate === "seed"
    || candidate === "surfaces"
    || candidate === "help"
  ) {
    return candidate;
  }
  return "help";
}

function surfacesSubcommand(args: string[]): SurfacesSubcommand {
  const candidate = args[2];
  if (candidate === "propose" || candidate === "show" || candidate === "select") return candidate;
  return "help";
}
