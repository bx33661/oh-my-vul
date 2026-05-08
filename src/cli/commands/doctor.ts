import { parseOptionalScopeOrExit } from "../cli-options.js";
import { doctor } from "../doctor.js";
import { printDoctorResult } from "../render.js";

export async function runDoctor(args: string[]): Promise<void> {
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const scope = parseOptionalScopeOrExit(args);
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
