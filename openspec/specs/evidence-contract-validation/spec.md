# evidence-contract-validation Specification

## Purpose
TBD - created by archiving change harden-evidence-workflow. Update Purpose after archive.
## Requirements
### Requirement: Structured Evidence YAML parsing
The CLI SHALL parse Evidence.v1 files with a structured YAML parser that preserves nested objects, lists, quoted strings, inline objects, comments, and multiline scalar values.

#### Scenario: Quoted comment marker is preserved
- **WHEN** a finding contains `dedup.notes: "searched #security advisory"`
- **THEN** validation reads the full string value and does not truncate at `#`

#### Scenario: Multiline observed result is preserved
- **WHEN** `evidence.observed_result` is a YAML block scalar with multiple lines
- **THEN** validation treats it as a non-empty observed result and preserves the text when promoting or rewriting status

### Requirement: Evidence contract validation
`omv findings validate` SHALL validate Evidence.v1 against machine-enforced field rules in addition to readiness scoring.

#### Scenario: Invalid enum values fail validation
- **WHEN** a finding uses an unsupported `package.ecosystem`, `status`, `cvss.severity`, or impact enum value
- **THEN** validation returns FAIL with a field-specific error

#### Scenario: Invalid structured fields fail validation
- **WHEN** a finding contains malformed repository URLs, dates, CVSS v3.1 vectors, or CWE identifiers
- **THEN** validation returns FAIL with a field-specific error

### Requirement: Confirmed findings require strict evidence gates
The CLI SHALL reject `confirmed` findings unless all confirmed-required evidence fields are known, structurally valid, and consistent with the Evidence.v1 contract. When graph or verification sidecars are present, the CLI SHALL include their validation results in readiness warnings; when strict verification is enabled, the CLI SHALL require a passing Verification.v1 sidecar before recommending report generation.

#### Scenario: Confirmed finding lacks file-line evidence
- **WHEN** a confirmed finding has `evidence.source`, `evidence.sink`, or `evidence.guard` without a `file:line` reference or an explicit "not present" guard explanation
- **THEN** validation returns FAIL and explains which field lacks traceable evidence

#### Scenario: Confirmed finding has unknown observed result
- **WHEN** a confirmed finding has `evidence.observed_result: unknown`
- **THEN** validation returns FAIL even if readiness would otherwise reach the threshold

#### Scenario: Strict verification blocks report recommendation
- **WHEN** a confirmed finding passes Evidence.v1 validation but strict verification is enabled and Verification.v1 is missing, stale, or failing
- **THEN** doctor/readiness output does not recommend `/omv-report` until verification passes

### Requirement: Unknown-field accounting is enforced
The CLI SHALL compare `unknown` values with `provenance.unverified_fields` and warn or fail according to status.

#### Scenario: Candidate finding has untracked unknown values
- **WHEN** a candidate finding has unknown evidence, CVSS, dedup, disclosure, or version fields not listed in `provenance.unverified_fields`
- **THEN** validation emits warnings naming the missing field paths

#### Scenario: Confirmed finding has untracked unknown values in required fields
- **WHEN** a confirmed finding has unknown values in required evidence, version, CVSS, or dedup fields
- **THEN** validation returns FAIL and names the unverified required field paths

### Requirement: Status promotion uses validation gates
`omv findings promote` SHALL write the requested status only when the target file can satisfy the target status gates, unless an explicit blocked status is being set with blockers.

#### Scenario: Promotion to confirmed is rejected
- **WHEN** the user runs `omv findings promote demo --status confirmed` and required confirmed evidence is missing
- **THEN** the file remains at its previous status and the CLI prints validation errors

#### Scenario: Promotion to blocked requires blockers
- **WHEN** the user runs `omv findings promote demo --status blocked` and `blockers` is empty
- **THEN** validation returns FAIL and the CLI tells the user to add at least one blocker

