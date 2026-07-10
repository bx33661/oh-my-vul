# unified-eval-runner Specification

## Purpose
TBD - created by archiving change add-pattern-pack-eval-runner. Update Purpose after archive.
## Requirements
### Requirement: One runner executes stable and targeted eval checks
The stdlib-only Python eval runner SHALL execute every case from the stable eval manifest by default and SHALL support a targeted skill, eval id, and output path while reusing the skill's existing checker script.

#### Scenario: Stable suite passes
- **WHEN** all checked-in golden outputs satisfy their existing checkers
- **THEN** the runner exits zero and reports every case as passed

#### Scenario: Targeted check fails
- **WHEN** a targeted output violates its selected eval assertions
- **THEN** the runner exits non-zero and preserves the checker failure detail in the case result

#### Scenario: Unsafe targeted input
- **WHEN** a skill name or manifest path attempts path traversal
- **THEN** the runner rejects it before starting a checker subprocess

### Requirement: Eval results support human, JSON, and JUnit formats
The runner SHALL emit a deterministic summary in human mode, one parseable JSON result document in JSON mode, and valid JUnit XML in JUnit mode; all formats SHALL preserve the same pass/fail counts and exit semantics.

#### Scenario: JSON output
- **WHEN** the runner is invoked with `--format json`
- **THEN** stdout contains only one JSON document with schema version, totals, status, and per-case results

#### Scenario: JUnit output
- **WHEN** the runner is invoked with `--format junit`
- **THEN** stdout parses as one testsuite document with a testcase per eval and failure elements for failed cases

### Requirement: CLI delegates eval execution without policy duplication
`omv eval` SHALL locate the packaged runner, forward stable or targeted arguments, preserve output and exit status, and contain no assertion or stable-case registry.

#### Scenario: CLI stable JSON run
- **WHEN** the user runs `omv eval --json`
- **THEN** the CLI emits the runner's single JSON document and exits zero only when every stable case passes

#### Scenario: Python runtime missing
- **WHEN** neither `OMV_PYTHON` nor `python3` can start the runner
- **THEN** the CLI exits non-zero with an actionable runtime error

