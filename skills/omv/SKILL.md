---
name: omv
description: oh-my-vul local-first vulnerability research project manager. Shows workspace status, next actions, installed omv-* skills, registry info, and delegates .omv findings lifecycle commands. Use when the user types /omv, asks what to do next, or manages local findings.
---

# omv

oh-my-vul local-first vulnerability research project manager for Claude Code.

**Process first:** For any vulnerability research session (find / audit / report / “what next”), apply `using-omv` discipline — evidence before claims, CLI gates before “confirmed” or “ready to submit”, prefer campaign + attack-surface cards before bulk hypotheses. Do not invent parallel workflows outside `.omv/` + `omv` CLI.

## Commands

```text
/omv list                   — list all installed omv-* skills with one-line descriptions
/omv dashboard              — show workspace, active workflow queue, and recent activity
/omv start [flags]          — initialize the private workspace and first campaign
/omv eval                   — run deterministic stable skill eval checks
/omv first [flags]          — initialize a Campaign.v1 first-mile research plan
/omv campaign              — list local research campaigns
/omv campaign show <id>    — show Campaign scope, lanes, and next action
/omv campaign surfaces propose <id>  — propose attack-surface cards (开题)
/omv campaign surfaces show <id>     — show proposed/selected surface cards
/omv campaign surfaces select <id> --cards <id,id>
                            — select which cards become seed hypotheses
/omv campaign seed <id>    — create candidate Evidence hypotheses (selected cards or lanes)
/omv status                 — show local .omv workspace status (delegates to omv CLI)
/omv log                    — show local workspace activity log (delegates to omv CLI)
/omv next                   — show active findings and recommended next actions
/omv audit <id>             — deep-audit a candidate finding (delegates to omv-audit skill)
/omv repro <id>             — guide local reproduction of a finding (delegates to omv-repro skill)
/omv repro init <id>        — create .omv/repro/<id>/ artifact scaffold
/omv review <id>            — review report readiness and recommend the next step
/omv report artifacts <id>  — check report and reproduction artifacts
/omv report provenance <id> — hash report inputs into a local provenance manifest
/omv sources init <id>       — capture SourceRef.v1 from known Evidence source facts
/omv sources validate <id>   — check SourceRef.v1 and Evidence hash freshness
/omv verification init <id> — create .omv/verifications/<id>.yaml adversarial review scaffold
/omv verification show <id> — show adversarial verification status
/omv verification validate <id>
                            — validate Verification.v1 and stale Evidence hash
/omv archive <id> --reason <reason>
                            — archive an inactive finding (delegates to omv CLI)
/omv restore <id>           — restore an archived finding (delegates to omv CLI)
/omv findings list          — list .omv/findings evidence files (delegates to omv CLI)
/omv findings workflow      — show lifecycle next actions (delegates to omv CLI)
/omv findings doctor <id>   — advanced readiness diagnostics
/omv findings show <id>     — show one finding's validation state and next action
/omv findings open <id>     — print one finding YAML path for editing
/omv findings init <id>     — create a finding template (delegates to omv CLI)
/omv findings validate [id] — validate one or all findings (delegates to omv CLI)
/omv findings promote <id>  — update finding status (delegates to omv CLI)
/omv help                   — show this help text
```

The first word after `/omv` is treated as the subcommand. Unknown subcommands show the help text.

## Skills in This Collection

| Skill | Invocation | Purpose |
|---|---|---|
| omv-find | `/omv-find` | Find and rank open-source packages worth auditing |
| omv-audit | `/omv-audit` | Deep-audit a candidate finding, prove or disprove the vulnerability |
| omv-repro | `/omv-repro` | Guide local reproduction, fill evidence.observed_result |
| omv-report | `/omv-report` | Generate VulDB/CVE/GHSA/OSV advisory reports |

## Registry

Collection metadata lives in `references/registry.yaml`. Read it to show current version, platform requirements, and per-skill produces/consumes fields.

## State Directory

`.omv/` at the repository root stores campaigns, findings, source references, report provenance, archive metadata, and the rebuildable local workspace index. It is private local research state and should be gitignored. Campaigns live under `.omv/campaigns/`; active findings live under `.omv/findings/`; SourceRef.v1 sidecars live under `.omv/sources/`; inactive findings live under `.omv/archive/findings/`.

## CLI Delegation

When the user invokes campaign, workspace, lifecycle, repro scaffold, artifact check, archive, or restore commands, **run the matching `omv` CLI command via `Bash` and display its output. Do not implement the behavior manually** (do not `mkdir`, do not move files, do not write YAML directly).

Use `omv help`, `omv help review`, `omv help findings`, `omv help repro`, or `omv help report` as the source of truth for exact CLI signatures. For direct aliases:

- `/omv dashboard` -> `omv dashboard`
- `/omv start ...` -> `omv start ...`
- `/omv eval ...` -> `omv eval ...`
- `/omv first ...` -> `omv first ...`
- `/omv campaign ...` -> `omv campaign ...`
- `/omv status` -> `omv workspace status`
- `/omv log` -> `omv workspace log`
- `/omv next` -> `omv findings workflow`
- `/omv repro init <id>` -> `omv repro init <id>`
- `/omv review <id>` -> `omv review <id>`
- `/omv report artifacts <id>` -> `omv report artifacts <id>`
- `/omv report provenance <id>` -> `omv report provenance <id>`
- `/omv sources init <id>` -> `omv sources init <id>`
- `/omv sources validate <id>` -> `omv sources validate <id>`
- `/omv verification init <id>` -> `omv verification init <id>`
- `/omv verification show <id>` -> `omv verification show <id>`
- `/omv verification validate <id>` -> `omv verification validate <id>`
- `/omv archive <id> --reason <reason>` -> `omv findings archive <id> --reason <reason>`
- `/omv restore <id>` -> `omv findings restore <id>`
- `/omv findings ...` -> `omv findings ...`

**If `omv` is not found on PATH**, output: "`omv` is not installed. Run: `npm install --global oh-my-vul && omv setup`"

### Subcommand reference

- **first / campaign init** — creates `.omv/campaigns/<id>.yaml` and a deterministic Markdown runbook. Use canonical `omv campaign init` when the user asks how to begin; preserve `/omv first` when explicitly invoked.
- **campaign list/show** — reads Campaign.v1 files directly and reports generic hypothesis lanes.
- **campaign surfaces propose `<id>`** — writes `.omv/campaigns/<id>.surfaces.yaml` with deterministic attack-surface cards from the shared pack catalog, filtered by campaign vulnerability classes. Cards are unproven research topics (开题), not findings.
- **campaign surfaces show `<id>`** — lists card status (`proposed` / `selected` / `skipped`) and next action.
- **campaign surfaces select `<id> --cards <id,id>`** — marks chosen cards selected and others skipped. Required before seed when a surfaces file exists.
- **campaign seed `<id>`** — creates only candidate Evidence.v1 hypotheses. If a surfaces sidecar exists, only **selected** cards are seeded (finding ids like `<campaign>-renderer-pipeline`). Otherwise generic vulnerability-class lanes are used. Existing `.yaml`/`.yml` findings are never overwritten. Never claim seed audited, reproduced, verified, or proved a vulnerability, and never create ThreatMap, repro, verification, report, or PoC artifacts manually.
- **dashboard** — prints workspace status, active workflow queue, and recent activity in one view.
- **eval** — runs checked-in deterministic checker/golden pairs through the unified runner. It does not invoke a model or make network requests; `--json` and `--junit` are available for automation.
- **workspace status** — prints workspace path, active/archive counts, status counts, and privacy warnings.
- **workspace log** — prints the local activity trail for workspace init, finding init, promotion, archive, and restore.
- **init `<id>`** — creates `.omv/findings/<id>.yaml` from the Evidence.v1 template; default `--status candidate`. If file exists, CLI errors — suggest `--force`.
- **list** — prints ID / STATUS / READY / PACKAGE / VULNERABILITY table for every `.yaml` in `.omv/findings/`.
- **workflow** — prints active findings sorted by priority with NEXT ACTION recommendations such as `/omv-audit`, `/omv-repro`, `/omv-report`, promotion, or archive.
- **review `<id>`** — runs the unified pre-report readiness review and returns one verdict: `ready`, `needs-repro`, `needs-audit`, `needs-verification`, or `blocked`. Use `--strict` when adversarial Verification.v1 must pass before reporting.
- **doctor `<id>`** — advanced diagnostics for score deductions, unresolved blockers, suspicious CVSS/guard choices, sidecar validation, and artifact gaps. JSON mode is available for CI.
- **show `<id>`** — prints one finding's package, vulnerability, validation errors/warnings, missing fields, and next action. Use `--archived` to inspect archived findings.
- **open `<id>`** — prints the Evidence.v1 YAML path and next action so the user can edit or inspect the local file.
- **validate `[id|path]`** — checks required Evidence.v1 fields; exits non-zero on errors. No arg = validate whole ledger.
- **promote `<id|path> --status <s>`** — updates the `status` field and re-validates. Valid statuses: `candidate`, `confirmed`, `blocked`.
- **repro init `<id>`** — creates `.omv/repro/<id>/` with standard reproduction artifact files and records suggested `evidence.repro_artifacts`.
- **report artifacts `<id>`** — checks `.omv/reports/<id>/` and Evidence.v1 reproduction artifact references before final archive.
- **sources init/validate `<id>`** — records only source facts already present in Evidence.v1 and checks whether its hash is stale. Never describe SourceRef as proof that a remote source is authoritative.
- **report provenance `<id>`** — hashes Evidence, non-empty report files, and available SourceRef/ThreatMap/Verification/reproduction dependencies into `.omv/reports/<id>/provenance.json`.
- **verification init `<id>`** — creates `.omv/verifications/<id>.yaml` with the current Evidence.v1 SHA-256 for adversarial verifier review.
- **verification show `<id>`** — summarizes Verification.v1 decision, disagreements, required changes, and stale-hash state.
- **verification validate `<id>`** — validates Verification.v1 structure and warns when Evidence.v1 changed after review.
- **archive `<id> --reason <reason>`** — moves a finding to `.omv/archive/findings/` and removes it from active workflow views. For `--reason reported`, confirmed findings reuse `omv report artifacts <id>` checks; use `--strict` to block archive when artifacts are missing or empty.
- **archive list** — lists archived findings and archive reasons.
- **restore `<id>`** — moves an archived finding back to `.omv/findings/`.

## Workflow Overview

```
omv start                      → private workspace + detected target + first campaign
omv campaign init              → target, scope, priorities, generic lanes
omv campaign surfaces propose  → attack-surface cards (pack × class)
omv campaign surfaces select   → choose which hypotheses to pursue
omv campaign seed              → candidate Evidence.v1 for selected cards (or lanes)
                        ↓
/omv-find  →  identifies packages / entry points for those surfaces
              writes or updates .omv/findings/<id>.yaml  (status: candidate)
                        ↓
/omv-audit →  deep-audits the finding: dataflow trace, guard verification,
              PoC description, CVSS scoring, dedup search
              updates .omv/findings/<id>.yaml  (status: confirmed | blocked | candidate)
                        ↓
/omv-repro →  [optional] guides local reproduction when observed_result is unknown
              walks user through execution, records observed_result
              updates .omv/findings/<id>.yaml  (status: confirmed | blocked)
                        ↓
/omv review → checks Evidence.v1 plus available ThreatMap.v1 / Verification.v1
              returns ready | needs-repro | needs-audit | needs-verification | blocked
                        ↓
/omv-report → reads confirmed finding, generates VulDB/CVE/GHSA/OSV report
              then records/checks local provenance with omv report provenance/artifacts
                        ↓
archive    → omv findings archive <id> --reason reported
```

Each finding uses one of three Evidence.v1 statuses: `candidate`, `confirmed`, or `blocked`.
Use `omv dashboard`, `omv findings workflow`, or `/omv next` as the canonical active queue view after each stage. When the user asks whether a specific finding can be reported, run `omv review <id>` first and follow its verdict. When the CLI prints a priority value, follow the highest-priority row first unless the user names a specific finding.
