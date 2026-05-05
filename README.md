# oh-my-vul

[![validate](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg)](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/oh-my-vul)](https://www.npmjs.com/package/oh-my-vul)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Evidence-first vulnerability research skills for Claude Code.

`oh-my-vul` helps you find promising open-source audit targets, keep the evidence organized, and turn confirmed findings into reviewer-friendly VulDB, CVE, GHSA, OSV, or Markdown advisory drafts.

It is intentionally built for passive research and local verification. The goal is not to spray exploit payloads or invent vulnerabilities; the goal is to preserve source -> sink -> guard evidence, make uncertainty visible, and stop premature reports before they waste reviewer time.

## Quick Start

Install the skills:

```sh
npx oh-my-vul setup
```

This installs 5 self-contained skills to `~/.claude/skills/` and makes them available as slash commands in Claude Code.

Check the install:

```sh
omv doctor
```

Use the workflow:

```text
/omv-find --lang npm --vuln traversal --count 10

omv findings init demo-traversal
/omv-audit demo-traversal
/omv-repro demo-traversal
omv findings validate demo-traversal

/omv-report
```

## What You Get

<!-- omv:skills:start -->
| Skill | Command | Category | Purpose |
|---|---|---|---|
| `omv` | `/omv` | manager | Local-first project manager — shows workspace status, active finding next actions, archive state, and installed skills |
| `omv-find` | `/omv-find` | research | Find and rank open-source packages worth auditing for passive CVE research |
| `omv-audit` | `/omv-audit` | audit | Deep-audit a candidate finding — prove or disprove the vulnerability, fill Evidence.v1 fields for omv-report |
| `omv-repro` | `/omv-repro` | audit | Guide local reproduction of a finding — walk through execution, record observed_result, confirm or block |
| `omv-report` | `/omv-report` | reporting | Generate VulDB/CVE/GHSA/OSV advisory reports from confirmed findings |
<!-- omv:skills:end -->

The intended flow is simple:

```text
/omv-find
  -> candidate packages and code-reading entry points
  -> .omv/findings/<id>.yaml
  -> /omv-audit
  -> /omv-repro when observed_result still needs local confirmation
  -> omv findings validate <id>
  -> /omv-report
  -> advisory draft for VulDB, CVE, GHSA, OSV, or Markdown
```

## Install Options

User-level install:

```sh
npx oh-my-vul setup
```

Project-level install:

```sh
npx oh-my-vul setup --scope project
```

Useful setup flags:

```sh
npx oh-my-vul setup --force
npx oh-my-vul setup --dry-run
npx oh-my-vul setup --json
omv doctor --json
omv doctor --strict
omv version --json
```

Project-level setup writes `.omv/setup-scope.json` so `omv doctor` can resolve the intended scope automatically. Use `--strict` when warnings should fail CI, and `omv version` to compare package and registry metadata.

## Finding Targets

Use `/omv-find` inside Claude Code:

```text
/omv-find --lang npm --vuln traversal --count 10
/omv-find --lang python --vuln injection keyword
/omv-find --lang all --count 12 markdown parser
```

Supported `--lang` values:

```text
npm python go rust java ruby php csharp swift dart elixir perl r lua all
```

Supported `--vuln` aliases:

```text
proto traversal ssrf injection xss redos yaml unsafe deser race overflow auth
csrf xxe sql ssti sandbox redirect upload crypto infoleak
```

`/omv-find` should return evidence-backed candidates: repository, registry identity, maintenance signal, code-size estimate, source -> sink -> guard notes, and local audit next steps.

## Evidence Ledger

Keep project-local research state in `.omv/findings/`. These files are gitignored by default because they may contain private research notes.

Create a template:

```sh
omv findings init demo-traversal
```

Fill the generated file:

```text
.omv/findings/demo-traversal.yaml
```

Validate before reporting:

```sh
omv findings validate demo-traversal
omv findings validate --json
omv findings validate --strict
```

Validation is the machine gate for status changes and reporting. Confirmed findings must pass field-level checks for tested version, source/sink/guard evidence, local reproducer, user-reported observed result, CVSS vector, dedup status, and unknown-field accounting.

Promote or block a finding as evidence changes:

```sh
omv findings promote demo-traversal --status confirmed
omv findings promote demo-traversal --status blocked
```

Status values are deliberately small:

| Status | Meaning |
|---|---|
| `candidate` | Promising, but proof is incomplete. |
| `confirmed` | Tested version, source, sink, guard, reproducer, and observed result are known. |
| `blocked` | The report should not move forward until blockers are resolved. |

`omv setup` writes an install manifest with copied skill files and hashes. `omv doctor` uses it to warn about stale or locally modified installed skills while still failing on missing runtime assets.

## Reporting

Use `/omv-report` after you have a validated Evidence.v1 file or a complete handoff packet.

`/omv-report` is designed to:

- preserve unverified fields instead of silently upgrading them;
- stop submission-ready reports when required evidence is missing;
- warn about duplicate CVE/CNA risk;
- choose platform-specific wording for VulDB, GHSA, OSV, and Markdown advisories;
- keep proof-of-concept language local and reviewer-safe.

## Safety Boundary

`oh-my-vul` supports non-destructive vulnerability research only:

- inspect public metadata and public source code;
- prefer local tests, local harnesses, and reproducible proof;
- do not attack live third-party services;
- do not generate credential theft, exfiltration, or abuse payloads;
- keep unverified claims marked as unverified.

## Requirements

- Claude Code
- Node.js 20 or newer

## Project Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution rules.
- [SECURITY.md](SECURITY.md) for reporting issues in this project.
- [RELEASE.md](RELEASE.md) for release packaging and compatibility checks.
- [contracts/README.md](contracts/README.md) for Evidence.v1 and other shared schemas.

## Development

```sh
npm install
npm run sync-metadata
npm run sync-assets
npm run validate
```

`package.json` is the release version source of truth; metadata sync updates registry and generated docs from it.

Focused checks:

```sh
npm run typecheck
python3 scripts/validate_skill.py
python3 scripts/release_check.py
```

## License

MIT
