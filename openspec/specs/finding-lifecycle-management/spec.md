# finding-lifecycle-management Specification

## Purpose
TBD - created by archiving change local-first-findings-manager. Update Purpose after archive.
## Requirements
### Requirement: CLI computes finding next actions
The CLI SHALL compute a `next_action` for each active finding from Evidence.v1 status, readiness, required fields, and report/archive state.

#### Scenario: Candidate missing audit evidence
- **WHEN** a finding has `status: candidate` and missing source/sink/guard evidence
- **THEN** `omv findings list --workflow` recommends `/omv-audit <id>` and lists the missing evidence fields

#### Scenario: Candidate ready for reproduction
- **WHEN** a candidate has source/sink/guard/reproducer/CVSS filled but `evidence.observed_result` is `unknown`
- **THEN** `omv findings list --workflow` recommends `/omv-repro <id>`

#### Scenario: Confirmed finding ready for report
- **WHEN** a finding has `status: confirmed` and passes validation
- **THEN** `omv findings list --workflow` recommends `/omv-report <id>`

### Requirement: CLI exposes a lifecycle dashboard
The CLI SHALL provide an active workflow view over `.omv/findings/` without requiring users to inspect YAML manually.

#### Scenario: Workflow dashboard table
- **WHEN** the user runs `omv findings workflow`
- **THEN** the CLI prints ID, STATUS, READY, NEXT ACTION, PACKAGE, and VULNERABILITY for active findings

#### Scenario: Workflow dashboard JSON
- **WHEN** the user runs `omv findings workflow --json`
- **THEN** the CLI returns each active finding with `id`, `status`, `readiness`, `nextAction`, `missingFields`, and `path`

### Requirement: CLI records lifecycle timestamps
The CLI SHALL record project-management timestamps for lifecycle actions without weakening Evidence.v1 validation.

#### Scenario: Finding initialized
- **WHEN** `omv findings init <id>` creates a finding
- **THEN** the workspace index records `createdAt` and `updatedAt` for that finding

#### Scenario: Finding promoted
- **WHEN** `omv findings promote <id> --status confirmed` succeeds
- **THEN** the workspace index updates `updatedAt` and records the new status

