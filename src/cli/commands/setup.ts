import { setup, uninstall, type SetupResult, type UninstallResult } from "../setup.js";
import { resolveScope, wantsJson } from "./shared.js";
import { command as cmd, kv, outcomeBadge, panel, statusIcon, table, title } from "../tui.js";

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

function printSetupResult(result: SetupResult): void {
  const total = result.installed.length + result.skipped.length + result.errors.length;
  const summary = result.errors.length > 0
    ? `${result.errors.length} error(s), ${result.installed.length}/${total} skill(s) installed`
    : result.installed.length === 0
      ? `${result.skipped.length}/${total} skill(s) already installed`
      : `${result.installed.length}/${total} skill(s) installed`;
  const next = result.errors.length > 0
    ? `omv setup --scope ${result.scope} --force`
    : "omv doctor";
  const finalState = result.errors.length > 0 ? "error" : result.installed.length === 0 ? "skipped" : "installed";

  console.log(title("oh-my-vul setup"));
  console.log(
    panel("install summary", [
      ...kv([
        ["scope", result.scope],
        ["destination", result.destination],
        ["result", outcomeBadge(finalState)],
        ["skills", summary],
        ["next", cmd(next)],
      ]),
    ]),
  );

  const rows = [
    ...result.installed.map((name) => [statusIcon("installed"), name, outcomeBadge("installed"), "copied into skills directory"]),
    ...result.skipped.map((name) => [statusIcon("skipped"), name, outcomeBadge("skipped"), "already installed; use --force to overwrite"]),
    ...result.errors.map((message) => [statusIcon("error"), "-", outcomeBadge("error"), message]),
  ];
  if (rows.length > 0) {
    console.log(table(["", "skill", "state", "detail"], rows));
  }
}

function printUninstallResult(result: UninstallResult): void {
  const total = result.removed.length + result.notFound.length + result.errors.length;
  const summary = result.errors.length > 0
    ? `${result.errors.length} error(s), ${result.removed.length}/${total} removed`
    : `${result.removed.length}/${Math.max(result.removed.length, result.notFound.length)} skill(s) removed`;
  const next = result.errors.length > 0
    ? "omv doctor"
    : "omv setup";
  const finalState = result.errors.length > 0 ? "error" : result.removed.length === 0 && result.notFound.length === 0 ? "skipped" : "pass";

  console.log(title("oh-my-vul uninstall"));
  console.log(
    panel("uninstall summary", [
      ...kv([
        ["scope", result.scope],
        ["skills dir", result.skillsDir],
        ["result", outcomeBadge(finalState)],
        ["skills", summary],
        ["manifest", result.manifestRemoved ? "removed" : "not found"],
        ...(result.scope === "project" ? [["setup scope", result.setupScopeRemoved ? "removed" : "not found"]] as [string, string][] : []),
        ["next", cmd(next)],
      ]),
    ]),
  );

  const rows = [
    ...result.removed.map((name) => [statusIcon("installed"), name, outcomeBadge("pass"), "removed from skills directory"]),
    ...result.notFound.map((name) => [statusIcon("skipped"), name, outcomeBadge("skipped"), "not found in skills directory"]),
    ...result.errors.map((message) => [statusIcon("error"), "-", outcomeBadge("error"), message]),
  ];
  if (rows.length > 0) {
    console.log(table(["", "skill", "state", "detail"], rows));
  }
}

