import { initReproArtifacts, type ReproInitResult } from "../findings.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { command as cmd, kv, muted, panel } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const id = firstPositionalAfter(args, "init");
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await initReproArtifacts(id, process.cwd(), { force: args.includes("--force") });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printReproInit(result);
}

function printReproInit(result: ReproInitResult): void {
  console.log(
    panel("repro scaffold", [
      ...kv([
        ["id", result.id],
        ["dir", result.path],
        ["finding", result.findingPath],
        ["written", String(result.written.length)],
        ["skipped", String(result.skipped.length)],
        ["finding updated", result.updatedFinding ? "yes" : "no"],
        ["next", cmd(`omv findings validate ${result.id}`)],
      ]),
      ...(result.skipped.length > 0 ? ["", muted("skipped (already non-empty)"), ...result.skipped.map((p) => `  ${p}`)] : []),
    ]),
  );
}
