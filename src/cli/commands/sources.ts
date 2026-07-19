import { initSourceRef, showSourceRef, validateSourceRef } from "../source-ref.js";
import { printSourceRefDetail, printSourceRefInitResult } from "../render.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { resolveProjectRoot } from "../paths.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1];
  if (subcommand !== "init" && subcommand !== "show" && subcommand !== "validate") {
    throw new Error(`Unknown sources command: ${subcommand ?? ""}`);
  }
  const id = firstPositionalAfter(args, subcommand);
  if (!id) throw new Error(`sources ${subcommand} requires an id`);
  const json = wantsJson(args);

  if (subcommand === "init") {
    const result = await initSourceRef(id, resolveProjectRoot(), { force: args.includes("--force") });
    if (json) console.log(JSON.stringify(result, null, 2));
    else printSourceRefInitResult(result);
    return;
  }

  const result = subcommand === "show"
    ? await showSourceRef(id)
    : await validateSourceRef(id);
  if (json) console.log(JSON.stringify(result, null, 2));
  else printSourceRefDetail(result);
}
