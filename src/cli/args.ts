import {
  CAMPAIGN_DEPTHS,
  CAMPAIGN_ECOSYSTEMS,
  CAMPAIGN_LOCAL_REPRODUCTIONS,
  CAMPAIGN_MODES,
  CAMPAIGN_OUTPUTS,
} from "./campaign.js";

export interface ArgsValidation {
  ok: boolean;
  error?: string;
}

const VALID_STATUSES = new Set(["candidate", "confirmed", "blocked"]);
const VALID_SCOPES = new Set(["user", "project"]);
const VALID_SETUP_PLATFORMS = new Set(["claude-code", "codex"]);
const HELP_FLAGS = new Set(["--help", "-h"]);

export function validateArgs(args: string[]): ArgsValidation {
  const command = args[0];
  const removed = removedCommandError(args);
  if (removed) return fail(removed);

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
    case "start":
      return validateCampaignArgs(["init", ...args.slice(1)]);
    case "setup":
      return validateOptions(args.slice(1), {
        command: "setup",
        flags: new Set(["--force", "--dry-run", "--json", ...HELP_FLAGS]),
        options: new Map([["--scope", VALID_SCOPES], ["--platform", VALID_SETUP_PLATFORMS]]),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "uninstall":
      return validateOptions(args.slice(1), {
        command: "uninstall",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map([["--scope", VALID_SCOPES], ["--platform", VALID_SETUP_PLATFORMS]]),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "config":
      return validateConfigArgs(args.slice(1));
    case "doctor":
      return validateOptions(args.slice(1), {
        command: "doctor",
        flags: new Set(["--json", "--strict", ...HELP_FLAGS]),
        options: new Map([["--scope", VALID_SCOPES], ["--platform", VALID_SETUP_PLATFORMS]]),
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
    case "tui":
      return validateOptions(args.slice(1), {
        command: "tui",
        flags: new Set([...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "eval":
      return validateEvalArgs(args.slice(1));
    case "review":
      return validateOptions(args.slice(1), {
        command: "review",
        flags: new Set(["--strict", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "campaign":
      return validateCampaignArgs(args.slice(1));
    case "repro":
      return validateReproArgs(args.slice(1));
    case "report":
      return validateReportArgs(args.slice(1));
    case "sources":
      return validateSourcesArgs(args.slice(1));
    case "threat-map":
      return validateThreatMapArgs(args.slice(1));
    case "verification":
      return validateVerificationArgs(args.slice(1));
    case "workspace":
      return validateWorkspaceArgs(args.slice(1));
    case "findings":
      return validateFindingsArgs(args.slice(1));
    case "radar":
      return validateRadarArgs(args.slice(1));
    case "request":
      return validateRequestArgs(args.slice(1));
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
      return fail(`Unknown command: ${command}`);
  }
}

function removedCommandError(args: string[]): string | undefined {
  if (args[0] === "first") {
    return "omv first was removed; use omv start for guided setup or omv campaign init for automation";
  }
  if (args[0] === "workspace" && args[1] === "init") {
    return "omv workspace init was removed; use omv start to create a complete workspace and campaign";
  }
  if (args[0] !== "findings") return undefined;
  const replacements: Record<string, string> = {
    workflow: "omv findings workflow was removed; use omv dashboard",
    doctor: "omv findings doctor was removed; use omv review <id> [--strict]",
    open: "omv findings open was removed; use omv findings show <id>",
    delete: "omv findings delete was removed; use omv findings archive <id> --reason <reason>",
  };
  return args[1] ? replacements[args[1]] : undefined;
}

function validateEvalArgs(args: string[]): ArgsValidation {
  const validated = validateOptions(args, {
    command: "eval",
    flags: new Set(["--json", "--junit", ...HELP_FLAGS]),
    options: new Map(),
    freeOptions: new Set(["--skill", "--eval-id", "--output"]),
    minPositionals: 0,
    maxPositionals: 0,
  });
  if (!validated.ok) return validated;
  if (args.includes("--json") && args.includes("--junit")) {
    return fail("eval accepts only one output format: --json or --junit");
  }
  const targeted = ["--skill", "--eval-id", "--output"].map((option) => args.includes(option));
  if (targeted.some(Boolean) && !targeted.every(Boolean)) {
    return fail("eval targeted mode requires --skill, --eval-id, and --output together");
  }
  if (targeted.every(Boolean)) {
    const skill = optionValue(args, "--skill");
    const evalId = optionValue(args, "--eval-id");
    if (!skill || !/^[a-z0-9][a-z0-9-]*$/.test(skill)) {
      return fail("--skill must be a lowercase package name");
    }
    if (!evalId || !/^\d+$/.test(evalId)) {
      return fail("--eval-id must be a non-negative integer");
    }
  }
  return ok();
}

function optionValue(args: string[], option: string): string | undefined {
  const index = args.indexOf(option);
  return index === -1 ? undefined : args[index + 1];
}

function validateCampaignArgs(args: string[]): ArgsValidation {
  const leading = args[0];
  let subcommand: string;
  let rest: string[];
  if (leading === undefined || leading.startsWith("-")) {
    subcommand = "list";
    rest = args;
  } else {
    subcommand = leading;
    rest = args.slice(1);
  }

  switch (subcommand) {
    case "init":
      return validateOptions(rest, {
        command: "campaign init",
        flags: new Set(["--force", "--no-interactive", "--json", ...HELP_FLAGS]),
        options: new Map<string, Set<string>>([
          ["--ecosystem", new Set<string>(CAMPAIGN_ECOSYSTEMS)],
          ["--mode", new Set<string>(CAMPAIGN_MODES)],
          ["--goal", new Set<string>(CAMPAIGN_OUTPUTS)],
          ["--budget", new Set<string>(CAMPAIGN_DEPTHS)],
          ["--local-lab", new Set<string>(CAMPAIGN_LOCAL_REPRODUCTIONS)],
        ]),
        freeOptions: new Set(["--target", "--version", "--source", "--vuln", "--id"]),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "list":
      return validateOptions(rest, {
        command: "campaign list",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "show":
    case "seed":
      return validateOptions(rest, {
        command: `campaign ${subcommand}`,
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "surfaces": {
      const action = rest[0];
      const actionRest = rest.slice(1);
      if (action === undefined || action === "help" || HELP_FLAGS.has(action)) {
        return actionRest.length === 0 ? ok() : fail("campaign surfaces help accepts no extra arguments");
      }
      if (action === "propose") {
        return validateOptions(actionRest, {
          command: "campaign surfaces propose",
          flags: new Set(["--force", "--json", ...HELP_FLAGS]),
          options: new Map(),
          minPositionals: 1,
          maxPositionals: 1,
        });
      }
      if (action === "show") {
        return validateOptions(actionRest, {
          command: "campaign surfaces show",
          flags: new Set(["--json", ...HELP_FLAGS]),
          options: new Map(),
          minPositionals: 1,
          maxPositionals: 1,
        });
      }
      if (action === "select") {
        const validated = validateOptions(actionRest, {
          command: "campaign surfaces select",
          flags: new Set(["--json", ...HELP_FLAGS]),
          options: new Map(),
          freeOptions: new Set(["--cards"]),
          minPositionals: 1,
          maxPositionals: 1,
        });
        if (!validated.ok) return validated;
        if (!actionRest.includes("--cards")) {
          return fail("campaign surfaces select requires --cards <id,id>");
        }
        return ok();
      }
      return fail("Unknown campaign surfaces command. Valid commands: propose, show, select, help");
    }
    case "help":
    case "--help":
    case "-h":
      return rest.length <= 1 ? ok() : fail("campaign help accepts at most one topic");
    default:
      return fail(`Unknown campaign command: ${subcommand}. Valid commands: init, list, show, seed, surfaces, help`);
  }
}

function validateRequestArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "preflight";
  const rest = args[0] ? args.slice(1) : args;
  switch (subcommand) {
    case "preflight":
      return validateOptions(rest, {
        command: "request preflight",
        flags: new Set(["--json", "--refresh", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "fetch":
      return validateOptions(rest, {
        command: "request fetch",
        flags: new Set(["--json", "--refresh", ...HELP_FLAGS]),
        options: new Map(),
        freeOptions: new Set(["--accept"]),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`request ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown request command: ${subcommand}. Valid commands: preflight, fetch, help`);
  }
}

function validateReproArgs(args: string[]): ArgsValidation {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "init":
      return validateOptions(rest, {
        command: "repro init",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`repro ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown repro command: ${subcommand ?? ""}. Valid commands: init, help`);
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

function validateReportArgs(args: string[]): ArgsValidation {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "artifacts":
      return validateOptions(rest, {
        command: "report artifacts",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "provenance":
      return validateOptions(rest, {
        command: "report provenance",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`report ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown report command: ${subcommand ?? ""}. Valid commands: artifacts, provenance, help`);
  }
}

function validateSourcesArgs(args: string[]): ArgsValidation {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "init":
      return validateOptions(rest, {
        command: "sources init",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "show":
    case "validate":
      return validateOptions(rest, {
        command: `sources ${subcommand}`,
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`sources ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown sources command: ${subcommand ?? ""}. Valid commands: init, show, validate, help`);
  }
}

function validateThreatMapArgs(args: string[]): ArgsValidation {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "init":
      return validateOptions(rest, {
        command: "threat-map init",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "validate":
      return validateOptions(rest, {
        command: "threat-map validate",
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`threat-map ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown threat-map command: ${subcommand ?? ""}. Valid commands: init, validate, help`);
  }
}

function validateVerificationArgs(args: string[]): ArgsValidation {
  const subcommand = args[0];
  const rest = args.slice(1);
  switch (subcommand) {
    case "init":
      return validateOptions(rest, {
        command: "verification init",
        flags: new Set(["--force", "--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "show":
    case "validate":
      return validateOptions(rest, {
        command: `verification ${subcommand}`,
        flags: new Set(["--json", ...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`verification ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown verification command: ${subcommand ?? ""}. Valid commands: init, show, validate, help`);
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
      return fail(`Unknown workspace command: ${subcommand}. Valid commands: status, log, help`);
  }
}

function validateConfigArgs(args: string[]): ArgsValidation {
  const subcommand = args[0] ?? "list";
  const rest = args[0] ? args.slice(1) : args;
  switch (subcommand) {
    case "get":
      return validateOptions(rest, {
        command: "config get",
        flags: new Set([...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "set":
      return validateOptions(rest, {
        command: "config set",
        flags: new Set([...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 2,
        maxPositionals: 2,
      });
    case "unset":
      return validateOptions(rest, {
        command: "config unset",
        flags: new Set([...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 1,
        maxPositionals: 1,
      });
    case "list":
      return validateOptions(rest, {
        command: "config list",
        flags: new Set([...HELP_FLAGS]),
        options: new Map(),
        minPositionals: 0,
        maxPositionals: 0,
      });
    case "help":
    case "--help":
    case "-h":
      return rest.length === 0 ? ok() : fail(`config ${subcommand} accepts no arguments`);
    default:
      return fail(`Unknown config command: ${subcommand}. Valid commands: get, set, unset, list, help`);
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
    case "show":
      return validateOptions(rest, {
        command: "findings show",
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
      return fail(`Unknown findings command: ${subcommand}. Valid commands: list, show, init, validate, promote, archive, restore, help`);
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
