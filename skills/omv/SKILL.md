---
name: omv
description: oh-my-vul collection manager. Lists installed omv-* skills, shows registry info, and displays version/status of the oh-my-vul skill collection. Use when the user types /omv, asks what oh-my-vul skills are available, or wants to see the collection status.
---

# omv

oh-my-vul collection manager for Codex.

## Commands

```text
/omv list          — list all installed omv-* skills with one-line descriptions
/omv status        — show registry version, last updated, skill count
/omv help          — show this help text
```

The first word after `/omv` is treated as the subcommand. Unknown subcommands show the help text.

## Skills in This Collection

| Skill | Invocation | Purpose |
|---|---|---|
| omv-find | `/omv-find` | Find and rank open-source packages worth auditing |
| omv-report | `/omv-report` | Generate VulDB/CVE/GHSA/OSV advisory reports |

## Registry

Collection metadata lives in `references/registry.yaml`. Read it to show current version, platform requirements, and per-skill produces/consumes fields.

## State Directory

`.omv/` at the repository root stores findings and context snapshots. It is gitignored. Use `/omv-find` and `/omv-report` to create and read finding files under `.omv/findings/`.

## Workflow Overview

```
/omv-find → identifies candidates → writes .omv/findings/<id>.yaml (status: candidate)
         ↓ (after manual verification)
/omv-report → reads finding, checks CVE readiness, generates reports
```

Each finding progresses through stages: `candidate` → `confirmed` → `reported`.
