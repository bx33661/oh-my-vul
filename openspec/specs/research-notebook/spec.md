# research-notebook Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Per-finding notebook file
The system SHALL maintain optional local research notes at `.omv/notes/<id>.md`.

#### Scenario: Notebook is created on first append
- **WHEN** a skill or CLI command records a decision for finding `demo`
- **THEN** `.omv/notes/demo.md` is created if it does not already exist

### Requirement: Timestamped decision entries
Notebook entries SHALL include timestamp, actor or skill name, key decision, and referenced local files or source lines when available.

#### Scenario: Audit appends decision
- **WHEN** audit confirms a source-to-sink path
- **THEN** the notebook entry records the time, `omv-audit`, the decision summary, and relevant Evidence or ThreatMap paths

### Requirement: Notebook stays outside Evidence.v1
Research notebooks SHALL NOT be required by Evidence.v1 validation or schema scoring.

#### Scenario: Missing notebook does not fail validation
- **WHEN** a finding has no `.omv/notes/<id>.md`
- **THEN** `omv findings validate <id>` does not fail because notes are absent

### Requirement: Notebook privacy guidance
Documentation SHALL state that `.omv/notes/` is private local research state unless explicitly sanitized for sharing.

#### Scenario: Walkthrough warns before disclosure reuse
- **WHEN** a documentation walkthrough quotes notebook material
- **THEN** it explains that sensitive local details must be sanitized before publication

