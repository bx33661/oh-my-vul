# Contributing

Thanks for helping improve `oh-my-vul`. This project is a Codex skill collection, so the most important contribution quality is reproducibility: installed skills, `.skill` archives, and source checkout behavior should all match.

## Development Setup

```sh
npm install
npm run sync-metadata
npm run sync-assets
npm run validate
```

Use focused checks while iterating:

```sh
npm run typecheck
python3 scripts/validate_skill.py
python3 scripts/release_check.py
```

## Skill Rules

- Keep each `SKILL.md` concise and put detailed guidance in `references/`.
- Skill directories must be self-contained after installation.
- Do not reference files outside a skill directory from `SKILL.md`.
- Treat root `shared/`, root `contracts/`, and `registry.yaml` as canonical sources.
- Run `npm run sync-assets` after changing canonical shared assets.
- Add or update evals when behavior changes.
- Update `registry.yaml` when adding, removing, renaming, or changing the installability of a skill.

## Evidence Ledger

- Project evidence lives in `.omv/findings/*.yaml` and follows `contracts/evidence.v1.yaml`.
- `.omv/` is local state and should not be committed by default.
- Use `omv findings init <id>` when creating a new handoff file manually.
- Use `omv findings validate` before handing a finding from `/omv-find` to `/omv-report`.
- Use only `candidate`, `confirmed`, or `blocked` as finding status values.

## Safety Rules

`oh-my-vul` supports passive vulnerability research and local verification only.

- Do not add instructions for attacking live third-party services.
- Do not add credential theft, exfiltration, or abuse payloads.
- Keep proof-of-concept examples local and minimal.
- Preserve uncertainty and unverified fields in reports.

## Pull Requests

Before opening a PR:

1. Run `npm run validate`.
2. Update docs when commands, outputs, contracts, or release behavior changes.
3. Update `CHANGELOG.md` for release-facing changes.
4. Explain whether skill output behavior changed.
