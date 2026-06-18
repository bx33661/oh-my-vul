import { doctor, type Check, type DoctorResult } from "../doctor.js";
import { resolveOptionalScope, wantsJson } from "./shared.js";
import { command as cmd, kv, outcomeBadge, panel, section, statusIcon, table, title, truncate, warn } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const strict = args.includes("--strict");
  const scope = await resolveOptionalScope(args);
  const result = await doctor({ scope });
  const ok = result.ok && (!strict || !result.warnings);

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (!ok) {
      process.exit(1);
    }
    return;
  }

  printDoctorResult(result, strict);
  if (!ok) {
    process.exit(1);
  }
}

function printDoctorResult(result: DoctorResult, strict: boolean): void {
  const passed = result.checks.filter((item) => item.status === "pass").length;
  const warned = result.checks.filter((item) => item.status === "warn").length;
  const failed = result.checks.filter((item) => item.status === "fail").length;
  const finalState = failed > 0 ? "fail" : strict && warned > 0 ? "fail" : warned > 0 ? "warn" : "pass";
  const next = failed > 0
    ? `omv setup --scope ${result.scope} --force`
    : warned > 0
      ? `omv doctor --scope ${result.scope} --strict`
      : "omv dashboard";

  console.log(title("oh-my-vul doctor"));
  console.log(
    panel("health summary", [
      ...kv([
        ["scope", result.scope],
        ["skills", result.skillsDir],
        ["status", outcomeBadge(finalState)],
        ["checks", `${passed} pass, ${warned} warn, ${failed} fail`],
        ["next", cmd(next)],
      ]),
    ]),
  );

  console.log(section("Checks"));
  console.log(
    table(
      ["", "check", "state", "detail"],
      result.checks.map((check) => [
        statusIcon(check.status),
        truncate(check.name, 30),
        outcomeBadge(check.status),
        truncate(check.message, 76),
      ]),
    ),
  );

  const warnings = result.checks.filter((item) => item.status === "warn");
  if (warnings.length > 0) {
    console.log(panel("warnings", warnings.map(formatCheckDetail)));
  }
  const failures = result.checks.filter((item) => item.status === "fail");
  if (failures.length > 0) {
    console.log(panel("failures", failures.map(formatCheckDetail)));
  } else if (strict && warnings.length > 0) {
    console.log(panel("strict mode", [warn("warnings are treated as failures in --strict mode")]));
  }
}

function formatCheckDetail(check: Check): string {
  return `${statusIcon(check.status)} ${check.name}: ${check.message}`;
}
