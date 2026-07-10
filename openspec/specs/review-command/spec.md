# review-command Specification

## Purpose
TBD - created by archiving change add-review-command. Update Purpose after archive.
## Requirements
### Requirement: Unified finding review command
The CLI SHALL provide `omv review <id> [--strict] [--json]` as the primary pre-submission readiness command for a project-local finding.

#### Scenario: Review reports ready finding
- **WHEN** a confirmed finding has valid Evidence.v1 data and no blocking readiness issues
- **THEN** `omv review <id>` reports a `ready` verdict and recommends the report step

#### Scenario: Review supports JSON output
- **WHEN** the user runs `omv review <id> --json`
- **THEN** the CLI prints structured JSON containing the finding id, verdict, report readiness, strict mode, next action, blockers, warnings, and underlying doctor result

### Requirement: Review verdict classification
The review command SHALL classify findings into `ready`, `needs-repro`, `needs-audit`, `needs-verification`, or `blocked` using existing deterministic checks.

#### Scenario: Missing reproduction evidence
- **WHEN** a finding has unknown or missing observed reproduction evidence
- **THEN** `omv review <id>` reports `needs-repro`

#### Scenario: Missing audit evidence
- **WHEN** a finding has Evidence validation errors or missing source, sink, guard, or CVSS evidence needed for reporting
- **THEN** `omv review <id>` reports `needs-audit`

#### Scenario: Blocked finding
- **WHEN** a finding has status `blocked`
- **THEN** `omv review <id>` reports `blocked`

### Requirement: Strict adversarial verification gate
The review command SHALL require a passing, non-stale Verification.v1 sidecar only when `--strict` is provided.

#### Scenario: Strict review without verification
- **WHEN** the user runs `omv review <id> --strict` and no Verification.v1 sidecar exists
- **THEN** the CLI reports `needs-verification` and recommends `omv verification init <id>` or `/omv-critic <id>`

#### Scenario: Non-strict review without verification
- **WHEN** the user runs `omv review <id>` without `--strict` and no Verification.v1 sidecar exists
- **THEN** the CLI does not fail solely because Verification.v1 is absent

### Requirement: Review reuses existing readiness checks
The review implementation SHALL reuse existing finding doctor and sidecar validation helpers rather than implementing an independent Evidence, ThreatMap, Verification, or artifact validator.

#### Scenario: Threat map warning is preserved
- **WHEN** finding doctor reports a ThreatMap consistency warning
- **THEN** `omv review <id>` includes that warning in the review output

#### Scenario: Artifact warning is preserved
- **WHEN** finding doctor reports missing report or reproduction artifacts
- **THEN** `omv review <id>` includes that artifact issue in the review output

