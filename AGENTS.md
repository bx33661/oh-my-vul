# Repository Guidance

## Purpose

`oh-my-vul` is a local-first, evidence-driven vulnerability research CLI and Skill collection. Keep research passive and reproduction local. Never weaken evidence gates to make a finding appear report-ready.

## Layout

- `src/cli/`: TypeScript CLI, domain workflows, renderers, and Ink TUI.
- `src/cli/__tests__/`: Node test runner coverage for CLI and TUI behavior.
- `skills/`: Canonical distributable Skills and their references, scripts, contracts, and evals.
- `agents/`: Claude Code-specific optional subagent definitions.
- `contracts/` and `shared/`: Canonical schemas and assets synchronized into Skills.
- `scripts/`: metadata, asset, packaging, and release validation.
- `openspec/`: local design artifacts; do not archive a change unless explicitly requested.

## Development

- Runtime baseline: Node.js 22 or later.
- Install dependencies with `npm install`.
- Use `npm run typecheck` for a fast TypeScript check.
- Use `npm run build && npm test` for implementation changes.
- Use `npm run release:check` before release-facing handoff.
- Run `npm run sync-assets` after changing canonical shared assets.
- Run `npm run sync-metadata` after changing package or registry metadata.

## Conventions

- Preserve deterministic JSON and non-TTY output. Ink must remain TTY-only.
- Keep `.omv/` research state private and out of source control.
- Use sanitized `demo-*`, `example-*`, or `fixture-*` data in tests and docs.
- Treat `unknown` as a valid evidence state; do not infer exploitability or observed results.
- Keep Codex and Claude Code setup paths isolated. Codex uses `.agents/skills`; Claude Code uses `.claude/skills` and optional `.claude/agents`.
- Update tests, user documentation, and `CHANGELOG.md` when behavior is user-visible.

## Completion

A change is complete when relevant tests pass, generated assets and metadata are synchronized, `git diff --check` is clean, and release-facing changes pass `npm run release:check`.
