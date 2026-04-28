# VulnFlow

Multi-skill project for passive vulnerability research and VulDB/CVE reporting.

## Skills

| Skill | Purpose |
|---|---|
| `vuln-finder` | Finds and ranks open-source packages worth auditing for passive CVE/VulDB research. |
| `vuldb-report` | Generates complete VulDB submission reports, CVE request checklists, and GHSA-ready advisory text. |

The two skills are designed to work as a research pipeline:

1. Use `vuln-finder` to identify promising packages, source paths, and local audit entry points.
2. Use `vuldb-report` after you have confirmed a real vulnerability and need a submission-ready report.

## Structure

```text
.
├── vuln-finder/
│   ├── SKILL.md
│   ├── references/
│   ├── scripts/
│   └── evals/
├── vuldb-report/
│   ├── SKILL.md
│   ├── references/
│   └── evals/
├── scripts/
│   ├── validate_skill.py
│   ├── package_skill.sh
│   └── release_check.py
├── vuln-finder.skill
├── vuldb-report.skill
├── CHANGELOG.md
└── RELEASE.md
```

## Install

Install either packaged skill directly:

```bash
claude skill install vuln-finder.skill
claude skill install vuldb-report.skill
```

Or install from source directories:

```bash
cp -r vuln-finder ~/.claude/skills/
cp -r vuldb-report ~/.claude/skills/
```

## Usage

`vuln-finder` supports slash-style requests:

```text
/vuln-finder --lang npm --vuln traversal --count 10
```

`vuldb-report` triggers when you ask for VulDB, CVE, GHSA, advisory, or disclosure help:

```text
帮我把这个漏洞写成 VulDB 报告并申请 CVE
write a CVE report for this npm package
```

## Development

Validate all skills:

```bash
python3 scripts/validate_skill.py
```

Validate one skill:

```bash
python3 scripts/validate_skill.py vuln-finder
python3 scripts/validate_skill.py vuldb-report
```

Rebuild packages:

```bash
bash scripts/package_skill.sh vuln-finder
bash scripts/package_skill.sh vuldb-report
```

Run the stable `vuln-finder` golden check:

```bash
python3 vuln-finder/scripts/check_output.py --eval-id 26 --output vuln-finder/evals/golden/invalid-flags.md
```

Run stable `vuldb-report` golden checks:

```bash
python3 vuldb-report/scripts/check_output.py --eval-id 4 --output vuldb-report/evals/golden/blocked-handoff.md
python3 vuldb-report/scripts/check_output.py --eval-id 5 --output vuldb-report/evals/golden/osv-prototype-pollution.json
python3 vuldb-report/scripts/check_output.py --eval-id 7 --output vuldb-report/evals/golden/duplicate-cna-warning.md
```

Run release checks and rebuild tracked packages:

```bash
python3 scripts/release_check.py
python3 scripts/release_check.py --write-artifacts
```

## Skill Handoff

When a `vuln-finder` result becomes a confirmed vulnerability, it can emit a structured `vuldb-report handoff` packet. The shared contract lives in:

- `vuln-finder/references/handoff-contract.md`
- `vuldb-report/references/handoff-contract.md`

The packet carries package identity, affected versions, source -> sink -> guard evidence, PoC status, impact requirements, disclosure status, blockers, and provenance. `vuldb-report` should refuse submission-ready output when the handoff is blocked or missing required evidence.

## Report Formats

`vuldb-report` supports:

- VulDB form fields
- Full Markdown advisory
- GitHub Security Advisory fields
- OSV JSON advisory draft

## Design Notes

Keep each skill's `SKILL.md` focused on trigger behavior, workflow, and which references to load. Put ecosystem-specific rules, scoring details, examples, and output contracts under each skill's `references/` directory so the agent can load only what the current task needs.

When adding a new skill, place it in a root-level directory with a `SKILL.md`, add focused references/evals, then validate and package it with the project-level scripts.
