# finding-archive-management Specification

## Purpose
TBD - created by archiving change local-first-findings-manager. Update Purpose after archive.
## Requirements
### Requirement: CLI archives findings
The CLI SHALL archive findings by moving Evidence.v1 YAML files out of the active `.omv/findings/` queue while preserving their contents.

#### Scenario: Archive confirmed finding
- **WHEN** the user runs `omv findings archive demo --reason reported`
- **THEN** the CLI moves `.omv/findings/demo.yaml` to `.omv/archive/findings/demo.yaml` and records the archive reason in workspace metadata

#### Scenario: Archive candidate finding
- **WHEN** the user runs `omv findings archive demo --reason abandoned`
- **THEN** the CLI archives the finding and prints that it will no longer appear in active workflow views

#### Scenario: Archive destination conflict
- **WHEN** the archive destination already exists and `--force` is not provided
- **THEN** the CLI fails without overwriting either file and prints the conflicting path

### Requirement: CLI lists archived findings
The CLI SHALL provide an archive list command for reviewing inactive findings.

#### Scenario: List archive
- **WHEN** the user runs `omv findings archive list`
- **THEN** the CLI prints archived IDs, original status, archive reason, archived timestamp, package, and vulnerability

#### Scenario: List archive as JSON
- **WHEN** the user runs `omv findings archive list --json`
- **THEN** the CLI emits archived finding summaries with paths and archive metadata

### Requirement: CLI restores archived findings
The CLI SHALL restore archived findings to the active queue on request.

#### Scenario: Restore archived finding
- **WHEN** the user runs `omv findings restore demo`
- **THEN** the CLI moves `.omv/archive/findings/demo.yaml` back to `.omv/findings/demo.yaml` and refreshes the workspace index

#### Scenario: Restore conflict
- **WHEN** an active finding with the same ID already exists
- **THEN** the CLI fails without overwriting and suggests `--force` only if the user intends replacement

