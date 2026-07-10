# verification-artifacts Specification

## Purpose
TBD - created by archiving change add-evidence-graph-verification. Update Purpose after archive.
## Requirements
### Requirement: Verification.v1 sidecar storage
The system SHALL store adversarial verifier reviews as Verification.v1 artifacts at `.omv/verifications/<id>.yaml`.

#### Scenario: Verification sidecar is initialized
- **WHEN** the user runs `omv verification init <id>`
- **THEN** the CLI writes `.omv/verifications/<id>.yaml` linked to the existing Evidence.v1 finding id

### Requirement: Verification review records
Verification.v1 SHALL record one or more review entries with reviewer identity, target path, agreement, disagreements, required changes, confidence, and timestamp.

#### Scenario: Verifier disagrees with a path
- **WHEN** a verifier finds that `threatmap.paths[0]` has a developer-controlled source
- **THEN** the sidecar records `agrees: false`, the disagreement text, and a required change describing the downgrade

### Requirement: Verification validation
`omv verification validate <id>` SHALL validate Verification.v1 structure and report pass, fail, or needs-human-review status.

#### Scenario: Required review fields are missing
- **WHEN** a verification sidecar omits reviewer, target, agreement, confidence, or decision status
- **THEN** validation fails with field-specific errors

### Requirement: Stale verification detection
Verification.v1 SHALL include the reviewed finding hash and validation SHALL warn when the current Evidence.v1 file hash differs.

#### Scenario: Evidence changed after verification
- **WHEN** `.omv/findings/<id>.yaml` changes after verifier review
- **THEN** `omv verification validate <id>` warns that the verification is stale

### Requirement: Strict confirmed verification gate
The CLI SHALL support a strict mode where a confirmed/report-ready finding requires a valid Verification.v1 sidecar with `decision.status: pass`.

#### Scenario: Strict gate blocks unverified confirmed finding
- **WHEN** strict verification is enabled and a confirmed finding lacks a passing verification sidecar
- **THEN** readiness guidance does not recommend `/omv-report` and points to `omv verification init <id>`

