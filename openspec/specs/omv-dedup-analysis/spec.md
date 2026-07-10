# omv-dedup-analysis Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Finding-based dedup workflow
`/omv-dedup <id>` SHALL read a local Evidence.v1 finding and derive deterministic search queries for NVD, GHSA, OSV, and the relevant ecosystem advisory database.

#### Scenario: Queries are shown before conclusions
- **WHEN** dedup runs for a finding with package, vulnerability type, affected versions, and sink evidence
- **THEN** the skill outputs source-specific query strings before assigning duplicate risk

### Requirement: Dedup writeback
The system SHALL write dedup investigation results into Evidence.v1 dedup fields only after user confirmation.

#### Scenario: User confirms dedup update
- **WHEN** the user confirms the generated dedup findings
- **THEN** the CLI updates fields such as `dedup.nvd_searched`, `dedup.ghsa_searched`, `dedup.ecosystem_db_searched`, `dedup.existing_cve`, and `dedup.notes`

#### Scenario: User rejects dedup update
- **WHEN** the user rejects or edits the dedup conclusion
- **THEN** the original Evidence.v1 file remains unchanged unless the user supplies an explicit replacement

### Requirement: Duplicate risk grading
Dedup output SHALL include a CNA duplicate-risk grade of `High`, `Medium`, or `Low` with reasons tied to matching advisories.

#### Scenario: Likely duplicate is flagged
- **WHEN** an advisory matches the same package, vulnerability class, affected range, and sink behavior
- **THEN** dedup marks duplicate risk `High` and identifies the matching CVE or advisory

#### Scenario: Weak overlap is not overclaimed
- **WHEN** advisories match only package name or only broad vulnerability class
- **THEN** dedup marks risk no higher than `Medium` and explains the missing overlap

### Requirement: Dedup eval coverage
The dedup skill SHALL include deterministic eval coverage for sanitized duplicate fixtures and novel-looking findings.

#### Scenario: Public CVE fixture is recognized
- **WHEN** a golden fixture represents a known disclosed vulnerability
- **THEN** the checker verifies that dedup reports `likely duplicate` or `High` duplicate risk

### Requirement: Dedup guidance explains comparison methodology
Dedup guidance SHALL focus on constructing source-specific queries and comparing package identity, affected range, vulnerability class, sink behavior, guard/fix overlap, and advisory provenance.

#### Scenario: Dedup risk is high
- **WHEN** dedup marks duplicate risk `High`
- **THEN** the explanation cites matching dimensions rather than teaching from a real public CVE case study

### Requirement: Dedup evals use sanitized duplicates
Dedup evals and golden outputs SHALL use sanitized duplicate fixtures instead of known public CVE findings.

#### Scenario: Duplicate fixture is checked
- **WHEN** a dedup checker validates a likely duplicate
- **THEN** it verifies methodology fields such as queries, overlap dimensions, risk grade, and writeback behavior

