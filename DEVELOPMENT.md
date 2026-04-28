# Development Notes

This document records why each VulnFlow iteration exists, what changed, and which design ideas should guide future work.

It is different from `CHANGELOG.md`: the changelog records release-facing deltas; this file records engineering intent, tradeoffs, and next-step context for maintainers.

## Project Direction

VulnFlow is a two-skill workflow for passive vulnerability research and disclosure preparation:

- `vuln-finder` finds and ranks promising open-source audit targets.
- `vuldb-report` turns confirmed evidence into submission-ready VulDB, CVE, GHSA, OSV, or Markdown advisory material.

The core product idea is evidence-driven reporting. The system should not merely generate polished prose; it should preserve evidence provenance, block premature submissions, and make missing proof explicit.

## Design Principles

- **Progressive disclosure**: keep `SKILL.md` focused on workflow and navigation. Put detailed ecosystem rules, examples, templates, contracts, and scoring details in `references/`.
- **Evidence before prose**: source -> sink -> guard, tested version, local PoC, impact requirements, and duplicate-search status matter more than fluent wording.
- **Deterministic checks for fragile behavior**: use scripts for packaging, validation, eval assertions, JSON structure checks, and other behavior that should not depend on model style.
- **Passive research boundary**: keep target discovery and audit guidance local, passive, and non-destructive. Do not ask users to attack live third-party systems.
- **Reviewer realism**: treat VulDB/GHSA/OSV reviewers as the quality bar. Reject or downgrade outputs that lack tested versions, prove only sink presence, overstate severity, or create duplicate CNA/CVE risk.
- **Format-specific output**: VulDB, GHSA, OSV, and Markdown advisories have different field syntax and expectations. Do not flatten them into one generic advisory shape.

## Iteration Log

### v0.2 - Release Engineering

What changed:

- Added `scripts/release_check.py`.
- Added `RELEASE.md`.
- Added package digest output for release notes.
- Connected release packaging checks to CI.

Core idea:

Before adding more skill behavior, make the repository reproducible. A skill project needs the same release discipline as a small software package: validate the source layout, build archives from source, verify archive contents, and record package hashes.

Tradeoff:

The repo tracks generated `.skill` archives, which creates binary diffs. This is acceptable for a small skill distribution repo, but release checks and SHA-256 output are required so reviewers can verify what changed.

Next considerations:

- Add a manifest file generated during release if binary artifacts become hard to review.
- Consider a CI job that compares packaged archive entries against source files and fails if a tracked package is stale.

### v0.3 - Skill Handoff Contract

What changed:

- Added `vuln-finder/references/handoff-contract.md`.
- Added `vuldb-report/references/handoff-contract.md`.
- Updated `vuln-finder` output rules so handoff packets are emitted only for confirmed or explicitly requested findings.
- Updated `vuldb-report` consumption rules for `candidate`, `confirmed`, and `blocked` handoff states.

Core idea:

The two skills need a typed boundary. Without a contract, `vuln-finder` output becomes loose prose and `vuldb-report` has to infer whether a vulnerability is real, candidate-only, or blocked. The handoff packet preserves evidence, blockers, provenance, and uncertainty.

Tradeoff:

The contract currently exists in both skill directories so each packaged skill is self-contained. This risks schema drift.

Next considerations:

- Introduce a root-level `contracts/handoff-v0.3.yaml` as the canonical schema.
- Generate or validate the two skill-local copies from that source.
- Add a `validate_handoff.py` script.

### v0.4 - vuldb-report Examples and Evals

What changed:

- Added more `vuldb-report` examples for prototype pollution and ReDoS.
- Expanded eval scenarios beyond basic XSS, path traversal, and duplicate CVE cases.

Core idea:

Examples teach output style and edge-case judgment better than more generic instructions. Report generation quality depends on concrete platform expectations: version wording, affected component fields, severity rationale, safe PoC wording, and duplicate-CVE handling.

Tradeoff:

Some examples use placeholder projects. They are useful for template shape and safe test data, but they are weaker than real historical advisories for training judgment.

Next considerations:

- Add a curated set of public, real-world advisory references.
- Keep examples concise; avoid turning references into long prose dumps.

### v0.5 - Report Templates

What changed:

- Added `vuldb-report/references/report-templates.md`.
- Added reusable templates for VulDB, GHSA, OSV JSON, and standalone Markdown advisories.
- Clarified duplicate CNA/CVE risk when GHSA and VulDB paths overlap.

Core idea:

`vuldb-report` should behave like an advisory format compiler. The same evidence can produce several platform-specific outputs, but each platform has different syntax, fields, and rejection risks.

Tradeoff:

More output formats increase maintenance cost. The mitigation is to centralize templates in one reference and use eval assertions for the behaviors most likely to regress.

Next considerations:

- Add `render_template.py` once handoff packets are stable enough.
- Add OSV schema validation beyond current heuristic checks.

### v0.6 - vuldb-report Eval Harness

What changed:

- Added `vuldb-report/scripts/check_output.py`.
- Added machine-readable assertions to `vuldb-report/evals/evals.json`.
- Added golden outputs for blocked handoff, OSV prototype pollution, and duplicate CNA warning cases.
- Connected stable `vuldb-report` golden evals to CI.

Core idea:

The report skill must be testable. Natural language output cannot be compared exactly, but core failure modes can be checked heuristically:

- OSV output must be valid JSON.
- Blocked handoffs must not become submission-ready reports.
- Duplicate GHSA/VulDB CNA risk must be flagged.
- Vendor fields must not use registry names.
- Severity must account for authentication and user interaction.
- Safe PoCs must avoid credential theft or live-service exploitation.

Tradeoff:

Heuristic checks can miss subtle quality issues and can be gamed by wording. They are still valuable as regression guards for high-impact mistakes.

Next considerations:

- Add negative golden outputs to ensure the checker fails bad reports.
- Add per-assertion documentation with examples of pass/fail text.
- Consider using a structured intermediate report object so checker quality improves.

## Current Weaknesses

- The handoff contract is duplicated in two skills.
- `vuldb-report` has a checker, but `vuln-finder` and `vuldb-report` do not yet share a structured evidence object.
- Examples are partly synthetic.
- There is no CVE readiness score or evidence ledger.
- Package archives are tracked but not independently diffable.
- `vuldb-report` templates are still written by the model rather than rendered from structured input.

## Proposed Next Iterations

### v0.7 - Evidence Ledger and CVE Readiness

Goal:

Introduce a structured `evidence.yaml` or `finding.yaml` object that represents the vulnerability evidence independently of any final report format.

Candidate fields:

- package identity
- repository and registry source
- tested version and affected range
- source -> sink -> guard
- local reproducer and observed result
- duplicate advisory search
- disclosure status
- impact requirements
- unverified fields
- blockers

Add `CVE readiness: 0-100` based on evidence completeness. Submission-ready reports should require a threshold, for example 70 or 80.

### v0.8 - Handoff Schema Single Source

Goal:

Move the handoff schema to a root-level canonical file and validate skill-local copies.

Expected files:

- `contracts/handoff-v0.3.yaml`
- `scripts/validate_contracts.py`
- updated skill-local references that state producer/consumer rules only

### v0.9 - Advisory Renderer

Goal:

Render VulDB, GHSA, OSV, and Markdown advisory drafts from the structured evidence ledger.

Expected scripts:

- `vuldb-report/scripts/validate_handoff.py`
- `vuldb-report/scripts/render_template.py`
- `vuldb-report/scripts/check_osv.py`

### v1.0 - Real Corpus and Reviewer Mode

Goal:

Add real historical advisory cases and a reviewer-mode checker that explains why a report would be rejected or downgraded.

Reviewer checks:

- no tested version
- sink-only finding
- developer misuse
- duplicate advisory risk
- exaggerated severity
- unsafe PoC
- platform-specific field mistakes

## Maintenance Checklist

Before changing skill behavior:

1. Update or add references before expanding `SKILL.md`.
2. Add an eval for each new failure mode.
3. Add a deterministic checker when the behavior can be asserted structurally.
4. Run `python3 scripts/validate_skill.py`.
5. Run stable golden eval checks.
6. Run `python3 scripts/release_check.py`.
7. Rebuild tracked packages with `python3 scripts/release_check.py --write-artifacts`.
8. Update `CHANGELOG.md` and this document when the design intent changes.
