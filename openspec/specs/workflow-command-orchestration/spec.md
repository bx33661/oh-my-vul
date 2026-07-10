# workflow-command-orchestration Specification

## Purpose
TBD - created by archiving change local-first-findings-manager. Update Purpose after archive.
## Requirements
### Requirement: omv skill presents the full local-first workflow
The `/omv` skill SHALL present campaign initialization and optional candidate seeding followed by discover, audit, reproduce, review, report, and archive as the primary local-first interaction model, while retaining `omv review <id>` as the default pre-report readiness check.

#### Scenario: User asks how to begin
- **WHEN** the user asks how to begin a target-focused research effort without naming an alias
- **THEN** the agent runs canonical `omv campaign init` and reports the generated local artifacts

#### Scenario: User explicitly invokes first alias
- **WHEN** the user invokes `/omv first`
- **THEN** the agent delegates to the `omv first` alias and reports the generated local artifacts

#### Scenario: User asks for campaigns
- **WHEN** the user invokes `/omv campaign` or asks for existing research campaigns
- **THEN** the agent runs `omv campaign list` and summarizes the campaign-level next actions

#### Scenario: User asks for project status
- **WHEN** the user invokes `/omv status`
- **THEN** the agent runs `omv workspace status` and summarizes active next actions

#### Scenario: User asks what to do next
- **WHEN** the user invokes `/omv next`
- **THEN** the agent runs `omv findings workflow` and recommends the highest-priority next command from the CLI output

#### Scenario: User asks whether a finding can be reported
- **WHEN** the user asks `/omv` whether finding `demo` is ready to submit
- **THEN** the agent runs `omv review demo` and uses the verdict to recommend the next stage

### Requirement: Stage skills hand off through CLI-verified state
The find, audit, repro, critic, and report skills SHALL end with CLI-backed next-step guidance.

#### Scenario: Discovery creates candidates
- **WHEN** `/omv-find` produces candidate findings
- **THEN** the agent tells the user to run `omv findings workflow` or `/omv next` to choose the next audit target

#### Scenario: Audit or reproduction completes
- **WHEN** `/omv-audit <id>` or `/omv-repro <id>` updates a finding
- **THEN** the agent suggests `omv review <id>` as the next readiness check

#### Scenario: Report generation completes
- **WHEN** `/omv-report <id>` produces a report artifact for a confirmed finding
- **THEN** the agent suggests `omv findings archive <id> --reason reported` after validation succeeds

### Requirement: Agents do not manually mutate lifecycle state
Agents SHALL delegate campaign, workspace, workflow, archive, and restore actions to CLI commands.

#### Scenario: Campaign creation requested through skill
- **WHEN** the user asks `/omv first` to initialize a target campaign
- **THEN** the agent runs `omv first` or `omv campaign init` and displays the CLI result instead of writing Campaign YAML directly

#### Scenario: Campaign seeding requested through skill
- **WHEN** the user asks `/omv campaign seed demo`
- **THEN** the agent runs `omv campaign seed demo` instead of writing Evidence files directly

#### Scenario: Archive requested through skill
- **WHEN** the user asks `/omv archive demo --reason reported`
- **THEN** the agent runs `omv findings archive demo --reason reported` and displays the CLI result

### Requirement: omv skill keeps campaign seeding conservative
The `/omv` skill SHALL describe campaign lanes as unproven hypotheses and SHALL delegate seeding to the CLI without claiming that analysis or reproduction has occurred.

#### Scenario: User seeds a campaign
- **WHEN** the user invokes `/omv campaign seed demo`
- **THEN** the agent runs `omv campaign seed demo`, reports created and skipped candidate findings, and recommends finding-level audit as a separate next step

### Requirement: Report guidance records local provenance without overstating trust
The `/omv` and `/omv-report` skills SHALL recommend SourceRef and report provenance commands as local traceability steps and SHALL NOT claim that a recorded locator or hash proves remote source authenticity.

#### Scenario: Preparing report artifacts
- **WHEN** a user has generated a report artifact for a finding
- **THEN** guidance recommends `omv report provenance <id>` followed by `omv report artifacts <id>` before archive

#### Scenario: Source identity is unknown
- **WHEN** SourceRef initialization cannot derive a repository or registry locator
- **THEN** guidance preserves the unknown state and asks for human source confirmation rather than inventing a URL

