# oh-my-vul

[![validate](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg)](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/oh-my-vul)](https://www.npmjs.com/package/oh-my-vul)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Evidence-first vulnerability research skills for Codex.

`oh-my-vul` helps you find promising open-source audit targets, keep the evidence organized, and turn confirmed findings into reviewer-friendly VulDB, CVE, GHSA, OSV, or Markdown advisory drafts.

It is intentionally built for passive research and local verification. The goal is not to spray exploit payloads or invent vulnerabilities; the goal is to preserve source -> sink -> guard evidence, make uncertainty visible, and stop premature reports before they waste reviewer time.

## Quick Start

Install the skills:

```sh
npx oh-my-vul setup
```

This installs three self-contained skills to `~/.codex/skills/` and makes them available as slash commands in Codex.

Check the install:

```sh
omv doctor
```

Use the workflow:

```text
/omv-find --lang npm --vuln traversal --count 10

# after local verification
omv findings init demo-traversal
omv findings validate demo-traversal

/omv-report
```

## What You Get

<!-- omv:skills:start -->
| Skill | Command | Category | Purpose |
|---|---|---|---|
| `omv` | `/omv` | manager | Collection manager — lists skills, shows registry status |
| `omv-find` | `/omv-find` | research | Find and rank open-source packages worth auditing for passive CVE research |
| `omv-report` | `/omv-report` | reporting | Generate VulDB/CVE/GHSA/OSV advisory reports from confirmed findings |
<!-- omv:skills:end -->

The intended flow is simple:

```text
/omv-find
  -> candidate packages and code-reading entry points
  -> local verification by the researcher
  -> .omv/findings/<id>.yaml
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
omv doctor --json
```

Project-level setup writes `.omv/setup-scope.json` so `omv doctor` can resolve the intended scope automatically.

## Finding Targets

Use `/omv-find` inside Codex:

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
```

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

- Codex
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

Focused checks:

```sh
npm run typecheck
python3 scripts/validate_skill.py
python3 scripts/release_check.py
```

## License

MIT
