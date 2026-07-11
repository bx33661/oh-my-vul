import {
  type CampaignDepth,
  type CampaignEcosystem,
  type CampaignInput,
  type CampaignLocalReproduction,
  type CampaignMode,
  type CampaignOutput,
} from "../campaign.js";
import { ReadlineCampaignPrompt } from "../campaign-prompt.js";
import { printStartResearchResult } from "../render.js";
import { startResearch } from "../start.js";
import { parseOption, wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const interactive = !json
    && !args.includes("--no-interactive")
    && Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const prompt = interactive ? new ReadlineCampaignPrompt() : undefined;
  try {
    const result = await startResearch(campaignInput(args), {
      interactive,
      prompt,
      force: args.includes("--force"),
    });
    if (json) console.log(JSON.stringify(result, null, 2));
    else printStartResearchResult(result);
  } finally {
    prompt?.close();
  }
}
function campaignInput(args: string[]): CampaignInput {
  return {
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
}
