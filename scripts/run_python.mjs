#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const override = process.env.OMV_PYTHON;
const candidates = override
  ? [{ command: override, prefixArgs: [] }]
  : process.platform === "win32"
    ? [
        { command: "py", prefixArgs: ["-3"] },
        { command: "python", prefixArgs: [] },
        { command: "python3", prefixArgs: [] },
      ]
    : [
        { command: "python3", prefixArgs: [] },
        { command: "python", prefixArgs: [] },
      ];

const runtime = candidates.find(({ command, prefixArgs }) => {
  const result = spawnSync(command, [...prefixArgs, "--version"], { windowsHide: true });
  return !result.error && result.status === 0;
});

if (!runtime) {
  console.error("Unable to find Python 3. Install Python 3 or set OMV_PYTHON to its executable path.");
  process.exit(1);
}

const result = spawnSync(runtime.command, [...runtime.prefixArgs, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});
if (result.error) {
  console.error(`Unable to start Python runtime "${runtime.command}": ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
