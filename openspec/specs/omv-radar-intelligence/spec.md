# omv-radar-intelligence Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Radar watchlist configuration
The system SHALL support a project-local radar watchlist at `.omv/radar/watchlist.yaml` containing packages, keywords, vulnerability classes, and ecosystems to monitor.

#### Scenario: Valid watchlist is loaded
- **WHEN** the user runs `omv radar refresh` with a valid watchlist
- **THEN** the CLI loads the configured watch entries and reports which passive sources will be queried

#### Scenario: Missing watchlist is actionable
- **WHEN** the user runs `omv radar refresh` without `.omv/radar/watchlist.yaml`
- **THEN** the CLI exits with instructions for creating the watchlist and does not create empty event output

### Requirement: Passive radar refresh
`omv radar refresh` SHALL collect passive changes from configured advisory feeds and package registries without sending requests to target project runtime endpoints or running proof-of-concept code.

#### Scenario: Refresh records events
- **WHEN** configured feeds contain new matching advisories or releases
- **THEN** the CLI appends normalized records to `.omv/radar/events.jsonl`

#### Scenario: Passive boundary is preserved
- **WHEN** a watch entry references a package repository or package name
- **THEN** radar reads only registries, advisory databases, and public metadata sources and does not probe package services

### Requirement: Offline radar dry run
`omv radar refresh --dry-run` SHALL run without network access by using checked-in fixtures.

#### Scenario: Fixture refresh is deterministic
- **WHEN** release checks run the radar dry-run fixture
- **THEN** the produced event summary is stable across runs

### Requirement: Radar brief generation
`omv radar brief` SHALL summarize recent radar events into a concise local intelligence brief.

#### Scenario: Weekly brief groups signals
- **WHEN** events include CVEs, GHSA or OSV advisories, new package versions, and suspected fix commits
- **THEN** the brief groups them by ecosystem, package, and signal type

### Requirement: Radar schedule offer
The radar skill SHALL offer an opt-in recurring weekly refresh after a successful manual refresh.

#### Scenario: User receives a schedule suggestion
- **WHEN** `/omv-radar` or `omv radar refresh` completes successfully
- **THEN** the output suggests a weekly Monday refresh without creating automation unless the user confirms

### Requirement: Radar guidance focuses on signal taxonomy
Radar guidance SHALL explain advisory, release, suspected-fix, and watchlist signals as prioritization inputs rather than presenting specific active vulnerabilities.

#### Scenario: Radar brief is generated
- **WHEN** radar produces a brief
- **THEN** the output groups signal types and recommends review priorities without framing a specific real vulnerability as a tutorial target

### Requirement: Radar fixtures are synthetic
Radar offline fixtures SHALL use synthetic package names, repository names, and advisory URLs.

#### Scenario: Dry-run fixture is emitted
- **WHEN** `omv radar refresh --dry-run` uses fixture data
- **THEN** event titles and URLs are clearly fixture or example data

