# Changelog

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
