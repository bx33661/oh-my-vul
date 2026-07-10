# oh-my-vul

Evidence-first vulnerability research skills for Claude Code.

[![validate](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg)](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/oh-my-vul)](https://www.npmjs.com/package/oh-my-vul)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

`oh-my-vul` helps you find open-source audit targets, keep evidence in local YAML files, review source -> sink -> guard claims, and draft VulDB/CVE/GHSA/OSV reports from confirmed findings.

It is built for passive research and local verification. Do not use it to attack live third-party services or invent findings from weak evidence.

## Install

```sh
npx oh-my-vul setup
omv doctor
```

This installs 9 self-contained skills for Claude Code. If `omv` is not on your `PATH`, run it through npx:

```sh
npx -p oh-my-vul omv doctor
```

Project-local install:

```sh
npx oh-my-vul setup --scope project
```

## Fast Workflow

```text
omv first --target acme --ecosystem npm --vuln traversal,auth --no-interactive
  -> .omv/campaigns/acme.yaml + deterministic runbook

omv campaign seed acme
  -> candidate Evidence.v1 hypotheses only

/omv-find --lang npm --vuln traversal --count 10
  -> choose a candidate

/omv-audit <id>
  -> prove or block source -> sink -> guard

omv repro init <id>
/omv-repro <id>
  -> record local observed_result

omv review <id> --strict
  -> ready | needs-repro | needs-audit | needs-verification | blocked

/omv-report <id>
/omv-critic <id>
omv sources init <id>
omv report provenance <id>
omv report artifacts <id>
omv submissions record <id> --platform vuldb --submission-id 12345 --url https://example.test/submission/12345
omv findings archive <id> --reason reported
```

Use `omv dashboard` or `/omv next` whenever you are unsure what to do next.

## Core Commands

```sh
omv dashboard
omv campaign list
omv campaign show <id>
omv findings workflow
omv findings show <id>
omv findings validate <id>
omv review <id> --strict
omv sources validate <id>
omv report provenance <id>
omv report artifacts <id>
omv submissions track <id>
omv eval --json
```

Useful setup and health checks:

```sh
omv doctor --strict
omv request preflight
omv version --json
omv eval --junit
```

## Skills

<!-- omv:skills:start -->
| Skill | Command | Category | Purpose |
|---|---|---|---|
| `omv` | `/omv` | manager | Local-first project manager — creates research campaigns, shows workspace status, and delegates finding lifecycle actions |
| `omv-find` | `/omv-find` | research | Find and rank open-source packages worth auditing for passive CVE research |
| `omv-audit` | `/omv-audit` | audit | Deep-audit a candidate finding — prove or disprove the vulnerability, fill Evidence.v1 fields for omv-report |
| `omv-repro` | `/omv-repro` | audit | Guide local reproduction of a finding — walk through execution, record observed_result, confirm or block |
| `omv-report` | `/omv-report` | reporting | Generate VulDB/CVE/GHSA/OSV advisory reports from confirmed findings |
| `omv-radar` | `/omv-radar` | intelligence | Passive watchlist intelligence — refresh local advisory/release signals and summarize radar events |
| `omv-dedup` | `/omv-dedup` | intelligence | Duplicate advisory analysis — generate deterministic NVD/GHSA/OSV/ecosystem queries and update Evidence.v1 dedup fields |
| `omv-disclose` | `/omv-disclose` | disclosure | Responsible disclosure lifecycle helper — draft vendor emails, timelines, and local submission bookkeeping guidance |
| `omv-critic` | `/omv-critic` | reporting | Adversarial pre-submission review — identify likely CNA rejection reasons before report generation |
<!-- omv:skills:end -->

## Target Search

```text
/omv-find --lang npm --vuln proto --count 10
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

## Local Evidence

Project state lives under `.omv/` and is private by default.

| Path | Purpose |
|---|---|
| `.omv/campaigns/<id>.yaml` | Campaign.v1 target, scope, priorities, and lanes |
| `.omv/campaigns/<id>.md` | deterministic campaign runbook |
| `.omv/findings/<id>.yaml` | Evidence.v1 finding ledger |
| `.omv/sources/<id>.yaml` | SourceRef.v1 local source identity and Evidence hash |
| `.omv/threatmaps/<id>.yaml` | ThreatMap.v1 source -> sink -> guard graph |
| `.omv/verifications/<id>.yaml` | Verification.v1 adversarial review result |
| `.omv/repro/<id>/` | local reproduction notes and artifacts |
| `.omv/reports/<id>/` | generated report drafts and `provenance.json` input hashes |
| `.omv/submissions/<id>.yaml` | submission tracking |

Create or inspect findings:

```sh
omv findings init <id>
omv findings open <id>
omv findings promote <id> --status confirmed
omv findings promote <id> --status blocked
```

## Review Gate

`omv review` is the main pre-report check:

```sh
omv review <id>
omv review <id> --strict --json
```

Verdicts:

| Verdict | Meaning |
|---|---|
| `ready` | report generation can start |
| `needs-repro` | local observed result or proof is incomplete |
| `needs-audit` | Evidence.v1 fields, CVSS, dedup, or graph evidence need work |
| `needs-verification` | strict mode needs a passing, non-stale Verification.v1 sidecar |
| `blocked` | archive or revisit blockers |

## Docs

| Document | Purpose |
|---|---|
| [README.zh-CN.md](README.zh-CN.md) | Chinese guide |
| [docs/vulnerability-research-best-practices.zh-CN.md](docs/vulnerability-research-best-practices.zh-CN.md) | research method guide |
| [docs/request-broker.md](docs/request-broker.md) | request broker and cache behavior |
| [docs/examples/demo-finding-flow.md](docs/examples/demo-finding-flow.md) | sanitized end-to-end example |
| [contracts/README.md](contracts/README.md) | Evidence.v1 and sidecar contracts |
| [RELEASE.md](RELEASE.md) | release checklist |

## Development

```sh
npm install
npm run sync-metadata
npm run sync-assets
npm run validate
npm run release:check
```

Before npm publish:

```sh
npm view oh-my-vul version
npm run release:check
npm pack --dry-run
npm publish --access public
```

## License

MIT
