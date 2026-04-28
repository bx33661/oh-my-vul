# CLAUDE.md

This repository contains a small multi-skill project for passive vulnerability research and VulDB/CVE reporting.

The project is mostly Markdown instructions plus deterministic helper scripts. There is no compiled application code.

## Structure

- `vuln-finder/SKILL.md` - skill entry point for finding and ranking open-source packages worth auditing.
- `vuln-finder/references/ecosystems.md` - ecosystem registry sources, GitHub search shapes, keyword rotation, and flagship exclusions.
- `vuln-finder/references/vuln-patterns.md` - vulnerability aliases and source -> sink -> guard patterns.
- `vuln-finder/references/scoring.md` - scoring rubric, confidence adjustments, filtering, and LOC estimation rules.
- `vuln-finder/references/output-contract.md` - final table contract, audit tips, invalid request response, and sparse-result handling.
- `vuln-finder/references/handoff-contract.md` - handoff packet emitted when a confirmed finding should be passed to `vuldb-report`.
- `vuln-finder/scripts/collect_metadata.py` - collects GitHub and selected registry metadata as JSON.
- `vuln-finder/scripts/estimate_loc.sh` - estimates source LOC from a GitHub URL or local checkout.
- `vuln-finder/scripts/check_output.py` - heuristic eval-output checker for saved model outputs.
- `vuln-finder/evals/evals.json` - behavior-focused eval scenarios.
- `vuln-finder/evals/golden/invalid-flags.md` - stable golden output for the invalid flag eval.
- `vuldb-report/SKILL.md` - skill entry point for VulDB form output, CVE checklist, and GHSA advisory drafting.
- `vuldb-report/references/ecosystems.md` - vendor/product/version rules, duplicate-CVE sources, install commands, and CWE/Class mapping.
- `vuldb-report/references/cvss-builder.md` - CVSS v3.1 metric decision table and common vectors.
- `vuldb-report/references/handoff-contract.md` - handoff packet consumer contract from `vuln-finder`.
- `vuldb-report/references/report-templates.md` - VulDB, GHSA, OSV JSON, and standalone Markdown advisory templates.
- `vuldb-report/references/examples/` - filled advisory examples.
- `vuldb-report/scripts/check_output.py` - heuristic eval-output checker for saved report outputs.
- `vuldb-report/evals/evals.json` - behavior-focused report-generation eval scenarios.
- `scripts/validate_skill.py` - project-level validator for all skill directories and optional `.skill` packages.
- `scripts/package_skill.sh` - project-level package builder for any root-level skill directory.
- `scripts/release_check.py` - release-time validator, package builder, and SHA-256 manifest printer.
- `.github/workflows/validate.yml` - CI validation, packaging checks, and the stable golden eval.
- `vuln-finder.skill` and `vuldb-report.skill` - packaged skill artifacts.

## Skill Invocation

```sh
/vuln-finder [--lang npm|python|go|rust|java|ruby|php|csharp|swift|dart|elixir|perl|r|lua|all] [--vuln VULN_TYPE] [--count N] [keyword ...]
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
python3 scripts/validate_skill.py vuln-finder
python3 scripts/validate_skill.py vuldb-report
```

Rebuild packages:

```sh
bash scripts/package_skill.sh vuln-finder
bash scripts/package_skill.sh vuldb-report
```

Run the stable `vuln-finder` golden eval:

```sh
python3 vuln-finder/scripts/check_output.py --eval-id 26 --output vuln-finder/evals/golden/invalid-flags.md
```

Run stable `vuldb-report` golden evals:

```sh
python3 vuldb-report/scripts/check_output.py --eval-id 4 --output vuldb-report/evals/golden/blocked-handoff.md
python3 vuldb-report/scripts/check_output.py --eval-id 5 --output vuldb-report/evals/golden/osv-prototype-pollution.json
python3 vuldb-report/scripts/check_output.py --eval-id 7 --output vuldb-report/evals/golden/duplicate-cna-warning.md
```

Run release checks:

```sh
python3 scripts/release_check.py
python3 scripts/release_check.py --write-artifacts
```

Packages should contain root-level `SKILL.md` plus the skill's `references/`, `scripts/`, and `evals/` directories when present. They should not contain nested skill directory entries such as `vuln-finder/` or `vuldb-report/`.

## Design Notes

Keep each `SKILL.md` concise. Put ecosystem-specific guidance, vulnerability matrices, scoring details, examples, and output contracts in `references/` so the agent can load only what the current request needs.

When adding new ecosystems or vulnerability classes, update the relevant reference file and add at least one eval scenario. Prefer deterministic script checks for repetitive behavior instead of expanding the main prompt.
