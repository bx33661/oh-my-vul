import {
  initVerification,
  showVerification,
  validateVerification,
  type VerificationDetail,
  type VerificationInitResult,
  type VerificationValidation,
} from "../verification.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { command as cmd, error as tuiError, kv, outcomeBadge, panel, warn } from "../tui.js";
import { resolveProjectRoot } from "../paths.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "show";
  const json = wantsJson(args);

  switch (subcommand) {
    case "init": {
      const id = firstPositionalAfter(args, "init");
      if (!id) {
        console.error("Missing finding id.");
        process.exit(1);
      }
      const result = await initVerification(id, resolveProjectRoot(), { force: args.includes("--force") });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printVerificationInit(result);
      return;
    }
    case "show": {
      const id = firstPositionalAfter(args, "show");
      if (!id) {
        console.error("Missing finding id.");
        process.exit(1);
      }
      const result = await showVerification(id);
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printVerificationDetail(result);
      return;
    }
    case "validate": {
      const id = firstPositionalAfter(args, "validate");
      if (!id) {
        console.error("Missing finding id.");
        process.exit(1);
      }
      const result = await validateVerification(id);
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) {
          process.exit(1);
        }
        return;
      }
      printVerificationValidation(result);
      if (!result.ok) {
        process.exit(1);
      }
      return;
    }
    default:
      console.error(`Unknown verification command: ${subcommand}\n`);
      console.error("Valid commands: init, show, validate, help");
      process.exit(1);
  }
}

function printVerificationInit(result: VerificationInitResult): void {
  console.log(
    panel("verification", [
      ...kv([
        ["id", result.id],
        ["path", result.path],
        ["finding", result.findingPath],
        ["finding sha256", result.findingSha256],
        ["written", result.written ? "yes" : "no"],
        ["skipped", result.skipped ? "yes" : "no"],
        ["next", cmd(`omv verification show ${result.id}`)],
      ]),
      ...(result.skipped ? ["", "skipped (use --force to overwrite a non-empty verification sidecar)"] : []),
    ]),
  );
}

function printVerificationValidation(result: VerificationValidation): void {
  const state = result.ok && !result.stale ? "pass" : result.ok ? "warn" : "fail";
  console.log(
    panel("verification validation", [
      ...kv([
        ["id", result.id],
        ["state", outcomeBadge(state)],
        ["decision", result.status],
        ["reviews", String(result.reviewCount)],
        ["disagreements", String(result.disagreements)],
        ["required changes", String(result.requiredChanges)],
        ["stale", result.stale ? "yes" : "no"],
        ["path", result.path],
      ]),
      ...(result.errors.length > 0 ? ["", tuiError("errors"), ...result.errors.map((item) => `  ${item}`)] : []),
      ...(result.warnings.length > 0 ? ["", warn("warnings"), ...result.warnings.map((item) => `  ${item}`)] : []),
    ]),
  );
}

function printVerificationDetail(result: VerificationDetail): void {
  printVerificationValidation(result);
  if (result.rendered.length === 0) {
    return;
  }
  console.log(
    panel("verification reviews", [
      ...result.rendered.map((line) => `  ${line}`),
    ]),
  );
}
