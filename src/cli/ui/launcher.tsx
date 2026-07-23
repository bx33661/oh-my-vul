import { render, type RenderOptions } from "ink";
import { InteractiveApp, type InteractiveAppServices } from "./app.js";
import { loadInteractiveFinding, loadInteractiveWorkspace } from "./model.js";
import { resolveProjectRoot } from "../paths.js";
import { startResearch } from "../start.js";

export interface InteractiveLaunchOptions {
  projectRoot?: string;
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
  alternateScreen?: boolean;
}

export interface InteractiveRenderInstance {
  waitUntilExit(): Promise<unknown>;
  cleanup(): void;
}

export function interactiveRenderOptions(options: InteractiveLaunchOptions = {}): RenderOptions {
  return {
    stdin: options.stdin ?? process.stdin,
    stdout: options.stdout ?? process.stdout,
    stderr: options.stderr ?? process.stderr,
    alternateScreen: options.alternateScreen ?? true,
    exitOnCtrlC: true,
    patchConsole: false,
    interactive: true,
    maxFps: 30,
  };
}

export async function launchInteractiveWorkspace(options: InteractiveLaunchOptions = {}): Promise<void> {
  const projectRoot = options.projectRoot ?? resolveProjectRoot();
  const initialModel = await loadInteractiveWorkspace(projectRoot);
  const services: InteractiveAppServices = {
    reload: () => loadInteractiveWorkspace(projectRoot),
    loadFinding: (id) => loadInteractiveFinding(id, projectRoot),
    start: async (vulnerabilityClasses) => {
      await startResearch({ vulnerabilities: vulnerabilityClasses }, {
        projectRoot,
        interactive: false,
      });
      return loadInteractiveWorkspace(projectRoot);
    },
  };
  const instance = render(
    <InteractiveApp initialModel={initialModel} services={services} />,
    interactiveRenderOptions(options),
  );
  await waitForInteractiveExit(instance);
}

export async function waitForInteractiveExit(instance: InteractiveRenderInstance): Promise<void> {
  try {
    await instance.waitUntilExit();
  } finally {
    instance.cleanup();
  }
}
