# oh-my-vul

LLM-friendly vulnerability research skills for [Claude Code](https://claude.ai/code).

```sh
npx oh-my-vul setup
```

Installs three skills to `~/.claude/skills/` and makes them available as slash commands in Claude Code.

## Skills

| Skill | Command | Purpose |
|---|---|---|
| `omv` | `/omv` | Collection manager — help, list, update |
| `omv-find` | `/omv-find` | Find and rank open-source packages worth auditing |
| `omv-report` | `/omv-report` | Generate VulDB / CVE / GHSA / OSV advisory drafts |

The two research skills form a pipeline:

1. `/omv-find` — identify promising packages, source paths, and audit entry points
2. `/omv-report` — after confirming a real vulnerability, produce a submission-ready report

## Install

```sh
npx oh-my-vul setup          # install to ~/.claude/skills/
npx oh-my-vul setup --force  # overwrite existing
npx oh-my-vul setup --dry-run  # preview only
```

Check installation health:

```sh
omv doctor
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

## Requirements

- [Claude Code](https://claude.ai/code)
- Node.js ≥ 20

## Development

```sh
npm install
npm run build       # compile TypeScript
npm run typecheck   # type-check without emitting

python3 scripts/validate_skill.py          # validate all skills
python3 scripts/validate_skill.py skills/omv-find
python3 scripts/release_check.py           # release-time checks
```

## License

MIT
