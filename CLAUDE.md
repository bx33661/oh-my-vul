# CLAUDE.md

oh-my-vul is a modular, community-oriented collection of LLM-friendly vulnerability research skills for Claude Code.

The project ships a TypeScript CLI (`omv`) for installing skills, plus Markdown skill definitions and Python dev tools. Users install via `npx oh-my-vul setup`.

## Structure

```
src/cli/          — TypeScript CLI (commands/ split; findings/workflow/review/campaign domain modules)
skills/           — 9 omv-* skills (find, audit, repro, report, radar, dedup, disclose, critic, manager)
shared/           — references, pattern-packs, eval runner helpers
contracts/        — Evidence, ThreatMap, Verification, Campaign, SourceRef, Submission, …
agents/           — subagent specs installed to ~/.claude/agents/ by omv setup
openspec/         — accepted specs + change archive
registry.yaml     — versions and produces/consumes bindings
```

Canonical maintainer map: see `AGENTS.md` (kept in sync with the current tree). Early vision draft `SPEC.md` is historical only.

## CLI

```sh
# Install skills + agents
npx oh-my-vul setup
npx oh-my-vul setup --scope project
npx oh-my-vul setup --force
npx oh-my-vul setup --dry-run

# Health and workspace
omv doctor
omv doctor --strict
omv dashboard
omv review <id> --strict
omv findings workflow
```

Build the CLI:

```sh
npm install
npm run build      # tsc + chmod dist/cli/omv.js
npm run typecheck  # type-check without emitting
```

```sh
/omv-find [--lang npm|python|go|rust|java|ruby|php|csharp|swift|dart|elixir|perl|r|lua|all] [--vuln VULN_TYPE] [--count N] [keyword ...]
```

Supported vulnerability aliases:

```text
proto traversal ssrf injection xss redos yaml unsafe deser race overflow auth csrf xxe sql ssti sandbox redirect upload crypto infoleak
```

## Development

Validate all skills:

```sh
python3 scripts/validate_skill.py
```

Validate one skill:

```sh
python3 scripts/validate_skill.py skills/omv-find
python3 scripts/validate_skill.py skills/omv-report
```

Rebuild packages:

```sh
bash scripts/package_skill.sh skills/omv-find
bash scripts/package_skill.sh skills/omv-report
```

Run the stable `omv-find` golden eval:

```sh
python3 skills/omv-find/scripts/check_output.py --eval-id 26 --output skills/omv-find/evals/golden/invalid-flags.md
```

Run stable `omv-report` golden evals:

```sh
python3 skills/omv-report/scripts/check_output.py --eval-id 4 --output skills/omv-report/evals/golden/blocked-handoff.md
python3 skills/omv-report/scripts/check_output.py --eval-id 5 --output skills/omv-report/evals/golden/osv-prototype-pollution.json
python3 skills/omv-report/scripts/check_output.py --eval-id 7 --output skills/omv-report/evals/golden/duplicate-cna-warning.md
```

Run release checks:

```sh
python3 scripts/release_check.py
python3 scripts/release_check.py --write-artifacts
```

Packages contain root-level `SKILL.md` plus the skill's `references/`, `scripts/`, and `evals/` directories when present. They must not contain nested skill directory entries such as `omv-find/` or `omv-report/`.

## Contracts

Skills reference `contracts/` directly rather than duplicating schema in their `references/`. When adding a new skill that consumes Evidence.v1, reference `../../contracts/evidence.v1.yaml` from the SKILL.md body. The validator handles `../../shared/references/` and `../../contracts/` path prefixes.

## Design Notes

Keep each `SKILL.md` concise. Put ecosystem-specific guidance, vulnerability matrices, scoring details, examples, and output contracts in `references/` so the agent loads only what the current request needs.

When adding new ecosystems or vulnerability classes, update the relevant shared reference file and add at least one eval scenario. Prefer deterministic script checks for repetitive behavior instead of expanding the main prompt.

When adding a new skill: place it in `skills/<name>/` with a `SKILL.md` whose frontmatter `name` matches the directory name, add focused `references/` and `evals/`, then run `python3 scripts/validate_skill.py` and rebuild packages.
