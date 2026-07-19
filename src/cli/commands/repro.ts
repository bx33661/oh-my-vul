import { initReproArtifacts } from "../findings.js";
import { printReproInitResult } from "../render.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { resolveProjectRoot } from "../paths.js";

export async function run(args: string[]): Promise<void> {
  const id = firstPositionalAfter(args, "init");
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await initReproArtifacts(id, resolveProjectRoot(), { force: args.includes("--force") });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printReproInitResult(result);
}
