# AGENTS.md

oh-my-vul is a modular, community-oriented collection of LLM-friendly vulnerability research skills for Claude Code.

The project ships a TypeScript CLI (`omv`) for installing skills, plus Markdown skill definitions and Python dev tools. Users install via `npx oh-my-vul setup`.

## Structure

```
src/
  cli/
    omv.ts                        — CLI entry point (setup / doctor / findings / help)
    setup.ts                      — copies installable skills to ~/.claude/skills/ or ./.claude/skills/
    doctor.ts                     — checks installation health
    findings.ts                   — creates, lists, validates, and promotes Evidence.v1 handoffs
    paths.ts                      — path utilities (claudeSkillsDir, projectSkillsDir, findingsDir, packageRoot, …)
  index.ts                        — package exports

skills/
  omv/SKILL.md                  — collection manager (/omv)
  omv-find/SKILL.md             — find and rank audit targets (/omv-find)
  omv-find/references/
    scoring.md                  — scoring rubric, confidence adjustments, filtering, LOC estimation
    output-contract.md          — final table contract, audit tips, invalid-request template
  omv-find/scripts/check_output.py  — heuristic eval checker
  omv-find/evals/evals.json     — behavior-focused eval scenarios
  omv-find/evals/golden/        — stable golden outputs
  omv-report/SKILL.md           — generate VulDB/CVE/GHSA/OSV reports (/omv-report)
  omv-report/references/
    ecosystems.md               — vendor/product/version rules, CWE mapping, duplicate-CVE databases
    report-templates.md         — VulDB, GHSA, OSV JSON, Markdown advisory templates
    examples/                   — filled advisory examples
  omv-report/scripts/check_output.py  — heuristic eval checker
  omv-report/evals/evals.json   — behavior-focused report-generation eval scenarios
  omv-report/evals/golden/      — stable golden outputs

shared/
  references/
    ecosystems.md               — ecosystem registry sources, GitHub search shapes, flagship exclusions
    vuln-patterns.md            — vulnerability aliases and source -> sink -> guard patterns
    cvss-builder.md             — CVSS v3.1 metric decision table and common vectors
  scripts/
    collect_metadata.py         — collects GitHub and selected registry metadata as JSON
    estimate_loc.sh             — estimates source LOC from a GitHub URL or local checkout

contracts/
  evidence.v1.yaml              — finding object: the typed boundary between omv-find and omv-report
  candidate-list.v1.yaml        — candidate table entry schema produced by omv-find
  threat-map.v1.yaml            — dataflow threat map schema (planned: omv-audit M2+)

agents/
  vuln-scanner.md               — passive candidate discovery
  dataflow-tracer.md             — source -> sink -> guard analysis
  cvss-analyst.md                — CVSS v3.1 computation
  dedup-analyst.md               — duplicate CVE/GHSA search
  report-writer.md               — platform-specific advisory rendering
  guard-checker.md              — adversarial guard bypass assessment
  verifier.md                   — adversarial conclusion refutation

.claude/agents/                — Claude Code project subagent registration (auto-discovered)
  <name>.md                      — frontmatter (name, description, tools, model) + system prompt body
  Each subagent's body references the matching agents/*.md domain spec. See
  docs/architecture/agent-team-upgrade.md for the orchestration design.

scripts/
  sync_metadata.py              — sync package, registry, and README metadata
  sync_skill_assets.py           — sync canonical shared/contract assets into self-contained skill dirs
  validate_skill.py             — validates all skill directories and optional .skill packages
  package_skill.sh              — builds a .skill archive from a skill directory
  release_check.py              — release-time validator, package builder, SHA-256 manifest printer

registry.yaml                   — collection metadata: versions, produces/consumes bindings
.github/workflows/validate.yml  — CI validation, packaging checks, stable golden evals
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

# Manage project-local Evidence.v1 findings
omv findings list
omv findings init <id>
omv findings init <id> --status candidate|confirmed|blocked --force
omv findings validate
omv findings validate <id|path>
omv findings promote <id|path> --status candidate|confirmed|blocked
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
