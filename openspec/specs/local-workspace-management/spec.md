# local-workspace-management Specification

## Purpose
TBD - created by archiving change local-first-findings-manager. Update Purpose after archive.
## Requirements
### Requirement: CLI initializes a local OMV workspace
The CLI SHALL provide a workspace initialization command that creates the local `.omv/` directory structure, including `.omv/campaigns/` and `.omv/sources/`, without requiring network access or a global install state, and SHALL preserve existing finding, campaign, and source files.

#### Scenario: Initialize empty repository
- **WHEN** the user runs `omv workspace init` in a repository without `.omv/`
- **THEN** the CLI creates `.omv/findings/`, `.omv/campaigns/`, `.omv/sources/`, `.omv/archive/findings/`, and `.omv/index.json`

#### Scenario: Initialize existing workspace
- **WHEN** the user runs `omv workspace init` and `.omv/` already exists
- **THEN** the CLI preserves existing finding, campaign, and source files and refreshes the finding index

#### Scenario: Preserve campaign artifacts
- **WHEN** the user runs `omv workspace init` in a workspace with campaign YAML and Markdown files
- **THEN** the CLI leaves all campaign artifacts unchanged while refreshing finding index state

#### Scenario: Preserve source artifacts
- **WHEN** the user runs `omv workspace init` in a workspace with SourceRef.v1 files
- **THEN** the CLI leaves all source artifacts byte-for-byte unchanged

#### Scenario: Workspace index remains finding-specific
- **WHEN** campaign or source operations run
- **THEN** `.omv/index.json` contains no campaign or source records; ordinary finding operations retain their existing index behavior

### Requirement: CLI reports workspace status
The CLI SHALL provide a workspace status command that summarizes local project state from `.omv/`.

#### Scenario: Status with active and archived findings
- **WHEN** the user runs `omv workspace status`
- **THEN** the CLI prints workspace path, active finding count, archived finding count, status counts, and stale-index state

#### Scenario: Status JSON output
- **WHEN** the user runs `omv workspace status --json`
- **THEN** the CLI emits machine-readable workspace metadata including `root`, `findingsDir`, `archiveDir`, `activeCount`, and `archivedCount`

### Requirement: Workspace state remains private by default
The workspace commands SHALL treat `.omv/` as local research state and MUST NOT publish or sync it.

#### Scenario: Workspace init updates ignore guidance
- **WHEN** `omv workspace init` creates `.omv/`
- **THEN** the CLI warns if `.omv/` is not ignored by the repository and suggests adding it to `.gitignore`

