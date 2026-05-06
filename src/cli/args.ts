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
    case "dashboard":
      return validateOptions(args.slice(1), {
        command: "dashboard",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "workspace":
      return validateWorkspaceArgs(args.slice(1));
    case "findings":
      return validateFindingsArgs(args.slice(1));
    case "radar":
      return validateRadarArgs(args.slice(1));
    case "dedup":
      return validateOptions(args.slice(1), {
        command: "dedup",
        flags: new Set(["--confirm", "--json", ...HELP_FLAGS]),
        options: new Map(),
        freeOptions: new Set(["--existing-cve", "--notes"]),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "disclose":
      return validateDiscloseArgs(args.slice(1));
    case "submissions":
      return validateSubmissionsArgs(args.slice(1));
    default:
      return fail(`Unknown command: ${command}. Valid commands: version, setup, doctor, dashboard, workspace, findings, radar, dedup, disclose, submissions, help`);
  }
}

function validateRadarArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "brief";
  const rest = args[0] ? args.slice(1) : args;
  switch (subcommand) {
    case "refresh":
      return validateOptions(rest, {
        command: "radar refresh",
        flags: new Set(["--dry-run", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "brief":
      return validateOptions(rest, {
        command: "radar brief",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`radar ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown radar command: ${subcommand}. Valid commands: refresh, brief, help`);
  }
}

function validateDiscloseArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "timeline";
  const rest = args[0] ? args.slice(1) : args;
  switch (subcommand) {
    case "timeline":
      return validateOptions(rest, {
        command: "disclose timeline",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        freeOptions: new Set(["--days"]),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`disclose ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown disclose command: ${subcommand}. Valid commands: timeline, help`);
  }
}

function validateSubmissionsArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "track";
  const rest = args[0] ? args.slice(1) : args;
  switch (subcommand) {
    case "record":
      return validateOptions(rest, {
        command: "submissions record",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        freeOptions: new Set(["--platform", "--submission-id", "--url"]),
        minPositionals: 1,
        maxPositionals: 1,
        requiredOptions: new Set(["--platform", "--submission-id", "--url"]),
      });
    case "track":
      return validateOptions(rest, {
        command: "submissions track",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "close":
      return validateOptions(rest, {
        command: "submissions close",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        freeOptions: new Set(["--cve"]),
        minPositionals: 1,
        maxPositionals: 1,
        requiredOptions: new Set(["--cve"]),
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`submissions ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown submissions command: ${subcommand}. Valid commands: record, track, close, help`);
  }
}

function validateWorkspaceArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "status";
  const rest = args[0] ? args.slice(1) : args;

  switch (subcommand) {
    case "init":
    case "status":
      return validateOptions(rest, {
        command: `workspace ${subcommand}`,
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "log":
      return validateOptions(rest, {
        command: "workspace log",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`workspace ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown workspace command: ${subcommand}. Valid commands: init, status, log, help`);
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
    case "workflow":
      return validateOptions(rest, {
        command: "findings workflow",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "show":
      return validateOptions(rest, {
        command: "findings show",
        flags: new Set(["--archived", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "open":
      return validateOptions(rest, {
        command: "findings open",
        flags: new Set(["--archived", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
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
    case "archive":
      return validateFindingsArchiveArgs(rest);
    case "restore":
      return validateOptions(rest, {
        command: "findings restore",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`findings ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown findings command: ${subcommand}. Valid commands: list, workflow, show, open, init, validate, promote, archive, restore, help`);
  }
}

function validateFindingsArchiveArgs(args: string[]): ArgsValidation {
  if (args[0] === "list") {
    return validateOptions(args.slice(1), {
      command: "findings archive list",
      flags: new Set(["--json", ...HELP_FLAGS]),
      options: new Map(),
      minPositionals: 0,
      maxPositionals: 0,
    });
  }
  return validateOptions(args, {
    command: "findings archive",
    flags: new Set(["--force", "--strict", "--json", ...HELP_FLAGS]),
    options: new Map(),
    freeOptions: new Set(["--reason"]),
    minPositionals: 1,
    maxPositionals: 1,
    requiredOptions: new Set(["--reason"]),
  });
}

interface OptionSpec {
  command: string;
  flags: Set<string>;
  options: Map<string, Set<string>>;
  freeOptions?: Set<string>;
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
    if (spec.freeOptions?.has(value)) {
      const optionValue = args[index + 1];
      if (!optionValue || optionValue.startsWith("--")) {
        return fail(`${value} requires a value`);
      }
      seenOptions.add(value);
      index += 1;
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
      const message = allowedValues.size > 0 ? `one of: ${Array.from(allowedValues).join(", ")}` : "a value";
      return fail(`${option} requires ${message}`);
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
