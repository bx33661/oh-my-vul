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
} from "../render.js";
import { campaignUsage } from "../usage.js";
import { firstPositionalAfter, parseOption, wantsJson } from "./shared.js";

type CampaignSubcommand = "init" | "list" | "show" | "seed" | "help";

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
    case "help":
      campaignUsage(undefined, args[0] === "first");
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
  if (candidate === "init" || candidate === "list" || candidate === "show" || candidate === "seed") {
    return candidate;
  }
  return "help";
}
