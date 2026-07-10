import { checkReportArtifacts } from "../findings.js";
import { createReportProvenance } from "../report-provenance.js";
import { printReportArtifacts, printReportProvenanceResult } from "../render.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "artifacts";
  if (subcommand !== "artifacts" && subcommand !== "provenance") {
    console.error(`Unknown report command: ${subcommand}\n`);
    console.error("Valid commands: artifacts, provenance, help");
    process.exit(1);
  }
  const id = firstPositionalAfter(args, subcommand);
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  if (subcommand === "provenance") {
    const result = await createReportProvenance(id, process.cwd(), { force: args.includes("--force") });
    if (json) console.log(JSON.stringify(result, null, 2));
    else printReportProvenanceResult(result);
    return;
  }

  const result = await checkReportArtifacts(id);
  const ok = result.errors.length === 0;
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (!ok) {
      process.exit(1);
    }
    return;
  }
  printReportArtifacts(result);
  if (!ok) {
    process.exit(1);
  }
}
