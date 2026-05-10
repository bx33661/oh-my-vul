import { parseScopeOrExit } from "../cli-options.js";
import { printSetupResult } from "../render.js";
import { setup } from "../setup.js";

export async function runSetup(args: string[]): Promise<void> {
  const force = args.includes("--force");
  const dryRun = args.includes("--dry-run");
  const json = args.includes("--json");
  const scope = parseScopeOrExit(args, "user");

  if (dryRun) {
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
