import { setup, uninstall } from "../setup.js";
import { printSetupResult, printUninstallResult } from "../render.js";
import { resolveScope, wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const json = wantsJson(args);
  const scope = await resolveScope(args, "user");

  if (dryRun && !json) {
    console.log("Dry run — no files will be written.\n");
  }

  const result = await setup({ force, dryRun, scope });

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

  const result = await uninstall({ scope });

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
