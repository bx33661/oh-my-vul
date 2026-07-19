import {
  listFindings,
  validateFinding,
  validateFindings,
  promoteFinding,
  archiveFinding,
  createFindingTemplate,
  listArchivedFindings,
  restoreFinding,
  showFinding,
} from "../findings.js";
import {
  printArchivedSummaries,
  printArchiveResult,
  printFindingDetail,
  printFindingSummaries,
  printFindingTemplateResult,
  printFindingValidation,
  printRestoreResult,
} from "../render.js";
import { findingsUsage } from "../usage.js";
import { firstPositionalAfter, parseStatus, parseReason, wantsJson } from "./shared.js";
import { resolveProjectRoot } from "../paths.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "list";
  const json = wantsJson(args);

  switch (subcommand) {
    case "list":
      await runFindingsList(json);
      return;
    case "show":
      await runFindingsShow(args, json);
      return;
    case "init":
      await runFindingsInit(args, json);
      return;
    case "validate":
      await runFindingsValidate(args, json);
      return;
    case "promote":
      await runFindingsPromote(args, json);
      return;
    case "archive":
      await runFindingsArchive(args, json);
      return;
    case "restore":
      await runFindingsRestore(args, json);
      return;
    case "help":
    case "--help":
    case "-h":
      findingsUsage(undefined);
      return;
    default:
      console.error(`Unknown findings command: ${subcommand}\n`);
      findingsUsage(undefined);
      process.exit(1);
  }
}

async function runFindingsShow(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "show");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await showFinding(target, resolveProjectRoot(), { archived: args.includes("--archived") });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printFindingDetail(result);
}

async function runFindingsList(json: boolean): Promise<void> {
  const findings = await listFindings();
  if (json) {
    console.log(JSON.stringify(findings, null, 2));
    return;
  }

  if (findings.length === 0) {
    console.log("No findings yet. Add Evidence.v1 YAML files under .omv/findings/.");
    return;
  }

  printFindingSummaries(findings);
}

async function runFindingsInit(args: string[], json: boolean): Promise<void> {
  const id = firstPositionalAfter(args, "init");
  const status = parseStatus(args) ?? "candidate";
  const force = args.includes("--force");

  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await createFindingTemplate(id, { status, force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  printFindingTemplateResult(result);
}

async function runFindingsValidate(args: string[], json: boolean): Promise<void> {
  const strict = args.includes("--strict");
  const target = firstPositionalAfter(args, "validate");
  const results = target ? [await validateFinding(target)] : await validateFindings();
  const ok = results.every((result) => result.ok && (!strict || result.warnings.length === 0));

  if (json) {
    console.log(JSON.stringify(target ? results[0] : results, null, 2));
    if (!ok) {
      process.exit(1);
    }
    return;
  }

  if (results.length === 0) {
    console.log("No findings to validate.");
    return;
  }

  for (const result of results) {
    printFindingValidation(result);
  }

  if (!ok) {
    process.exit(1);
  }
}

async function runFindingsPromote(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "promote");
  const status = parseStatus(args);

  if (!target) {
    console.error("Missing finding id or path.");
    process.exit(1);
  }
  if (!status) {
    console.error("Missing --status. Valid values: candidate, confirmed, blocked");
    process.exit(1);
  }

  const result = await promoteFinding(target, status);
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printFindingValidation(result);
  }
  if (!result.ok) {
    process.exit(1);
  }
}

async function runFindingsArchive(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "archive");
  if (target === "list") {
    const archived = await listArchivedFindings();
    if (json) {
      console.log(JSON.stringify(archived, null, 2));
      return;
    }
    printArchivedSummaries(archived);
    return;
  }

  const reason = parseReason(args);
  const force = args.includes("--force");
  const strict = args.includes("--strict");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  if (!reason) {
    console.error("Missing --reason.");
    process.exit(1);
  }

  const result = await archiveFinding(target, reason, resolveProjectRoot(), { force, strict });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printArchiveResult(result);
}

async function runFindingsRestore(args: string[], json: boolean): Promise<void> {
  const target = firstPositionalAfter(args, "restore");
  const force = args.includes("--force");
  if (!target) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = await restoreFinding(target, resolveProjectRoot(), { force });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printRestoreResult(result);
}
