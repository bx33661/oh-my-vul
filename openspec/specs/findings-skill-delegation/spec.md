# findings-skill-delegation Specification

## Purpose
Define how agents delegate local findings management commands to the `omv` CLI instead of manually writing research-state files.
## Requirements
### Requirement: Agent delegates omv findings init to CLI
When the user invokes `omv findings init <id>` (or `/omv findings init <id>`), the agent SHALL run `omv findings init <id>` as a shell command and display its output. The agent SHALL NOT manually create directories or write YAML files.

#### Scenario: Init creates a finding file via CLI
- **WHEN** the user types `omv findings init demo`
- **THEN** the agent runs `Bash("omv findings init demo")` and prints the CLI output (path, status, next steps)

#### Scenario: Init with explicit status flag
- **WHEN** the user types `omv findings init demo --status confirmed`
- **THEN** the agent runs `Bash("omv findings init demo --status confirmed")`

#### Scenario: Init with duplicate id
- **WHEN** `omv findings init demo` is run and `.omv/findings/demo.yaml` already exists
- **THEN** the agent surfaces the CLI error and suggests `--force` flag

### Requirement: Agent delegates omv findings list to CLI
When the user invokes `omv findings list` (or `/omv findings`), the agent SHALL run `omv findings list` as a shell command and display its tabular output.

#### Scenario: List with existing findings
- **WHEN** the user invokes `/omv findings` or `omv findings list`
- **THEN** the agent runs `Bash("omv findings list")` and prints the ID/STATUS/READY/PACKAGE/VULNERABILITY table

#### Scenario: List with no findings
- **WHEN** no `.omv/findings/*.yaml` files exist
- **THEN** the agent runs `Bash("omv findings list")` and surfaces the CLI's "No findings yet" message

### Requirement: Agent delegates omv findings validate to CLI
When the user invokes `omv findings validate [id]`, the agent SHALL run `omv findings validate [id]` as a shell command. On non-zero exit, the agent SHALL surface the errors and suggest which fields to fill.

#### Scenario: Validate a single finding
- **WHEN** the user types `omv findings validate demo`
- **THEN** the agent runs `Bash("omv findings validate demo")` and displays OK/FAIL output

#### Scenario: Validate all findings
- **WHEN** the user types `omv findings validate` with no id
- **THEN** the agent runs `Bash("omv findings validate")` for the whole ledger

### Requirement: Agent delegates omv findings promote to CLI
When the user invokes `omv findings promote <id> --status <s>`, the agent SHALL run `omv findings promote <id> --status <s>` as a shell command.

#### Scenario: Promote to confirmed
- **WHEN** the user types `omv findings promote demo --status confirmed`
- **THEN** the agent runs `Bash("omv findings promote demo --status confirmed")` and displays the validation result

#### Scenario: Promote without --status flag
- **WHEN** the user invokes `omv findings promote demo` without a `--status` argument
- **THEN** the agent surfaces the CLI error requiring `--status` and lists valid values

### Requirement: Agent handles missing omv binary gracefully
If the `omv` binary is not found on PATH, the agent SHALL tell the user to run `npx oh-my-vul setup` to install it.

#### Scenario: omv binary not installed
- **WHEN** any `omv findings *` command is run and the shell returns "command not found"
- **THEN** the agent outputs: "omv is not installed. Run: npx oh-my-vul setup"

### Requirement: Agent delegates workspace workflow commands to CLI
When the user invokes `/omv status`, `/omv next`, or equivalent workflow commands, the agent SHALL run the corresponding CLI command and display its output.

#### Scenario: Workspace status delegation
- **WHEN** the user invokes `/omv status`
- **THEN** the agent runs `omv workspace status`

#### Scenario: Next action delegation
- **WHEN** the user invokes `/omv next`
- **THEN** the agent runs `omv findings workflow`

### Requirement: Agent delegates archive commands to CLI
When the user invokes archive or restore operations through `/omv`, the agent SHALL run the matching `omv findings` command instead of moving files itself.

#### Scenario: Archive delegation
- **WHEN** the user invokes `/omv archive demo --reason reported`
- **THEN** the agent runs `omv findings archive demo --reason reported`

#### Scenario: Restore delegation
- **WHEN** the user invokes `/omv restore demo`
- **THEN** the agent runs `omv findings restore demo`

