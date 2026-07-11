import { setup, uninstall } from "../setup.js";
import { doctor } from "../doctor.js";
import { printSetupResult, printUninstallResult } from "../render.js";
import { resolvePlatform, resolveScope, wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const json = wantsJson(args);
  const scope = await resolveScope(args, "user");
  const platform = resolvePlatform(args);

  if (dryRun && !json) {
    console.log("Dry run — no files will be written.\n");
  }

  const result = await setup({ force, dryRun, scope, platform });

  if (!dryRun && result.errors.length === 0) {
    const health = await doctor({ scope, platform });
    const passed = health.checks.filter((check) => check.status === "pass").length;
    const warned = health.checks.filter((check) => check.status === "warn").length;
    const failed = health.checks.filter((check) => check.status === "fail").length;
    result.verification = {
      ok: health.ok && !health.warnings,
      warnings: health.warnings,
      passed,
      warned,
      failed,
    };
    result.nextAction = result.verification.ok
      ? platform === "codex"
        ? "Restart Codex, then invoke $omv"
        : "Restart Claude Code, then invoke /omv"
      : `omv doctor --scope ${scope} --platform ${platform}`;
  } else if (dryRun) {
    result.nextAction = `omv setup --scope ${scope} --platform ${platform}`;
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  printSetupResult(result);

  if (result.errors.length > 0) {
    process.exit(1);
  }
}

export async function runUninstall(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const scope = await resolveScope(args, "user");
  const platform = resolvePlatform(args);

  const result = await uninstall({ scope, platform });

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.errors.length > 0) {
      process.exit(1);
    }
    return;
  }

  printUninstallResult(result);

  if (result.errors.length > 0) {
    process.exit(1);
  }
}
