import { spawnSync } from "node:child_process";

export interface PythonRuntime {
  command: string;
  prefixArgs: string[];
  displayName: string;
}

export interface PythonProbeResult {
  status: number | null;
  error?: Error;
}

export type PythonProbe = (command: string, args: string[]) => PythonProbeResult;

export function pythonRuntimeCandidates(
  platform: NodeJS.Platform = process.platform,
  override = process.env.OMV_PYTHON,
): PythonRuntime[] {
  if (override) {
    return [{ command: override, prefixArgs: [], displayName: override }];
  }
  if (platform === "win32") {
    return [
      { command: "py", prefixArgs: ["-3"], displayName: "py -3" },
      { command: "python", prefixArgs: [], displayName: "python" },
      { command: "python3", prefixArgs: [], displayName: "python3" },
    ];
  }
  return [
    { command: "python3", prefixArgs: [], displayName: "python3" },
    { command: "python", prefixArgs: [], displayName: "python" },
  ];
}

export function findPythonRuntime(
  platform: NodeJS.Platform = process.platform,
  override = process.env.OMV_PYTHON,
  probe: PythonProbe = probePython,
): PythonRuntime | null {
  for (const runtime of pythonRuntimeCandidates(platform, override)) {
    const result = probe(runtime.command, [...runtime.prefixArgs, "--version"]);
    if (!result.error && result.status === 0) return runtime;
  }
  return null;
}

function probePython(command: string, args: string[]): PythonProbeResult {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    windowsHide: true,
  });
  return { status: result.status, error: result.error };
}
