# skill-eval-gates Specification

## Purpose
TBD - created by archiving change harden-evidence-workflow. Update Purpose after archive.
## Requirements
### Requirement: omv-audit behavioral evals
The repository SHALL include deterministic eval fixtures and checker logic for `omv-audit` behaviors that affect Evidence.v1 status and trust.

#### Scenario: Incomplete evidence remains candidate
- **WHEN** an `omv-audit` output has source, sink, and guard but `evidence.observed_result` remains `unknown`
- **THEN** the checker requires status to remain `candidate` and requires `provenance.unverified_fields` to include `evidence.observed_result`

#### Scenario: Duplicate advisory blocks promotion
- **WHEN** an `omv-audit` output identifies a likely duplicate CVE, GHSA, or ecosystem advisory
- **THEN** the checker requires status `blocked`, a populated `dedup.existing_cve` or duplicate note, and at least one blocker

#### Scenario: Confirmed output must cite evidence
- **WHEN** an `omv-audit` output marks a finding confirmed
- **THEN** the checker requires source, sink, guard, reproducer, observed result, CVSS vector, and dedup fields to be concrete and traceable

### Requirement: omv-repro behavioral evals
The repository SHALL include deterministic eval fixtures and checker logic for `omv-repro` behaviors that affect local reproduction safety.

#### Scenario: Repro skill does not execute commands
- **WHEN** an `omv-repro` output presents reproduction steps
- **THEN** the checker rejects language claiming the agent executed commands, installed packages, or observed results itself

#### Scenario: Repro skill does not rewrite reproducer
- **WHEN** an `omv-repro` output updates a finding after user-reported observations
- **THEN** the checker requires `evidence.reproducer` to remain unchanged and only permits observed-result, status, blockers, or provenance updates

#### Scenario: Repro failure becomes blocked
- **WHEN** an `omv-repro` output concludes local reproduction cannot proceed
- **THEN** the checker requires status `blocked` and a blocker with a specific reason

### Requirement: Eval checks run in release validation
Release validation SHALL execute the stable eval manifest through the unified runner, including the existing audit, repro, manager, radar, dedup, disclosure, critic, finder, and report golden checks.

#### Scenario: Release check catches unsafe audit behavior
- **WHEN** an audit golden output incorrectly marks incomplete evidence as confirmed
- **THEN** `python3 scripts/release_check.py` fails through the unified runner

#### Scenario: Release check catches unsafe repro behavior
- **WHEN** a repro golden output claims the agent ran commands locally
- **THEN** `python3 scripts/release_check.py` fails through the unified runner

#### Scenario: Stable manifest has an invalid entry
- **WHEN** a checker, eval file, or golden path in the stable manifest is missing or escapes the package root
- **THEN** release validation fails before reporting the suite as passed

### Requirement: Stable eval registry is data-driven
Stable case membership SHALL live in `shared/evals/stable.json`, not in TypeScript or `release_check.py`, and each case SHALL have a unique id, skill, eval id, checker path, and golden output path.

#### Scenario: Add stable golden case
- **WHEN** a maintainer adds a valid case to the JSON manifest
- **THEN** the next unified stable run executes it without a Python source-code list change

