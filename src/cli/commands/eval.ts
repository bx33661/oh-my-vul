import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { packageRoot } from "../paths.js";
import { parseOption } from "./shared.js";
import { findPythonRuntime } from "../python-runtime.js";

export async function run(args: string[]): Promise<void> {
  const override = process.env.OMV_PYTHON;
  const runtime = override
    ? { command: override, prefixArgs: [] }
    : findPythonRuntime();
  if (!runtime) {
    throw new Error("Unable to find Python 3. Install Python 3 or set OMV_PYTHON to its executable path.");
  }
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

  const result = spawnSync(runtime.command, [...runtime.prefixArgs, ...runnerArgs], {
    cwd: packageRoot(),
    encoding: "utf-8",
  });
  if (result.error) {
    throw new Error(`Unable to start Python runtime "${runtime.command}": ${result.error.message}`);
  }
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
