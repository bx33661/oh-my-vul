---
name: omv
description: oh-my-vul collection manager. Lists installed omv-* skills, shows registry info, and displays version/status of the oh-my-vul skill collection. Use when the user types /omv, asks what oh-my-vul skills are available, or wants to see the collection status.
---

# omv

oh-my-vul collection manager for Claude Code.

## Commands

```text
/omv list                   — list all installed omv-* skills with one-line descriptions
/omv status                 — show registry version, last updated, skill count
/omv audit <id>             — deep-audit a candidate finding (delegates to omv-audit skill)
/omv repro <id>             — guide local reproduction of a finding (delegates to omv-repro skill)
/omv findings list          — list .omv/findings evidence files (delegates to omv CLI)
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

`.omv/` at the repository root stores findings and context snapshots. It is gitignored. Use `/omv-find` and `/omv-report` to create and read finding files under `.omv/findings/`.

## omv findings — CLI Delegation

When the user invokes any `omv findings` subcommand, **run it as a shell command via `Bash` and display its output. Do not implement the behavior manually** (do not `mkdir`, do not write YAML directly).

| Invocation | Run this shell command |
|---|---|
| `/omv findings list` | `omv findings list` |
| `/omv findings init <id>` | `omv findings init <id>` |
| `/omv findings init <id> --status confirmed` | `omv findings init <id> --status confirmed` |
| `/omv findings validate` | `omv findings validate` |
| `/omv findings validate <id>` | `omv findings validate <id>` |
| `/omv findings promote <id> --status <s>` | `omv findings promote <id> --status <s>` |

**If `omv` is not found on PATH**, output: "`omv` is not installed. Run: `npx oh-my-vul setup`"

### Subcommand reference

- **init `<id>`** — creates `.omv/findings/<id>.yaml` from the Evidence.v1 template; default `--status candidate`. If file exists, CLI errors — suggest `--force`.
- **list** — prints ID / STATUS / READY / PACKAGE / VULNERABILITY table for every `.yaml` in `.omv/findings/`.
- **validate `[id|path]`** — checks required Evidence.v1 fields; exits non-zero on errors. No arg = validate whole ledger.
- **promote `<id|path> --status <s>`** — updates the `status` field and re-validates. Valid statuses: `candidate`, `confirmed`, `blocked`.

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
```

Each finding uses one of three Evidence.v1 statuses: `candidate`, `confirmed`, or `blocked`.
