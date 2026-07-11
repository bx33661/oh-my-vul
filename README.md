<div align="center">

# oh-my-vul

**Evidence-first vulnerability research for Claude Code.**

Plan the research, trace the evidence, reproduce locally, and turn confirmed findings into review-ready reports.

[![validate](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg)](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/oh-my-vul)](https://www.npmjs.com/package/oh-my-vul)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

[简体中文](README.zh-CN.md) · [Example workflow](docs/examples/demo-finding-flow.md) · [Changelog](CHANGELOG.md)

</div>

---

`oh-my-vul` combines Claude Code skills with a local CLI to make open-source vulnerability research repeatable:

- **Start with a clear scope.** Campaigns and attack-surface cards turn a broad target into focused research questions.
- **Keep claims tied to evidence.** Findings record the tested version, source, sink, guards, reproduction, and remaining unknowns.
- **Report only when ready.** Local reproduction, duplicate checks, and strict review stop weak findings from becoming confident reports.

Research state stays in a private `.omv/` workspace. The project is designed for passive research and local validation, not live attacks against third-party services.

## Quick Start

**Requirements:** [Claude Code](https://docs.anthropic.com/en/docs/claude-code) and Node.js 20 or later.

Install the CLI and add the skills and agents to Claude Code:

```sh
npm install --global oh-my-vul
omv setup
```

From the root of the project you want to research, start a guided workspace:

```sh
omv start
```

`omv start` adds `.omv/` to `.gitignore`, detects local project metadata, and asks which vulnerability classes to investigate. To provide the scope non-interactively:

```sh
omv start --vuln xss,auth --no-interactive
```

Open that project in Claude Code, then run:

```text
/omv
```

`/omv` applies the evidence and review gates, shows the active queue, and recommends the next action. From the shell, bare `omv` opens the same contextual workspace view.

<details>
<summary><strong>Installation options</strong></summary>

Install only for the current project:

```sh
omv setup --scope project
```

Upgrade the package, then refresh a user-level or project-level install:

```sh
npm install --global oh-my-vul@latest
# Choose the scope you use:
omv setup --scope user --force
omv setup --scope project --force
```

Preview either scope without writing files:

```sh
# Choose the scope you use:
omv setup --scope user --dry-run
omv setup --scope project --dry-run
```

</details>

## The Workflow

```text
omv start
  -> initialize private state and create the first research campaign

/omv
  -> resume the campaign with evidence-before-claims rules

/omv-find
  -> discover and rank open-source audit targets

/omv-audit <finding-id>
  -> prove or block the source -> sink -> guard path

/omv-repro <finding-id>
  -> record what actually happens in a local test

/omv review <finding-id> --strict
  -> check whether the evidence is report-ready

/omv-report <finding-id>
  -> generate a VulDB, CVE, GHSA, OSV, or Markdown draft
```

The review gate can send a finding back for more audit, reproduction, deduplication, or adversarial verification. A candidate is never promoted just because a sink looks dangerous.

## Core Capabilities

| Goal | Command |
|---|---|
| Start a guided local research workspace | `omv start` |
| Resume or inspect work with evidence gates | `/omv`, `omv` |
| Find packages worth auditing | `/omv-find` |
| Trace data flow and evaluate guards | `/omv-audit <id>` |
| Guide a local reproduction | `/omv-repro <id>` |
| Check duplicate and rejection risk | `/omv-dedup <id>`, `/omv-critic <id>` |
| Prepare reports and disclosure | `/omv-report <id>`, `/omv-disclose <id>` |
| Watch releases and advisories | `/omv-radar` |

Supported ecosystems: npm, Python, Go, Rust, Java, Ruby, PHP, C#, Swift, Dart, Elixir, Perl, R, and Lua.

<details>
<summary><strong>All installed skills</strong></summary>

<!-- omv:skills:start -->
| Skill | Command | Category | Purpose |
|---|---|---|---|
| `using-omv` | `/using-omv` | manager | Bootstrap research discipline — hard gates, evidence-before-claims, process before improvisation (quality growth, not skill sprawl) |
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

</details>

## Local Workspace

All research artifacts live under `.omv/` in the target project:

| Path | Contains |
|---|---|
| `.omv/campaigns/` | Scope, priorities, and selected attack surfaces |
| `.omv/findings/` | Evidence.v1 records for active findings |
| `.omv/repro/` | Local reproduction notes and artifacts |
| `.omv/reports/` | Generated drafts and provenance manifests |
| `.omv/submissions/` | Disclosure and submission tracking |

Keep `.omv/` out of Git. Real findings may contain sensitive research notes and should remain private until disclosure is complete.

## Safety

- Use public metadata and source code for discovery.
- Reproduce only in local or explicitly authorized environments.
- Do not target live third-party services.
- Keep unknown or unverified facts marked as unknown.
- Treat generated reports as drafts until a human reviews the evidence.

See the [vulnerability research best practices](docs/vulnerability-research-best-practices.zh-CN.md) for the full research boundary.

## Documentation

| Guide | Use it for |
|---|---|
| [Demo finding flow](docs/examples/demo-finding-flow.md) | A sanitized end-to-end example |
| [Radar to audit](docs/examples/radar-to-audit-walkthrough.md) | Turning passive signals into an audit |
| [Disclosure and submission](docs/examples/disclosure-submission-walkthrough.md) | Following a confirmed finding through disclosure |
| [Evidence contracts](contracts/README.md) | Evidence.v1 and related file formats |
| [Request broker](docs/request-broker.md) | Public metadata requests, caching, and failure handling |

[Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
