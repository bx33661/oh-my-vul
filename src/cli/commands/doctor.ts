import { doctor } from "../doctor.js";
import { printDoctorResult } from "../render.js";
import { resolveOptionalScope, resolvePlatform, wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const strict = args.includes("--strict");
  const scope = await resolveOptionalScope(args);
  const platform = args.includes("--platform") ? resolvePlatform(args) : undefined;
  const result = await doctor({ scope, platform });
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
