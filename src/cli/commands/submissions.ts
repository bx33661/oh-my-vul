import {
  closeSubmission,
  recordSubmission,
  trackSubmissions,
  type FindingSubmissions,
} from "../submissions.js";
import { submissionsUsage } from "../usage.js";
import { firstPositionalAfter, requireOption, wantsJson } from "./shared.js";
import { empty, table, title, truncate } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "track";
  const json = wantsJson(args);
  const id = firstPositionalAfter(args, subcommand);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  let result: FindingSubmissions;
  switch (subcommand) {
    case "record":
      result = await recordSubmission(id, {
        platform: requireOption(args, "--platform"),
        submissionId: requireOption(args, "--submission-id"),
        url: requireOption(args, "--url"),
      });
      break;
    case "track":
      result = await trackSubmissions(id);
      break;
    case "close":
      result = await closeSubmission(id, requireOption(args, "--cve"));
      break;
    default:
      console.error(`Unknown submissions command: ${subcommand}\n`);
      submissionsUsage(undefined);
      process.exit(1);
  }
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printSubmissions(result);
}

function printSubmissions(result: FindingSubmissions): void {
  if (result.records.length === 0) {
    console.log(empty(`No submissions recorded for ${result.finding_id}.`));
    return;
  }
  console.log(title(`submissions ${result.finding_id}`));
  console.log(
    table(
      ["platform", "id", "status", "cve", "url"],
      result.records.map((record) => [
        record.platform,
        record.submissionId,
        record.status,
        record.cve ?? "-",
        truncate(record.url, 56),
      ]),
    ),
  );
}
