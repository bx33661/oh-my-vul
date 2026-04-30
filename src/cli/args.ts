export interface ArgsValidation {
  ok: boolean;
  error?: string;
}

const VALID_STATUSES = new Set(["candidate", "confirmed", "blocked"]);
const VALID_SCOPES = new Set(["user", "project"]);
const HELP_FLAGS = new Set(["--help", "-h"]);

export function validateArgs(args: string[]): ArgsValidation {
  const command = args[0];

  switch (command) {
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return args.length <= 3 ? ok() : fail(`${command} accepts at most 2 topic arguments`);
    case "version":
      return validateOptions(args.slice(1), {
        command: "version",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "setup":
      return validateOptions(args.slice(1), {
        command: "setup",
        flags: new Set(["--force", "--dry-run", "--json", ...HELP_FLAGS]),
        options: new Map([["--scope", VALID_SCOPES]]),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "doctor":
      return validateOptions(args.slice(1), {
        command: "doctor",
        flags: new Set(["--json", "--strict", ...HELP_FLAGS]),
        options: new Map([["--scope", VALID_SCOPES]]),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "findings":
      return validateFindingsArgs(args.slice(1));
    default:
      return fail(`Unknown command: ${command}. Valid commands: setup, doctor, findings, help`);
  }
}

function validateFindingsArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "list";
  const rest = args[0] ? args.slice(1) : args;

  switch (subcommand) {
    case "list":
      return validateOptions(rest, {
        command: "findings list",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "init":
      return validateOptions(rest, {
        command: "findings init",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map([["--status", VALID_STATUSES]]),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "validate":
      return validateOptions(rest, {
        command: "findings validate",
        flags: new Set(["--json", "--strict", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 1,
      });
    case "promote":
      return validateOptions(rest, {
        command: "findings promote",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map([["--status", VALID_STATUSES]]),
        minPositionals: 1,
        maxPositionals: 1,
        requiredOptions: new Set(["--status"]),
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`findings ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown findings command: ${subcommand}. Valid commands: list, init, validate, promote, help`);
  }
}

interface OptionSpec {
  command: string;
  flags: Set<string>;
  options: Map<string, Set<string>>;
  minPositionals: number;
  maxPositionals: number;
  requiredOptions?: Set<string>;
}

function validateOptions(args: string[], spec: OptionSpec): ArgsValidation {
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return ok();
  }

  const positionals: string[] = [];
  const seenOptions = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (!value.startsWith("--")) {
      positionals.push(value);
      continue;
    }
    if (spec.flags.has(value)) {
      continue;
    }
    const allowedValues = spec.options.get(value);
    if (!allowedValues) {
      return fail(`Unknown flag for ${spec.command}: ${value}`);
    }
    const optionValue = args[index + 1];
    if (!optionValue || optionValue.startsWith("--")) {
      return fail(`${value} requires one of: ${Array.from(allowedValues).join(", ")}`);
    }
    if (!allowedValues.has(optionValue)) {
      return fail(`${value} must be one of: ${Array.from(allowedValues).join(", ")}`);
    }
    seenOptions.add(value);
    index += 1;
  }

  for (const option of spec.requiredOptions ?? []) {
    if (!seenOptions.has(option)) {
      const allowedValues = spec.options.get(option) ?? new Set<string>();
      return fail(`${option} requires one of: ${Array.from(allowedValues).join(", ")}`);
    }
  }

  if (positionals.length < spec.minPositionals) {
    return fail(`${spec.command} requires ${spec.minPositionals} positional argument(s)`);
  }
  if (positionals.length > spec.maxPositionals) {
    return fail(`${spec.command} accepts at most ${spec.maxPositionals} positional argument(s)`);
  }

  return ok();
}

function ok(): ArgsValidation {
  return { ok: true };
}

function fail(error: string): ArgsValidation {
  return { ok: false, error };
}
