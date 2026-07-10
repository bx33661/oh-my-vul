# Development Notes

This document records why each `oh-my-vul` iteration exists, what changed, and which design ideas should guide future work.

It is different from `CHANGELOG.md`: the changelog records release-facing deltas; this file records engineering intent, tradeoffs, and next-step context for maintainers.

## Project Direction

`oh-my-vul` is a Claude Code skill collection for passive vulnerability research and disclosure preparation:

- `omv-find` finds and ranks promising open-source audit targets.
- `.omv/findings/*.yaml` stores Evidence.v1 handoffs and CVE readiness state.
- `omv-report` turns validated evidence into VulDB, CVE, GHSA, OSV, or Markdown advisory material.

The core product idea is evidence-driven reporting. The system should not merely generate polished prose; it should preserve evidence provenance, block premature submissions, and make missing proof explicit.

## Design Principles

- **Progressive disclosure**: keep `SKILL.md` focused on workflow and navigation. Put detailed ecosystem rules, examples, templates, contracts, and scoring details in `references/`.
- **Evidence before prose**: source -> sink -> guard, tested version, local PoC, impact requirements, and duplicate-search status matter more than fluent wording.
- **Deterministic checks for fragile behavior**: use scripts for packaging, validation, eval assertions, JSON structure checks, and other behavior that should not depend on model style.
- **Passive research boundary**: keep target discovery and audit guidance local, passive, and non-destructive. Do not ask users to attack live third-party systems.
- **Reviewer realism**: treat VulDB/GHSA/OSV reviewers as the quality bar. Reject or downgrade outputs that lack tested versions, prove only sink presence, overstate severity, or create duplicate CNA/CVE risk.
- **Format-specific output**: VulDB, GHSA, OSV, and Markdown advisories have different field syntax and expectations. Do not flatten them into one generic advisory shape.

## Current Architecture

The project has three layers:

| Layer | Files | Purpose |
|---|---|---|
| User workflow | `skills/omv-*`, `.omv/findings/*.yaml` | Claude Code-facing research and reporting flow |
| Deterministic CLI | `src/cli/*` | setup, doctor, catalog, and Evidence.v1 ledger checks |
| Release guardrails | `scripts/*`, `contracts/*`, evals | packaging, metadata sync, asset sync, and behavior checks |

Keep the boundary between these layers clean. Skills can guide model behavior, but anything fragile or repeatable should move into CLI checks or release scripts.

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

- Added `omv-find/references/handoff-contract.md`.
- Added `omv-report/references/handoff-contract.md`.
- Updated `omv-find` output rules so handoff packets are emitted only for confirmed or explicitly requested findings.
- Updated `omv-report` consumption rules for `candidate`, `confirmed`, and `blocked` handoff states.

Core idea:

The two skills need a typed boundary. Without a contract, `omv-find` output becomes loose prose and `omv-report` has to infer whether a vulnerability is real, candidate-only, or blocked. The handoff packet preserves evidence, blockers, provenance, and uncertainty.

Tradeoff:

The contract currently exists in both skill directories so each packaged skill is self-contained. This risks schema drift.

Next considerations:

- Introduce a root-level `contracts/handoff-v0.3.yaml` as the canonical schema.
- Generate or validate the two skill-local copies from that source.
- Add a `validate_handoff.py` script.

### v0.4 - omv-report Examples and Evals

What changed:

- Added more `omv-report` examples for prototype pollution and ReDoS.
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

- Added `omv-report/references/report-templates.md`.
- Added reusable templates for VulDB, GHSA, OSV JSON, and standalone Markdown advisories.
- Clarified duplicate CNA/CVE risk when GHSA and VulDB paths overlap.

Core idea:

`omv-report` should behave like an advisory format compiler. The same evidence can produce several platform-specific outputs, but each platform has different syntax, fields, and rejection risks.

Tradeoff:

More output formats increase maintenance cost. The mitigation is to centralize templates in one reference and use eval assertions for the behaviors most likely to regress.

Next considerations:

- Add `render_template.py` once handoff packets are stable enough.
- Add OSV schema validation beyond current heuristic checks.

### v0.6 - omv-report Eval Harness

What changed:

- Added `omv-report/scripts/check_output.py`.
- Added machine-readable assertions to `omv-report/evals/evals.json`.
- Added golden outputs for blocked handoff, OSV prototype pollution, and duplicate CNA warning cases.
- Connected stable `omv-report` golden evals to CI.

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

### v0.7 - Claude Code Packaging Foundation

What changed:

- Standardized installation on Claude Code's `~/.claude/skills/` directory.
- Made each skill directory self-contained by bundling the references, scripts, contracts, and registry metadata it needs at runtime.
- Added `scripts/sync_skill_assets.py` so canonical root assets can be copied into skill-local runtime paths deterministically.
- Added release checks for asset synchronization and version consistency across `package.json`, `package-lock.json`, and `registry.yaml`.
- Strengthened `omv doctor` so it checks bundled runtime files, package-local SKILL.md references, and executable shell helpers.

Core idea:

Skill installation and `.skill` archives should have the same runtime shape. If a user installs from npm, a release package, or a local checkout, the loaded skill must not depend on files outside its own directory.

Tradeoff:

Canonical files now have skill-local copies, which creates duplication. The mitigation is to treat root `shared/`, root `contracts/`, and `registry.yaml` as the source of truth and make `npm run validate` fail when copies drift.

### v0.8 - Evidence Ledger and User Workflow

What changed:

- Added project-scoped setup and persisted doctor scope.
- Added the `.omv/findings/*.yaml` Evidence.v1 ledger.
- Added `omv findings list`, `init`, `validate`, and `promote`.
- Updated `omv-find` to hand off findings through Evidence.v1 files.
- Updated `omv-report` to run evidence preflight before submission-ready output.
- Reworked the README around the user workflow rather than repository internals.

Core idea:

The product should feel like a small research workbench, not just a bundle of prompts. Evidence files are the durable object between discovery and reporting. They let the system say "not ready yet" in a structured way, which is as important as writing a polished report.

Tradeoff:

The ledger is intentionally lightweight YAML, not a database or platform. That keeps the project easy to install and review, but it means deeper validation and rendering still need future deterministic helpers.

### Current iteration - Manifest-driven PatternPacks and evals

What changed:

- Added one PatternPack.v1 JSON manifest for every supported ecosystem, including R and Lua.
- Made manifests drive skill-local pattern distribution and release-time methodology checks.
- Added one stable eval manifest plus a human/JSON/JUnit Python runner and `omv eval` CLI adapter.

Core idea:

Repeated asset and eval lists are contracts disguised as source code. Moving membership into validated JSON keeps progressive disclosure, package self-containment, local CI, and release checks aligned without rewriting skill-specific assertions.

Tradeoff:

The unified runner still starts one Python process per checker. The suite is small, and preserving each Skill's domain-specific checker is more valuable than premature shared assertion abstractions.

## Current Weaknesses

- The Evidence.v1 contract is copied into runtime skill directories; drift is checked by `scripts/sync_skill_assets.py --check`, but the duplication still adds release-surface noise.
- `omv-find` can guide Evidence.v1 handoff creation, but candidate discovery quality still depends on model discipline, source inspection, and available metadata.
- `omv-report` consumes validation guidance, but advisory rendering is still primarily model-written rather than deterministic.
- Examples are partly synthetic.
- Subagent orchestration is documented and installable, but still optional prose-driven rather than a forced fan-out runtime (see `docs/architecture/agent-team-upgrade.md`).
- Active skills (`omv-radar`, `omv-dedup`, `omv-disclose`, `omv-critic`) have thinner golden coverage than find/audit/repro/report.
- `src/cli/findings.ts` remains a large domain module (validate + score + doctor + archive).
- Historical `SPEC.md` listed skills that never shipped; treat OpenSpec + `registry.yaml` as truth.

## Proposed Next Iterations

### v0.10 - Campaign + evidence graph (in flight / Unreleased)

Goal:

Make the first-mile campaign story and evidence-graph sidecars a coherent release:

- `omv first` / Campaign.v1 seed → candidate queue
- ThreatMap + Verification + SourceRef + provenance on the report path
- `omv review --strict` as the pre-report gate in user docs
- Ship Unreleased items as `v0.10.0`

### v0.11 - Deterministic report compiler

Goal:

Evidence.v1 → structured advisory IR → VulDB/GHSA/OSV/Markdown via CLI render, with LLM only polishing narrative paragraphs.

### v0.12 - Agent team runtime minimum

Goal:

Tighten subagent tools (no unrestricted Bash), default omv-audit orchestration stages, and strict Verification requirements before confirmed/report-ready.

### Earlier: Real Workflow Walkthrough (delivered in docs/examples)

Goal (historical):

Add a sanitized end-to-end example that demonstrates the intended user path:

- run `/omv-find` for a realistic candidate;
- confirm evidence locally;
- create `.omv/findings/<id>.yaml`;
- pass `omv findings validate`;
- generate a non-submitting advisory draft with `/omv-report`.

The example should be safe, local, and clearly marked as a fixture.

### v0.9 - Advisory Renderer

Goal:

Render VulDB, GHSA, OSV, and Markdown advisory drafts from the structured evidence ledger.

Expected files:

- `skills/omv-report/scripts/render_template.py`
- `skills/omv-report/scripts/check_osv.py`
- deterministic tests for blocked, candidate, confirmed, and duplicate-CNA paths

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

### Later - Contract Packaging Cleanup

Goal:

Reduce skill-local contract duplication without breaking self-contained installs and `.skill` archives. Do this only after the package format and installation assumptions are stable.

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
