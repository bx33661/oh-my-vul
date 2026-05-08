import { firstPositionalAfter } from "../cli-options.js";
import { initReproArtifacts } from "../findings.js";
import { printReproInitResult } from "../render.js";
import { reproUsage } from "../usage.js";

export async function runRepro(args: string[]): Promise<void> {
  const subcommand = args[1];
  const json = args.includes("--json");

  switch (subcommand) {
    case "init":
      await runReproInit(args, json);
      return;
    case "help":
    case "--help":
    case "-h":
      reproUsage(undefined);
      return;
    default:
      console.error(`Unknown repro command: ${subcommand ?? ""}\n`);
      reproUsage(undefined);
      process.exit(1);
  }
}

async function runReproInit(args: string[], json: boolean): Promise<void> {
  const id = firstPositionalAfter(args, "init");
  const force = args.includes("--force");
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await initReproArtifacts(id, process.cwd(), { force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printReproInitResult(result);
}
