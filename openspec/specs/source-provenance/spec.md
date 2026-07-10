# source-provenance Specification

## Purpose
TBD - created by archiving change add-source-provenance. Update Purpose after archive.
## Requirements
### Requirement: SourceRef sidecars have a closed local contract
The system SHALL store optional SourceRef.v1 artifacts at `.omv/sources/<id>.yaml` with schema version 1, a matching finding id, the current Evidence.v1 SHA-256, an ISO timestamp, and closed-schema source records containing kind, locator, revision, path, and SHA-256 fields.

#### Scenario: Initialize from known Evidence facts
- **WHEN** a finding contains a repository URL or registry identity and the user runs `omv sources init <id>`
- **THEN** the CLI writes a SourceRef.v1 sidecar containing only those known facts and explicit unknown values

#### Scenario: Evidence has no known source identity
- **WHEN** source identity fields are empty or unknown
- **THEN** initialization writes a valid empty source list with a warning instead of inventing a locator

#### Scenario: Closed schema validation
- **WHEN** a SourceRef contains an undeclared field, unsafe id, invalid timestamp, malformed hash, or filename/body identity mismatch
- **THEN** validation fails with field-specific errors

### Requirement: SourceRef validation reports Evidence freshness
The CLI SHALL compare `finding_sha256` with the current finding bytes and report stale state without rewriting either file.

#### Scenario: Evidence changes after capture
- **WHEN** Evidence.v1 bytes differ from the hash recorded in SourceRef.v1
- **THEN** `omv sources validate <id>` succeeds structurally but reports `stale: true` and an actionable warning

#### Scenario: SourceRef is missing
- **WHEN** `show` or `validate` targets a finding without a SourceRef sidecar
- **THEN** the CLI exits non-zero and names the expected path

### Requirement: Report provenance manifests hash deterministic inputs
The system SHALL write `.omv/reports/<id>/provenance.json` only when a non-empty report artifact exists and SHALL record the finding, report artifacts, and every existing optional SourceRef, ThreatMap, Verification, or declared reproduction dependency with SHA-256 hashes.

#### Scenario: Create complete local manifest
- **WHEN** a finding has a report artifact plus available sidecars and reproduction files
- **THEN** `omv report provenance <id>` writes one deterministic manifest whose inputs use project-relative paths when possible

#### Scenario: Manifest does not count as a report
- **WHEN** the report directory contains only `provenance.json`
- **THEN** report artifact checking still reports that no non-empty report artifact exists

#### Scenario: Existing manifest protection
- **WHEN** a manifest exists and `--force` is absent
- **THEN** provenance creation preserves the existing bytes and exits non-zero

### Requirement: Report artifact checks are provenance-aware and backward compatible
The report artifact checker SHALL add manifest validation and freshness data without removing existing result fields. A missing manifest SHALL be a warning; a present malformed, missing-dependency, or hash-stale manifest SHALL be a warning for candidate findings and an error for confirmed findings.

#### Scenario: Legacy report directory
- **WHEN** non-empty report artifacts exist without `provenance.json`
- **THEN** `omv report artifacts <id>` retains its prior success semantics and adds a missing-provenance warning

#### Scenario: Confirmed report is stale
- **WHEN** a confirmed finding or hashed dependency changes after manifest creation
- **THEN** report artifact checking exits non-zero and identifies each stale or missing input

#### Scenario: Candidate report is stale
- **WHEN** the same stale manifest belongs to a candidate finding
- **THEN** the checker reports the freshness problem as a warning without turning the candidate artifact check into a hard error

