import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../omv.js", import.meta.url));
const targetedOutput = fileURLToPath(
  new URL("../../../skills/omv-find/evals/golden/invalid-flags.md", import.meta.url),
);

test("compiled eval command runs the stable manifest as one JSON document", () => {
  const result = runEval(["--json"]);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout) as {
    schema_version: string;
    ok: boolean;
    total: number;
    passed: number;
    failed: number;
    results: unknown[];
  };
  assert.equal(output.schema_version, "1");
  assert.equal(output.ok, true);
  assert.equal(output.total, 18);
  assert.equal(output.passed, 18);
  assert.equal(output.failed, 0);
  assert.equal(output.results.length, 18);
});

test("compiled eval command emits parseable JUnit suite counts", () => {
  const result = runEval(["--junit"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^<\?xml version=['"]1\.0['"]/);
  assert.match(result.stdout, /<testsuite\b[^>]*tests="18"/);
  assert.match(result.stdout, /failures="0"/);
  assert.equal((result.stdout.match(/<testcase\b/g) ?? []).length, 18);
});

test("compiled eval command forwards a targeted checker invocation", () => {
  const result = runEval([
    "--skill", "omv-find", "--eval-id", "26", "--output", targetedOutput, "--json",
  ]);

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout) as {
    total: number;
    passed: number;
    results: Array<{ id: string; eval_id: number }>;
  };
  assert.equal(output.total, 1);
  assert.equal(output.passed, 1);
  assert.equal(output.results[0].id, "omv-find-26");
  assert.equal(output.results[0].eval_id, 26);
});

test("compiled eval command reports a missing Python runtime", () => {
  const result = runEval(["--json"], { OMV_PYTHON: "definitely-not-a-python-runtime" });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /unable to start.*python|python runtime/i);
  assert.equal(result.stdout, "");
});

function runEval(args: string[], extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [cliPath, "eval", ...args], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: { ...process.env, ...extraEnv, NO_COLOR: "1" },
  });
}
