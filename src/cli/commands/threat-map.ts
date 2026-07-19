import { validateThreatMap, writeThreatMap, type ThreatMapValidation, type ThreatMapWriteResult } from "../threatmap.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { command as cmd, kv, outcomeBadge, panel, warn, error as tuiError } from "../tui.js";
import { resolveProjectRoot } from "../paths.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "init";
  const json = wantsJson(args);

  switch (subcommand) {
    case "init": {
      const id = firstPositionalAfter(args, "init");
      if (!id) {
        console.error("Missing finding id.");
        process.exit(1);
      }
      const result = await writeThreatMap(id, resolveProjectRoot(), { force: args.includes("--force") });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printThreatMapInit(result);
      return;
    }
    case "validate": {
      const id = firstPositionalAfter(args, "validate");
      if (!id) {
        console.error("Missing finding id.");
        process.exit(1);
      }
      const result = await validateThreatMap(id);
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) {
          process.exit(1);
        }
        return;
      }
      printThreatMapValidation(result);
      if (!result.ok) {
        process.exit(1);
      }
      return;
    }
    default:
      console.error(`Unknown threat-map command: ${subcommand}\n`);
      console.error("Valid commands: init, validate, help");
      process.exit(1);
  }
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

function printThreatMapValidation(result: ThreatMapValidation): void {
  const state = result.ok ? "pass" : "fail";
  console.log(
    panel("threat map validation", [
      ...kv([
        ["id", result.id],
        ["state", outcomeBadge(state)],
        ["path", result.path],
      ]),
      ...(result.errors.length > 0 ? ["", tuiError("errors"), ...result.errors.map((item) => `  ${item}`)] : []),
      ...(result.warnings.length > 0 ? ["", warn("warnings"), ...result.warnings.map((item) => `  ${item}`)] : []),
      ...(result.rendered.length > 0 ? ["", "graph", ...result.rendered.map((item) => `  ${item}`)] : []),
    ]),
  );
}
