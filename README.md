# oh-my-vul

<p align="center">
  <strong>Evidence-first vulnerability research skills for Claude Code.</strong>
</p>

<p align="center">
  <a href="https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml"><img src="https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg" alt="validate"></a>
  <a href="https://www.npmjs.com/package/oh-my-vul"><img src="https://img.shields.io/npm/v/oh-my-vul" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="license: MIT"></a>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文文档</a>
  ·
  <a href="docs/vulnerability-research-best-practices.zh-CN.md">漏洞挖掘最佳实践</a>
  ·
  <a href="RELEASE.md">Release Guide</a>
</p>

> **Purpose:** `oh-my-vul` helps you find promising open-source audit targets, keep the evidence organized, and turn confirmed findings into reviewer-friendly **VulDB**, **CVE**, **GHSA**, **OSV**, or Markdown advisory drafts.
>
> **Safety boundary:** it is built for *passive research* and *local verification*. It does not encourage spraying exploit payloads, attacking live third-party services, or inventing vulnerabilities from weak evidence.

---

## At A Glance

| Area | What it gives you |
|---|---|
| **Target discovery** | `/omv-find` ranks packages worth auditing and points to code-reading entry points. |
| **Evidence ledger** | `.omv/findings/*.yaml` keeps structured Evidence.v1 research state. |
| **Audit workflow** | `/omv-audit` proves or blocks candidate findings using source -> sink -> guard reasoning. |
| **Local reproduction** | `/omv-repro` records user-observed local results and repro artifacts. |
| **Report drafting** | `/omv-report` generates review-friendly advisory drafts from validated findings. |
| **CLI management** | `omv dashboard`, `omv doctor`, and `omv findings ...` keep local state inspectable. |

## Quick Start

```sh
npx oh-my-vul setup
omv doctor
```

If `omv` is not on your `PATH`, use npx:

```sh
npx -p oh-my-vul omv doctor
```

Run the core workflow inside Claude Code:

```text
/omv-find --lang npm --vuln traversal --count 10

omv findings init demo-traversal
/omv-audit demo-traversal
/omv-repro demo-traversal
omv findings validate demo-traversal

/omv-report demo-traversal
```

<details>
<summary><strong>Install options</strong></summary>

User-level install:

```sh
npx oh-my-vul setup
```

Project-level install:

```sh
npx oh-my-vul setup --scope project
```

Useful flags:

```sh
npx oh-my-vul setup --force
npx oh-my-vul setup --dry-run
npx oh-my-vul setup --json
omv doctor --json
omv doctor --strict
omv version --json
```

Project-level setup writes `.omv/setup-scope.json` so `omv doctor` can resolve the intended scope automatically.

</details>

## Workflow

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

**Important distinction:** `oh-my-vul` separates *evidence completeness* from *submission readiness*. A finding can have many fields filled while still being blocked by missing local observations, unresolved blockers, weak version boundaries, or unproven exploitability.

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

## Finding Targets

Use `/omv-find` inside Claude Code:

```text
/omv-find --lang npm --vuln traversal --count 10
/omv-find --lang python --vuln injection keyword
/omv-find --lang all --count 12 markdown parser
```

<details>
<summary><strong>Supported languages and vulnerability aliases</strong></summary>

Supported `--lang` values:

```text
npm python go rust java ruby php csharp swift dart elixir perl r lua all
```

Supported `--vuln` aliases:

```text
proto traversal ssrf injection xss redos yaml unsafe deser race overflow auth
csrf xxe sql ssti sandbox redirect upload crypto infoleak
```

</details>

`/omv-find` should return evidence-backed candidates: repository, registry identity, maintenance signal, code-size estimate, **source -> sink -> guard** notes, and local audit next steps.

## Evidence Ledger

Project-local research state lives in `.omv/findings/`. These files are gitignored by default because they may contain private research notes.

```sh
omv findings init demo-traversal
omv findings workflow
omv findings show demo-traversal
omv findings validate demo-traversal
```

Evidence files follow [contracts/evidence.v1.yaml](contracts/evidence.v1.yaml). Confirmed findings must pass field-level checks for:

- tested version
- source/sink/guard evidence
- local reproducer
- user-reported observed result
- CVSS vector
- dedup status
- unknown-field accounting

<details>
<summary><strong>Status values</strong></summary>

| Status | Meaning |
|---|---|
| `candidate` | Promising, but proof is incomplete. |
| `confirmed` | Tested version, source, sink, guard, reproducer, and observed result are known. |
| `blocked` | The report should not move forward until blockers are resolved. |

Promote or block a finding as evidence changes:

```sh
omv findings promote demo-traversal --status confirmed
omv findings promote demo-traversal --status blocked
```

</details>

## Reporting

Use `/omv-report` after you have a validated Evidence.v1 file or a complete handoff packet.

`/omv-report` is designed to:

- **preserve unverified fields** instead of silently upgrading them;
- **stop submission-ready reports** when required evidence is missing;
- **warn about duplicate CVE/CNA risk**;
- choose platform-specific wording for VulDB, GHSA, OSV, and Markdown advisories;
- keep proof-of-concept language local and reviewer-safe.

## Safety Boundary

`oh-my-vul` supports **non-destructive vulnerability research only**:

- inspect public metadata and public source code;
- prefer local tests, local harnesses, and reproducible proof;
- do not attack live third-party services;
- do not generate credential theft, exfiltration, or abuse payloads;
- keep unverified claims marked as unverified.

## Requirements

- **Claude Code**
- **Node.js 20 or newer**

## Project Docs

| Document | Purpose |
|---|---|
| [README.zh-CN.md](README.zh-CN.md) | Chinese project guide. |
| [docs/vulnerability-research-best-practices.zh-CN.md](docs/vulnerability-research-best-practices.zh-CN.md) | Chinese best-practices guide for vulnerability research with this project. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup and contribution rules. |
| [SECURITY.md](SECURITY.md) | Reporting issues in this project. |
| [RELEASE.md](RELEASE.md) | Release packaging and compatibility checks. |
| [contracts/README.md](contracts/README.md) | Evidence.v1 and other shared schemas. |

## Development

```sh
npm install
npm run sync-metadata
npm run sync-assets
npm run validate
npm run release:check
npm run pack:check
```

Focused checks:

```sh
npm run typecheck
python3 scripts/validate_skill.py
python3 scripts/release_check.py
python3 scripts/check_npm_pack.py
```

<details>
<summary><strong>Release checklist</strong></summary>

```sh
npm view oh-my-vul version
npm run release:check
npm pack --dry-run
npm publish --access public
```

`package.json` is the release version source of truth. Metadata sync updates registry and generated docs from it.

</details>

## License

MIT
