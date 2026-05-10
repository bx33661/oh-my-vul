---
name: omv
description: oh-my-vul local-first vulnerability research project manager. Shows workspace status, next actions, installed omv-* skills, registry info, and delegates .omv findings lifecycle commands. Use when the user types /omv, asks what to do next, or manages local findings.
---

# omv

oh-my-vul local-first vulnerability research project manager for Claude Code.

## Commands

```text
/omv list                   — list all installed omv-* skills with one-line descriptions
/omv dashboard              — show workspace, active workflow queue, and recent activity
/omv status                 — show local .omv workspace status (delegates to omv CLI)
/omv log                    — show local workspace activity log (delegates to omv CLI)
/omv next                   — show active findings and recommended next actions
/omv audit <id>             — deep-audit a candidate finding (delegates to omv-audit skill)
/omv repro <id>             — guide local reproduction of a finding (delegates to omv-repro skill)
/omv repro init <id>        — create .omv/repro/<id>/ artifact scaffold
/omv report artifacts <id>  — check report and reproduction artifacts
/omv archive <id> --reason <reason>
                            — archive an inactive finding (delegates to omv CLI)
/omv restore <id>           — restore an archived finding (delegates to omv CLI)
/omv findings list          — list .omv/findings evidence files (delegates to omv CLI)
/omv findings workflow      — show lifecycle next actions (delegates to omv CLI)
/omv findings doctor <id>   — explain what blocks submission readiness
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

`.omv/` at the repository root stores findings, archive metadata, and the rebuildable local workspace index. It is private local research state and should be gitignored. Active findings live under `.omv/findings/`; inactive findings live under `.omv/archive/findings/`.

## CLI Delegation

When the user invokes workspace, lifecycle, repro scaffold, artifact check, archive, or restore commands, **run the matching `omv` CLI command via `Bash` and display its output. Do not implement the behavior manually** (do not `mkdir`, do not move files, do not write YAML directly).

Use `omv help`, `omv help findings`, `omv help repro`, or `omv help report` as the source of truth for exact CLI signatures. For direct aliases:

- `/omv dashboard` -> `omv dashboard`
- `/omv status` -> `omv workspace status`
- `/omv log` -> `omv workspace log`
- `/omv next` -> `omv findings workflow`
- `/omv repro init <id>` -> `omv repro init <id>`
- `/omv report artifacts <id>` -> `omv report artifacts <id>`
- `/omv archive <id> --reason <reason>` -> `omv findings archive <id> --reason <reason>`
- `/omv restore <id>` -> `omv findings restore <id>`
- `/omv findings ...` -> `omv findings ...`

**If `omv` is not found on PATH**, output: "`omv` is not installed. Run: `npx oh-my-vul setup`"

### Subcommand reference

- **dashboard** — prints workspace status, active workflow queue, and recent activity in one view.
- **workspace status** — prints workspace path, active/archive counts, status counts, and privacy warnings.
- **workspace log** — prints the local activity trail for workspace init, finding init, promotion, archive, and restore.
- **init `<id>`** — creates `.omv/findings/<id>.yaml` from the Evidence.v1 template; default `--status candidate`. If file exists, CLI errors — suggest `--force`.
- **list** — prints ID / STATUS / READY / PACKAGE / VULNERABILITY table for every `.yaml` in `.omv/findings/`.
- **workflow** — prints active findings sorted by priority with NEXT ACTION recommendations such as `/omv-audit`, `/omv-repro`, `/omv-report`, promotion, or archive.
- **doctor `<id>`** — explains why a finding is not submission-ready, including score deductions, unresolved blockers, suspicious CVSS/guard choices, and artifact gaps. JSON mode is available for CI.
- **show `<id>`** — prints one finding's package, vulnerability, validation errors/warnings, missing fields, and next action. Use `--archived` to inspect archived findings.
- **open `<id>`** — prints the Evidence.v1 YAML path and next action so the user can edit or inspect the local file.
- **validate `[id|path]`** — checks required Evidence.v1 fields; exits non-zero on errors. No arg = validate whole ledger.
- **promote `<id|path> --status <s>`** — updates the `status` field and re-validates. Valid statuses: `candidate`, `confirmed`, `blocked`.
- **repro init `<id>`** — creates `.omv/repro/<id>/` with standard reproduction artifact files and records suggested `evidence.repro_artifacts`.
- **report artifacts `<id>`** — checks `.omv/reports/<id>/` and Evidence.v1 reproduction artifact references before final archive.
- **archive `<id> --reason <reason>`** — moves a finding to `.omv/archive/findings/` and removes it from active workflow views. For `--reason reported`, confirmed findings reuse `omv report artifacts <id>` checks; use `--strict` to block archive when artifacts are missing or empty.
- **archive list** — lists archived findings and archive reasons.
- **restore `<id>`** — moves an archived finding back to `.omv/findings/`.

## Workflow Overview

```
/omv-find  →  identifies candidates
              writes .omv/findings/<id>.yaml  (status: candidate)
                        ↓
/omv-audit →  deep-audits the finding: dataflow trace, guard verification,
              PoC description, CVSS scoring, dedup search
              updates .omv/findings/<id>.yaml  (status: confirmed | blocked | candidate)
                        ↓
/omv-repro →  [optional] guides local reproduction when observed_result is unknown
              walks user through execution, records observed_result
              updates .omv/findings/<id>.yaml  (status: confirmed | blocked)
                        ↓
/omv-report → reads confirmed finding, generates VulDB/CVE/GHSA/OSV report
                        ↓
archive    → omv findings archive <id> --reason reported
```

Each finding uses one of three Evidence.v1 statuses: `candidate`, `confirmed`, or `blocked`.
Use `omv dashboard`, `omv findings workflow`, or `/omv next` as the canonical active queue view after each stage. When the CLI prints a priority value, follow the highest-priority row first unless the user names a specific finding.
