import { planDedup, updateDedup, type DedupUpdateResult } from "../dedup.js";
import { showFinding } from "../findings.js";
import { firstPositionalAfter, parseOption, wantsJson } from "./shared.js";
import { kv, muted, panel } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const id = firstPositionalAfter(args, "dedup");
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const detail = await showFinding(id);
  const result = args.includes("--confirm")
    ? await updateDedup(detail.path, detail.id, {
      existingCve: parseOption(args, "--existing-cve") ?? "none",
      notes: parseOption(args, "--notes") ?? "dedup searched with omv dedup",
      confirmed: true,
    })
    : { ...(await planDedup(detail.path, detail.id)), updated: false };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printDedupResult(result);
}

function printDedupResult(result: DedupUpdateResult): void {
  console.log(
    panel("dedup", [
      ...kv([
        ["id", result.id],
        ["updated", result.updated ? "yes" : "no"],
        ["path", result.path],
      ]),
      "",
      muted("queries"),
      ...result.queries.map((query) => `  ${query}`),
      ...(result.updated ? [] : ["", muted("writeback  rerun with --confirm --existing-cve <CVE|none> --notes <text>")]),
    ]),
  );
}
