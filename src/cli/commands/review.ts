import { reviewFinding } from "../review.js";
import { printFindingReview } from "../render.js";
import { firstPositionalAfter, wantsJson } from "./shared.js";
import { resolveProjectRoot } from "../paths.js";

export async function run(args: string[]): Promise<void> {
  const id = firstPositionalAfter(args, "review");
  const json = wantsJson(args);
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }

  const result = await reviewFinding(id, resolveProjectRoot(), { strict: args.includes("--strict") });
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.verdict !== "ready") {
      process.exit(1);
    }
    return;
  }

  printFindingReview(result);
  if (result.verdict !== "ready") {
    process.exit(1);
  }
}
