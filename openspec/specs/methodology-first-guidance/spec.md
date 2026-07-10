# methodology-first-guidance Specification

## Purpose
TBD - created by archiving change methodology-first-security-guidance. Update Purpose after archive.
## Requirements
### Requirement: Public guidance is methodology-first
Skill docs, shared references, and walkthroughs SHALL teach repeatable security research methods rather than concrete real-world vulnerability walkthroughs.

#### Scenario: Skill explains a vulnerability class
- **WHEN** a skill describes SSRF, traversal, deserialization, XSS, or another vulnerability class
- **THEN** it explains source patterns, sink behavior, guard expectations, evidence criteria, and false-positive checks without naming a real vulnerable package as the lesson

### Requirement: Sanitized fixtures are clearly marked
Tests, evals, golden outputs, and walkthrough examples SHALL use clearly synthetic package names and advisory identifiers unless they are only validating a format.

#### Scenario: Golden output includes an advisory-like identifier
- **WHEN** a golden output needs an advisory or CVE-like value
- **THEN** the surrounding text marks it as sanitized, synthetic, demo, example, or fixture data

### Requirement: Real user findings remain allowed
The system SHALL allow users to provide and process real package names, real CVEs, and real advisory links during active research.

#### Scenario: User asks about a real finding
- **WHEN** a user-provided Evidence.v1 file contains a real package or CVE
- **THEN** the workflow may analyze it while keeping generated guidance focused on method and evidence quality

### Requirement: Release checks guard public examples
Release validation SHALL detect likely real package/CVE tutorial content in public skill docs, shared references, and golden outputs unless explicitly allowed as format-only or sanitized fixture text.

#### Scenario: Public golden names a real CVE as an example
- **WHEN** release checks scan a golden output containing a real CVE-style identifier without sanitized context
- **THEN** the check fails with an actionable message

