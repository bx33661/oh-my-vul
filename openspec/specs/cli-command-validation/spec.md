# cli-command-validation Specification

## Purpose
TBD - created by archiving change harden-evidence-workflow. Update Purpose after archive.
## Requirements
### Requirement: CLI rejects unknown commands and flags
The `omv` CLI SHALL reject unknown commands, subcommands, and flags with a non-zero exit code and actionable usage output, and SHALL accept `review` as a valid top-level command.

#### Scenario: Unknown top-level command
- **WHEN** the user runs `omv unknown`
- **THEN** the CLI exits non-zero and prints the list of valid top-level commands

#### Scenario: Unknown findings flag
- **WHEN** the user runs `omv findings validate --bogus`
- **THEN** the CLI exits non-zero and prints the valid flags for the `findings validate` command

#### Scenario: Valid review command
- **WHEN** the user runs `omv review demo --strict --json`
- **THEN** the CLI parser accepts the command with finding id `demo`, strict mode enabled, and JSON output enabled

### Requirement: CLI validates option values
The CLI SHALL validate required option values before executing command behavior.

#### Scenario: Missing scope value
- **WHEN** the user runs `omv setup --scope`
- **THEN** the CLI exits non-zero and reports that `--scope` requires `user` or `project`

#### Scenario: Missing status value
- **WHEN** the user runs `omv findings promote demo --status`
- **THEN** the CLI exits non-zero and reports that `--status` requires `candidate`, `confirmed`, or `blocked`

#### Scenario: Invalid status value
- **WHEN** the user runs `omv findings init demo --status done`
- **THEN** the CLI exits non-zero before writing a file and reports the accepted status values

### Requirement: CLI positional arguments are command-specific
The CLI SHALL validate extra and missing positional arguments for each command and subcommand.

#### Scenario: Missing finding id
- **WHEN** the user runs `omv findings init`
- **THEN** the CLI exits non-zero and reports that a finding id is required

#### Scenario: Extra positional argument
- **WHEN** the user runs `omv doctor extra`
- **THEN** the CLI exits non-zero and reports that `doctor` accepts no positional arguments

#### Scenario: Missing review finding id
- **WHEN** the user runs `omv review`
- **THEN** the CLI exits non-zero and reports that a finding id is required

### Requirement: CLI parser has unit coverage
Command parsing behavior SHALL be covered by tests that exercise valid and invalid arguments without requiring filesystem writes for parser-only failures.

#### Scenario: Parser-only error does not write files
- **WHEN** an invalid parser-only command is tested
- **THEN** the test asserts the error and verifies no setup or finding files were created

### Requirement: Representative CLI commands have process-level regression coverage
The CLI test suite SHALL execute representative compiled commands in child processes so routing, rendering, JSON output, and exit codes are validated together.

#### Scenario: Human command output
- **WHEN** tests run a representative human-facing workflow command
- **THEN** they assert the canonical headings or columns and a zero exit code

#### Scenario: JSON command output
- **WHEN** tests run a representative command with `--json`
- **THEN** they parse the complete stdout as JSON and assert stable core fields

#### Scenario: Invalid command exit code
- **WHEN** tests invoke an unknown command through the compiled entrypoint
- **THEN** they assert a non-zero exit code and actionable error text

### Requirement: TypeScript build rejects unused implementation residue
The TypeScript project SHALL enable unused-local and unused-parameter checks, and the release gate MUST compile with zero such diagnostics.

#### Scenario: Release compilation
- **WHEN** `npm run typecheck` and the release build execute
- **THEN** no unused local, import, helper, or parameter diagnostic is emitted

### Requirement: Command adapters use canonical renderers
When a human renderer exists in `src/cli/render.ts`, command adapters SHALL call it rather than maintain a second implementation of the same output.

#### Scenario: Renderer changes have one owner
- **WHEN** setup, doctor, workspace, dashboard, repro, or report output is changed
- **THEN** the corresponding command adapter contains routing only and the canonical renderer owns the human formatting

### Requirement: CLI validates campaign commands and aliases
The CLI SHALL accept `campaign` and `first` as top-level commands and validate both through one grammar. `init` accepts `--target`, `--version`, `--source`, `--ecosystem`, `--mode`, `--goal`, `--budget`, `--vuln`, `--local-lab`, `--id`, `--force`, `--no-interactive`, and `--json`; `list` accepts only `--json`; `show` and `seed` require exactly one id and accept only `--json`. The `first` aliases SHALL share the same subcommand grammar, while `first [flags]` maps to init.

#### Scenario: Canonical campaign grammar
- **WHEN** the user runs `omv campaign init --target acme --vuln xss,authz --mode passive --goal research-notes --budget standard --local-lab unknown --no-interactive --json`
- **THEN** the parser accepts the command and its option values

#### Scenario: First initialization alias
- **WHEN** the user runs `omv first --target acme --vuln xss --no-interactive`
- **THEN** the parser treats the arguments as campaign initialization options

#### Scenario: Alias subcommand grammar
- **WHEN** the user runs `omv first show demo --json` or `omv first seed demo --json`
- **THEN** the parser accepts exactly one campaign id for the selected alias subcommand

#### Scenario: Unknown campaign subcommand
- **WHEN** the user runs `omv campaign run demo`
- **THEN** the parser exits non-zero and lists `init`, `list`, `show`, and `seed` as valid subcommands

#### Scenario: Seed rejects force
- **WHEN** the user runs `omv campaign seed demo --force`
- **THEN** the parser rejects `--force` before any finding can be overwritten

#### Scenario: Alias seed rejects force
- **WHEN** the user runs `omv first seed demo --force`
- **THEN** the parser rejects `--force` before any finding can be overwritten

#### Scenario: Init accepts force
- **WHEN** the user runs `omv campaign init --target acme --vuln xss --force --no-interactive`
- **THEN** the parser accepts force as an initialization-only flag

#### Scenario: All explicit aliases match canonical parsing
- **WHEN** the user invokes `first init`, `first list`, `first show`, or `first seed` with arguments accepted by the matching canonical command
- **THEN** the parser accepts the alias with the same option and positional semantics

#### Scenario: Init and list reject positionals
- **WHEN** the user supplies a positional argument to Campaign init or list
- **THEN** the parser exits non-zero before command behavior

#### Scenario: Show and seed enforce exactly one id
- **WHEN** the user omits the id or supplies an extra id to Campaign show or seed
- **THEN** the parser exits non-zero before command behavior

### Requirement: CLI validates campaign option values
The CLI SHALL accept modes `whitebox|graybox|local-lab|passive|mixed`, goals `course-report|cve|vuldb|internal-report|research-notes`, budgets `quick|standard|deep`, local reproduction values `yes|no|unknown`, and ecosystems `unknown` plus every Evidence-supported ecosystem. It SHALL validate these enums, option value presence, and command-specific positional arity before filesystem writes.

#### Scenario: Invalid campaign enum
- **WHEN** the user supplies an unsupported value to `--mode`, `--goal`, `--budget`, or `--local-lab`
- **THEN** the parser exits non-zero and reports the accepted values

#### Scenario: Missing option value
- **WHEN** the user supplies `--target`, `--version`, `--source`, `--ecosystem`, `--vuln`, or `--id` without a value
- **THEN** the parser exits non-zero and identifies the option that requires a value

#### Scenario: Campaign list positional arity
- **WHEN** the user runs `omv campaign list extra`
- **THEN** the parser exits non-zero because list accepts no campaign id

#### Scenario: Campaign show missing id
- **WHEN** the user runs `omv campaign show`
- **THEN** the parser exits non-zero because show requires exactly one campaign id

### Requirement: CLI validates source provenance commands
The CLI SHALL accept `sources init|show|validate <id>`; init accepts `--force` and `--json`, while show and validate accept only `--json`. Every subcommand requires exactly one safe finding id.

#### Scenario: Valid source initialization
- **WHEN** the user runs `omv sources init demo --force --json`
- **THEN** parser validation succeeds before command behavior

#### Scenario: Source command rejects extra arguments
- **WHEN** the user omits the id, adds an extra id, or passes `--force` to show or validate
- **THEN** parser validation exits non-zero before filesystem writes

### Requirement: CLI validates report provenance commands
The CLI SHALL accept `omv report provenance <id> [--force] [--json]` while preserving `report artifacts` behavior.

#### Scenario: Valid provenance creation
- **WHEN** the user runs `omv report provenance demo --force --json`
- **THEN** parser validation accepts exactly one id and the documented flags

#### Scenario: Unknown report subcommand
- **WHEN** the user runs an unsupported report subcommand
- **THEN** the parser lists `artifacts`, `provenance`, and `help` as valid commands

### Requirement: CLI validates eval command options
The CLI SHALL accept `omv eval` with either no targeted options or the complete `--skill <name> --eval-id <integer> --output <path>` set, plus at most one of `--json` and `--junit`.

#### Scenario: Stable JSON invocation
- **WHEN** the user runs `omv eval --json`
- **THEN** parser validation succeeds with no positionals

#### Scenario: Complete targeted invocation
- **WHEN** the user runs `omv eval --skill omv-find --eval-id 26 --output result.md --junit`
- **THEN** parser validation accepts the complete targeted set

#### Scenario: Partial or conflicting invocation
- **WHEN** any targeted option is missing, eval id is not a non-negative integer, both output formats are selected, or an extra positional is present
- **THEN** parser validation exits non-zero before starting Python

