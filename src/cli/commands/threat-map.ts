import { writeThreatMap, type ThreatMapWriteResult } from "../findings.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { command as cmd, kv, panel } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "init";
  if (subcommand !== "init") {
    console.error(`Unknown threat-map command: ${subcommand}\n`);
    console.error("Valid commands: init, help");
    process.exit(1);
  }
  const id = firstPositionalAfter(args, "init");
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await writeThreatMap(id, process.cwd(), { force: args.includes("--force") });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printThreatMapInit(result);
}

function printThreatMapInit(result: ThreatMapWriteResult): void {
  console.log(
    panel("threat map", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["finding", result.findingPath],
        ["written", result.written ? "yes" : "no"],
        ["skipped", result.skipped ? "yes" : "no"],
        ["next", cmd(`omv findings show ${result.id}`)],
      ]),
      ...(result.skipped ? ["", "skipped (use --force to overwrite a non-empty threat map)"] : []),
    ]),
  );
}
