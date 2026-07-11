export interface PresenterEnvironment {
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  noTuiFlag?: boolean;
  noTuiEnvironment?: string;
  ci?: boolean;
}

export function interactiveTuiAllowed(environment: PresenterEnvironment): boolean {
  return environment.stdinIsTTY
    && environment.stdoutIsTTY
    && !plainPresenterRequested(environment);
}

export function shouldLaunchBareTui(environment: PresenterEnvironment): boolean {
  return interactiveTuiAllowed(environment);
}

export function plainPresenterRequested(environment: Pick<PresenterEnvironment, "noTuiFlag" | "noTuiEnvironment" | "ci">): boolean {
  return Boolean(environment.noTuiFlag)
    || isTruthy(environment.noTuiEnvironment)
    || Boolean(environment.ci);
}

function isTruthy(value: string | undefined): boolean {
  return value !== undefined && ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
