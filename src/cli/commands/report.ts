import { checkReportArtifacts, type ReportArtifactsResult } from "../findings.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { command as cmd, kv, muted, outcomeBadge, panel, section, statusIcon, table, title } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "artifacts";
  if (subcommand !== "artifacts") {
    console.error(`Unknown report command: ${subcommand}\n`);
    console.error("Valid commands: artifacts, help");
    process.exit(1);
  }
  const id = firstPositionalAfter(args, "artifacts");
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
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

function printReportArtifacts(result: ReportArtifactsResult): void {
  console.log(title(`report artifacts ${result.id}`));
  console.log(
    panel("report artifacts", [
      ...kv([
        ["status", outcomeBadge(result.errors.length > 0 ? "fail" : result.warnings.length > 0 ? "warn" : "pass")],
        ["reports dir", result.reportsDir],
        ["repro dir", result.reproDir],
        ["declared", String(result.reportArtifactPaths.length)],
        ["empty", String(result.emptyReportArtifactPaths.length)],
        ["missing", String(result.missingReproArtifacts.length)],
        ["next", cmd(`omv findings doctor ${result.id}`)],
      ]),
    ]),
  );

  console.log(section("Artifacts"));
  const rows = result.reportArtifactPaths.map((path) => {
    const empty = result.emptyReportArtifactPaths.includes(path);
    return [empty ? statusIcon("warn") : statusIcon("pass"), empty ? "empty" : "present", path];
  });
  if (rows.length === 0) {
    console.log(muted("No report artifacts declared."));
  } else {
    console.log(table(["", "state", "path"], rows));
  }

  const printList = (heading: string, items: string[]) => {
    if (items.length > 0) {
      console.log(section(heading));
      for (const item of items) {
        console.log(`  ${item}`);
      }
    }
  };
  printList("Missing", result.missingReproArtifacts);
  printList("Errors", result.errors);
  printList("Warnings", result.warnings);
}
