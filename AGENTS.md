# AGENTS.md

oh-my-vul is a modular, community-oriented collection of LLM-friendly vulnerability research skills for Claude Code.

The project ships a TypeScript CLI (`omv`) for installing skills, plus Markdown skill definitions and Python dev tools. Users install via `npx oh-my-vul setup`.

## Structure

```
src/
  cli/
    omv.ts                        — thin CLI entry (dispatches to commands/)
    commands/                     — one module per top-level command (findings, campaign, review, …)
    findings.ts                   — Evidence.v1 parse / validate / score / doctor / archive
    workflow.ts                   — shared readiness + next-action policy
    review.ts                     — report-readiness verdicts (ready | needs-*)
    campaign.ts                   — Campaign.v1 first-mile research plans
    setup.ts / doctor.ts          — install skills+agents; health checks
    paths.ts                      — claudeSkillsDir, findingsDir, packageRoot, …
  index.ts                        — package exports

skills/                           — 9 installable skills (self-contained after setup)
  omv, omv-find, omv-audit, omv-repro, omv-report,
  omv-radar, omv-dedup, omv-disclose, omv-critic

shared/
  references/                     — ecosystems, vuln-patterns, cvss-builder, per-eco patterns/
  pattern-packs/                  — 14 PatternPack.v1 JSON manifests
  scripts/                        — collect_metadata, estimate_loc, run_evals, …

contracts/
  evidence.v1.yaml                — finding object (find → report boundary)
  candidate-list.v1.yaml          — omv-find table entries
  threat-map.v1.yaml              — source → transform → sink graph (omv-audit sidecar)
  verification.v1.yaml            — adversarial verifier review sidecar
  campaign.v1.yaml                — research campaign plan + seed lanes
  source-ref.v1.yaml / report-provenance.v1.yaml / submission.v1.yaml

agents/                           — Claude Code subagent specs (installed by omv setup)
  vuln-scanner, dataflow-tracer, guard-checker, cvss-analyst,
  dedup-analyst, report-writer, verifier

scripts/
  sync_metadata.py / sync_skill_assets.py / validate_skill.py
  package_skill.sh / release_check.py / pattern_packs.py

registry.yaml                     — skills, agents, contracts, versions
openspec/                         — accepted specs + change archive
.github/workflows/validate.yml
```

## CLI

```sh
# Install skills to ~/.claude/skills/
npx oh-my-vul setup
npx oh-my-vul setup --scope project
npx oh-my-vul setup --force      # overwrite existing
npx oh-my-vul setup --dry-run    # preview only

# Check installation health
omv doctor
omv doctor --json

# Workspace + campaign
omv dashboard
omv first --target <name> --ecosystem npm --vuln traversal --no-interactive
omv campaign list|show|seed <id>
omv review <id> --strict

# Manage project-local Evidence.v1 findings
omv findings list
omv findings init <id>
omv findings init <id> --status candidate|confirmed|blocked --force
omv findings validate
omv findings validate <id|path>
omv findings promote <id|path> --status candidate|confirmed|blocked
omv findings workflow
omv findings doctor <id>
omv findings archive <id> --reason blocked|reported

# Sidecars and release gates
omv threat-map init|validate <id>
omv verification init|validate <id>
omv sources init|validate <id>
omv report artifacts|provenance <id>
omv repro init <id>
omv eval --json
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
npm run sync-assets
npm run sync-metadata
npm run validate
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

Skills must be self-contained after installation and packaging. When adding a new skill that consumes Evidence.v1, include `contracts/evidence.v1.yaml` inside that skill directory and reference it from the SKILL.md body. Shared guidance that a skill needs at runtime belongs under the skill's own `references/` tree.

Project-local research state lives under `.omv/`. Evidence handoff files belong in `.omv/findings/*.yaml`, follow `contracts/evidence.v1.yaml`, and are validated with `omv findings validate`. Use `omv findings init <id>` to create a canonical template before filling evidence. Treat `.omv/` as private local state unless a user explicitly asks to publish sanitized examples.

## Design Notes

Keep each `SKILL.md` concise. Put ecosystem-specific guidance, vulnerability matrices, scoring details, examples, and output contracts in `references/` so the agent loads only what the current request needs.

When adding new ecosystems or vulnerability classes, update the relevant shared reference file and add at least one eval scenario. Prefer deterministic script checks for repetitive behavior instead of expanding the main prompt.

When adding a new skill: place it in `skills/<name>/` with a `SKILL.md` whose frontmatter `name` matches the directory name, add focused `references/` and `evals/`, then run `python3 scripts/validate_skill.py` and rebuild packages.
