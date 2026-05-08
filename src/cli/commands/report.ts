import { firstPositionalAfter } from "../cli-options.js";
import { checkReportArtifacts } from "../findings.js";
import { printReportArtifacts } from "../render.js";
import { reportUsage } from "../usage.js";

export async function runReport(args: string[]): Promise<void> {
  const subcommand = args[1];
  const json = args.includes("--json");

  switch (subcommand) {
    case "artifacts":
      await runReportArtifacts(args, json);
      return;
    case "help":
    case "--help":
    case "-h":
      reportUsage(undefined);
      return;
    default:
      console.error(`Unknown report command: ${subcommand ?? ""}\n`);
      reportUsage(undefined);
      process.exit(1);
  }
}

async function runReportArtifacts(args: string[], json: boolean): Promise<void> {
  const id = firstPositionalAfter(args, "artifacts");
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await checkReportArtifacts(id);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      process.exit(1);
    }
    return;
  }
  printReportArtifacts(result);
  if (result.errors.length > 0) {
    process.exit(1);
  }
}
