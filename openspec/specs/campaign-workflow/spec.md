# campaign-workflow Specification

## Purpose
TBD - created by archiving change add-campaign-workflow. Update Purpose after archive.
## Requirements
### Requirement: Campaigns have a validated local contract
The system SHALL represent a research campaign as a closed-schema `Campaign.v1` YAML object under `.omv/campaigns/<id>.yaml` with a paired Markdown runbook at `.omv/campaigns/<id>.md`, and SHALL reject malformed, calendar-invalid, non-normalized, semantically inconsistent, or undeclared fields before returning or using the object.

#### Scenario: Valid Campaign object
- **WHEN** a campaign contains schema version 1, a safe id, target name, supported enum values, at least one normalized vulnerability class, and matching lanes
- **THEN** campaign validation succeeds and returns the typed normalized object

#### Scenario: Invalid Campaign object
- **WHEN** a campaign YAML file is malformed or omits a required value
- **THEN** campaign validation fails with the artifact path and actionable field errors

#### Scenario: Noncanonical or undeclared Campaign data
- **WHEN** a campaign contains uppercase unknown markers, whitespace-padded normalized text, an invented title, missing baseline safety boundaries, an impossible calendar timestamp, or an undeclared root, nested, or lane field
- **THEN** campaign validation fails before list, show, or seed returns the object

### Requirement: Campaign initialization is deterministic and conservative
The system SHALL require a non-empty target and at least one vulnerability class; normalize text, ids, and vulnerability-class slugs; deduplicate classes while preserving first-seen order; and create one generic lane and deterministic finding id per class. Omitted optional values SHALL default to `mode: passive`, `goal.output: research-notes`, `budget.depth: standard`, `status: active`, `profile: generic`, and `unknown` for target version, source, ecosystem, and local reproduction.

#### Scenario: Initialize with required flags
- **WHEN** the user initializes a campaign with a target and a comma-separated vulnerability-class list
- **THEN** the CLI writes one YAML source of truth and one Markdown runbook with deterministic lanes and finding ids

#### Scenario: Normalize duplicate classes
- **WHEN** vulnerability classes differ only by whitespace, case, or slug punctuation
- **THEN** initialization preserves first-seen order and creates exactly one lane for each normalized class

#### Scenario: Safe public defaults
- **WHEN** the user initializes target `Acme` with vulnerability classes `XSS, xss` and omits every optional value
- **THEN** the Campaign contains one `xss` lane and every documented safe default

#### Scenario: Unknown version is omitted from derived id
- **WHEN** target `Acme` has an omitted or explicit `unknown` version and no explicit id
- **THEN** the derived campaign id is `acme` rather than `acme-unknown`

#### Scenario: Unsafe explicit id
- **WHEN** an explicit campaign id contains unsafe filename characters
- **THEN** initialization fails before either Campaign artifact is written

#### Scenario: Existing campaign is protected
- **WHEN** either campaign artifact already exists and initialization does not include `--force`
- **THEN** the CLI fails without overwriting either artifact

#### Scenario: Concurrent initialization is serialized
- **WHEN** two no-force initializers race to create the same Campaign id
- **THEN** exactly one commits the YAML/runbook pair and the other fails without overwriting it

#### Scenario: Dangling or external symlink is not followed
- **WHEN** a Campaign destination is a symlink, including a dangling symlink or a symlink to an external file
- **THEN** no-force initialization treats it as a collision and force replacement replaces only the directory entry without modifying the symlink target

#### Scenario: Explicit overwrite
- **WHEN** the user repeats initialization with `--force`
- **THEN** the CLI replaces both campaign artifacts from the newly normalized Campaign object

#### Scenario: Pair replacement rolls back on failure
- **WHEN** staging or committing either Campaign artifact fails
- **THEN** initialization leaves no partial new pair and restores any force-replaced artifact entries

#### Scenario: Activity failure is non-fatal
- **WHEN** the YAML/runbook pair commits but workspace activity cannot be appended
- **THEN** initialization succeeds with a warning that names the activity error

### Requirement: Campaign initialization supports safe interactive and non-interactive modes
The system SHALL obtain missing required initialization values through an injectable prompt adapter only in an interactive terminal, and SHALL never prompt when `--no-interactive` or `--json` is present.

#### Scenario: Interactive required values
- **WHEN** an interactive user initializes without a target or vulnerability classes
- **THEN** the prompt adapter supplies the missing required values before normalization and persistence

#### Scenario: JSON is non-interactive
- **WHEN** initialization includes `--json` but omits a required value
- **THEN** the CLI returns an error without invoking the prompt adapter or writing an artifact

#### Scenario: Successful JSON initialization
- **WHEN** initialization supplies a target and vulnerability classes with `--json` but without `--no-interactive`
- **THEN** the CLI never invokes the prompt adapter, writes the YAML/runbook pair, and emits exactly one JSON document

#### Scenario: Non-TTY input is non-interactive
- **WHEN** required values are missing and the command streams are not interactive terminals
- **THEN** the CLI fails with the missing fields instead of waiting for input

### Requirement: Campaigns can be listed and shown without a workspace index
The system SHALL scan `.omv/campaigns/*.yaml` directly for list and show operations, sort campaign summaries by id, and SHALL NOT add Campaign records to `WorkspaceIndex`.

#### Scenario: List campaigns
- **WHEN** multiple valid campaign YAML files exist
- **THEN** `omv campaign list` returns sorted summaries containing ids, targets, statuses, lane counts, and next actions

#### Scenario: Duplicate Campaign source pair
- **WHEN** both `<id>.yaml` and `<id>.yml` exist for the same Campaign id
- **THEN** list and show fail with an actionable duplicate-source error instead of returning inconsistent identities

#### Scenario: List missing campaign directory
- **WHEN** `.omv/campaigns/` does not exist
- **THEN** campaign listing returns an empty result without requiring an index rebuild

#### Scenario: Show campaign as JSON
- **WHEN** the user runs `omv campaign show <id> --json`
- **THEN** stdout is one JSON document containing the parsed Campaign object and its artifact paths

#### Scenario: Unknown ecosystem has an actionable prerequisite
- **WHEN** init, list, show, or runbook rendering handles a Campaign whose target ecosystem is `unknown`
- **THEN** its next action tells the user to set a supported ecosystem before running seed

### Requirement: Campaign command aliases preserve canonical behavior
The system SHALL make `omv first [flags]` an alias of `omv campaign init`, and SHALL map `omv first init|list|show|seed` to the corresponding canonical campaign subcommands while `omv campaign` defaults to `list`.

#### Scenario: First without subcommand
- **WHEN** the user runs `omv first --target acme --vuln xss --no-interactive`
- **THEN** the same Campaign artifacts and result are produced as by the canonical `campaign init` command

#### Scenario: Canonical command without subcommand
- **WHEN** the user runs `omv campaign`
- **THEN** the CLI performs the campaign list operation

### Requirement: Campaign seeding creates hypotheses only
The system SHALL validate the complete Campaign before writes, require a known Evidence-compatible ecosystem, create at most one valid candidate `Evidence.v1` file per lane, never overwrite an existing `.yaml` or `.yml` finding, and MUST NOT create ThreatMap, reproduction, verification, audit, proof-of-concept, or report artifacts. Seed SHALL have no force mode.

#### Scenario: Seed campaign lanes
- **WHEN** a valid campaign with a known Evidence-compatible ecosystem has unseeded lanes
- **THEN** `omv campaign seed <id>` creates candidate findings containing only target identity, ecosystem, vulnerability class, and explicit unknown evidence fields

#### Scenario: Existing YAML or YML finding is skipped
- **WHEN** a lane's `.yaml` or `.yml` finding path already exists
- **THEN** seeding preserves the existing file byte-for-byte and reports the lane as skipped

#### Scenario: Unknown ecosystem blocks seeding
- **WHEN** a campaign target ecosystem is `unknown`
- **THEN** seeding fails before creating any finding and asks for an explicit supported ecosystem

#### Scenario: Seed output has no Campaign coupling or proof artifacts
- **WHEN** seeding completes
- **THEN** created Evidence files contain the deterministically mapped `researcher_goal` and no `campaign_id`, tested version remains unknown, proof fields remain unknown, and no other lane artifact path exists

#### Scenario: Partial seed failure is structured and retryable
- **WHEN** one lane encounters an I/O error after other lanes were created or skipped
- **THEN** the result reports created, skipped, and failed ids with messages, and rerunning remains idempotent

### Requirement: Campaign profiles remain data-driven
Every generated `Campaign.v1` SHALL use `profile: generic` and derive lanes solely from normalized user input. The CLI MUST NOT branch on target names.

#### Scenario: Named target receives no built-in content
- **WHEN** a user initializes a Zimbra campaign with only the `xss` vulnerability class
- **THEN** the Campaign contains only the generic `xss` lane and no built-in Zimbra attack-surface claims

