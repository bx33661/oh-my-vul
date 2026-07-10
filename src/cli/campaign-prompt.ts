import { createInterface } from "node:readline/promises";
import type { CampaignPromptAdapter } from "./campaign.js";

export class ReadlineCampaignPrompt implements CampaignPromptAdapter {
  private readonly readline;

  constructor(
    input: NodeJS.ReadableStream = process.stdin,
    output: NodeJS.WritableStream = process.stdout,
  ) {
    this.readline = createInterface({ input, output });
  }

  askTarget(): Promise<string> {
    return this.readline.question("Target: ");
  }

  askVulnerabilities(): Promise<string> {
    return this.readline.question("Vulnerability classes (comma-separated): ");
  }

  close(): void {
    this.readline.close();
  }
}
