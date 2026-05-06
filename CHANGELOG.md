# Changelog

## v0.7.1 - Hardened evidence workflow

- Replaced shallow CLI YAML parsing with structured parsing for Evidence.v1 and registry metadata.
- Added stricter Evidence.v1 validation gates, CLI argument validation, install manifests, and doctor integrity warnings.
- Added stable `omv-audit` and `omv-repro` eval checkers and release-time enforcement.
- Improved CLI ergonomics with command help, `omv version`, JSON setup output, and strict validation modes.
- Added a richer CLI/TUI output layer for setup, doctor, dashboard, findings, and validation views.
- Split finding scoring into evidence completeness and submission readiness so unresolved blockers and missing local observations no longer look submission-ready.
- Added `verdict` and `evidence.repro_artifacts` to Evidence.v1, plus `.omv/repro/<id>/` artifact conventions for local reproduction evidence.
- Added Chinese documentation and a full Chinese vulnerability-research best-practices guide.
- Added npm release guards and dry-run packaging checks.

## v0.7.0 - Evidence ledger workflow

- Standardized the README as a user-facing guide for installation, target discovery, Evidence.v1 handoffs, validation, reporting, and safety boundaries.
- Added project-scope setup, catalog-driven installs, stronger doctor checks, and metadata synchronization guards.
- Added the `.omv/findings` Evidence.v1 ledger with CLI commands for `list`, `init`, `validate`, and `promote`.
- Updated `omv-find` and `omv-report` docs so finder output flows through validated Evidence.v1 files before report generation.

## v0.6 - vuldb-report eval harness

- Added a deterministic `vuldb-report` eval checker for saved report outputs.
- Added machine-readable assertions for report format, OSV JSON, blocked handoffs, duplicate CNA warnings, severity sanity, and safe PoC wording.
- Added stable golden outputs for blocked handoff, OSV prototype pollution, and duplicate GHSA/VulDB CNA-risk scenarios.

## v0.5 - report templates

- Added reusable VulDB, GHSA, OSV, and standalone Markdown advisory templates.
- Added more `vuldb-report` examples and eval scenarios for advisory format selection.
- Kept GHSA and VulDB duplicate-CVE guidance explicit to avoid double CNA submissions.

## v0.4 - vuldb-report examples and evals

- Expanded `vuldb-report` behavioral coverage beyond basic XSS, traversal, and duplicate-CVE cases.
- Added examples for registry advisory formats and vulnerability classes that are common in package ecosystems.

## v0.3 - skill handoff contract

- Added a structured handoff contract from `vuln-finder` research output to `vuldb-report` submission drafting.
- Defined required, optional, and blocker fields so confirmed findings can be promoted without losing evidence provenance.

## v0.2 - release engineering

- Added a release check script that validates skill structure, rebuilds packages, and emits SHA-256 artifact metadata.
- Documented the release process, version policy, and compatibility checklist.
