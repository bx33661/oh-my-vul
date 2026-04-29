# oh-my-vul

[![validate](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml/badge.svg)](https://github.com/bx33661/oh-my-vul/actions/workflows/validate.yml)
[![npm](https://img.shields.io/npm/v/oh-my-vul)](https://www.npmjs.com/package/oh-my-vul)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

LLM-friendly vulnerability research skills for Codex. `oh-my-vul` helps security researchers find promising open-source audit targets, preserve evidence, and turn confirmed findings into disclosure-ready VulDB, CVE, GHSA, OSV, or Markdown advisory drafts.

The project is intentionally evidence-first: it favors passive research, local verification, explicit uncertainty, and reviewer-friendly report structure over flashy exploit output.

## Quick Start

```sh
npx oh-my-vul setup
```

This installs three self-contained skills to `~/.codex/skills/` and makes them available as slash commands in Codex.

Check the install:

```sh
omv doctor
```

## Skills

| Skill | Command | Purpose |
|---|---|---|
| `omv` | `/omv` | Collection manager — help, list, update |
| `omv-find` | `/omv-find` | Find and rank open-source packages worth auditing |
| `omv-report` | `/omv-report` | Generate VulDB / CVE / GHSA / OSV advisory drafts |

The two research skills form a pipeline:

1. `/omv-find` — identify promising packages, source paths, and audit entry points
2. `/omv-report` — after confirming a real vulnerability, produce a submission-ready report

## Commands

```sh
npx oh-my-vul setup          # install to ~/.codex/skills/
npx oh-my-vul setup --force  # overwrite existing
npx oh-my-vul setup --dry-run  # preview only
omv doctor                   # verify install health
```

## Usage

```text
/omv-find --lang npm --vuln traversal --count 10
/omv-find --lang python --vuln injection keyword

/omv-report  (after omv-find produces a confirmed finding)
```

Supported `--vuln` aliases:

```text
proto traversal ssrf injection xss redos yaml unsafe deser race overflow
auth csrf xxe sql ssti sandbox redirect upload crypto infoleak
```

## Safety Boundary

`oh-my-vul` is for non-destructive vulnerability research:

- Inspect public metadata and public source code.
- Prefer local tests, local harnesses, and reproducible proof.
- Do not attack live third-party services.
- Do not generate credential theft, exfiltration, or abuse payloads.
- Keep unverified claims marked as unverified.

## Repository Layout

```text
src/                  TypeScript CLI: setup, doctor, package path helpers
skills/               Self-contained Codex skills installed by omv setup
shared/               Canonical shared references and helper scripts
contracts/            Canonical handoff schemas such as Evidence.v1
agents/               Role prompts used by the skills
scripts/              Validation, asset sync, packaging, and release checks
registry.yaml         Collection metadata
```

Skill directories are self-contained at runtime. Canonical files in `shared/`, `contracts/`, and `registry.yaml` are copied into skill-local paths with:

```sh
npm run sync-assets
```

## Requirements

- Codex
- Node.js ≥ 20

## Development

```sh
npm install
npm run sync-assets  # copy canonical shared assets into self-contained skills
npm run validate     # build, test, validate skills, and package-check releases
```

Focused checks:

```sh
npm run typecheck
python3 scripts/validate_skill.py
python3 scripts/release_check.py
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

MIT
