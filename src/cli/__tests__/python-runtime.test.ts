import test from "node:test";
import assert from "node:assert/strict";
import { findPythonRuntime, pythonRuntimeCandidates, type PythonProbe } from "../python-runtime.js";

test("Windows Python discovery prefers the Python launcher with Python 3", () => {
  assert.deepEqual(pythonRuntimeCandidates("win32", undefined), [
    { command: "py", prefixArgs: ["-3"], displayName: "py -3" },
    { command: "python", prefixArgs: [], displayName: "python" },
    { command: "python3", prefixArgs: [], displayName: "python3" },
  ]);
});

test("Python discovery falls back after unavailable candidates", () => {
  const calls: string[] = [];
  const probe: PythonProbe = (command, args) => {
    calls.push([command, ...args].join(" "));
    return { status: command === "python" ? 0 : null, error: command === "python" ? undefined : new Error("missing") };
  };
  const runtime = findPythonRuntime("win32", undefined, probe);

  assert.equal(runtime?.displayName, "python");
  assert.deepEqual(calls, ["py -3 --version", "python --version"]);
});

test("OMV_PYTHON remains an exact executable override", () => {
  const runtime = findPythonRuntime("linux", "C:\\Tools\\Python\\python.exe", () => ({ status: 0 }));
  assert.deepEqual(runtime, {
    command: "C:\\Tools\\Python\\python.exe",
    prefixArgs: [],
    displayName: "C:\\Tools\\Python\\python.exe",
  });
});
