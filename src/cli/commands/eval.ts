import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { packageRoot } from "../paths.js";
import { parseOption } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const python = process.env.OMV_PYTHON || "python3";
  const runner = join(packageRoot(), "shared", "scripts", "run_evals.py");
  const format = args.includes("--junit") ? "junit" : args.includes("--json") ? "json" : "human";
  const runnerArgs = [runner, "--format", format];
  const skill = parseOption(args, "--skill");
  if (skill) {
    runnerArgs.push(
      "--skill", skill,
      "--eval-id", parseOption(args, "--eval-id") as string,
      "--output", parseOption(args, "--output") as string,
    );
  }

  const result = spawnSync(python, runnerArgs, {
    cwd: process.cwd(),
    encoding: "utf-8",
  });
  if (result.error) {
    throw new Error(`Unable to start Python runtime "${python}": ${result.error.message}`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
