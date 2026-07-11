import { interactiveTuiAllowed } from "../presenter.js";

export async function run(): Promise<void> {
  const allowed = interactiveTuiAllowed({
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    noTuiEnvironment: process.env.OMV_NO_TUI,
    ci: process.env.CI !== undefined && process.env.CI !== "false",
  });
  if (!allowed) {
    throw new Error("Interactive TUI requires a terminal. Run 'omv dashboard' for plain output.");
  }
  const { launchInteractiveWorkspace } = await import("../ui/launcher.js");
  await launchInteractiveWorkspace();
}
