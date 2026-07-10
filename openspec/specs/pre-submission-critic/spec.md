# pre-submission-critic Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Critic reads evidence and threat map
`/omv-critic <id>` SHALL review Evidence.v1, any linked ThreatMap.v1 artifact, and any linked Verification.v1 artifact before report generation.

#### Scenario: Critic receives full local context
- **WHEN** a finding has `.omv/findings/<id>.yaml`, `.omv/threatmaps/<id>.yaml`, and `.omv/verifications/<id>.yaml`
- **THEN** the critic considers all three files in its rejection-risk analysis

#### Scenario: Critic highlights failed verification
- **WHEN** Verification.v1 has `decision.status: fail`
- **THEN** the critic reports failed adversarial verification as a high-priority rejection risk

### Requirement: Adversarial rejection reasons
The critic SHALL list three to five likely CNA or maintainer rejection reasons when the finding is not low risk.

#### Scenario: Weak evidence is challenged
- **WHEN** a finding lacks observed local results or has unverified affected versions
- **THEN** the critic reports those gaps as likely rejection reasons

### Requirement: Reject risk classification
The critic SHALL output `reject_risk` as `low`, `medium`, or `high` with suggested strengthening actions.

#### Scenario: High-risk report is blocked from recommendation
- **WHEN** critic risk is `high`
- **THEN** the output does not recommend `/omv-report` until the listed strengthening actions are addressed

### Requirement: Critic is distinct from doctor
The critic SHALL evaluate argument quality while `omv findings doctor` remains responsible for deterministic structural readiness.

#### Scenario: Structurally valid finding can still be criticized
- **WHEN** a finding passes `omv findings doctor` but has weak novelty or impact reasoning
- **THEN** the critic can assign `medium` or `high` reject risk with rationale

### Requirement: Critic output evaluates argument quality
Critic guidance SHALL evaluate report argument quality through rejection-risk dimensions such as novelty, version proof, source-to-sink clarity, local observation, CVSS overclaiming, and disclosure readiness.

#### Scenario: Critic finds high risk
- **WHEN** a finding has weak evidence or duplicate risk
- **THEN** the critic lists methodological rejection reasons and strengthening actions rather than vulnerability-specific conclusions copied from a real case

### Requirement: Critic examples are sanitized
Critic evals and golden outputs SHALL use sanitized finding ids and generic rejection reasons.

#### Scenario: Critic golden is checked
- **WHEN** a critic golden output is validated
- **THEN** it includes `reject_risk` and method-based gaps without naming real packages or real CVEs

