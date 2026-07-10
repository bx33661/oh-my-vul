# Contributing

Thanks for helping improve `oh-my-vul`. This project is a Claude Code skill collection, so the most important contribution quality is reproducibility: installed skills, `.skill` archives, and source checkout behavior should all match.

By participating, you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

**Do not commit** local research state (`.omv/`), secrets, live target data, or unreleased vulnerability details. Use sanitized fixtures in issues and pull requests.

Accepted behavior specs live under [`openspec/specs/`](openspec/specs/). In-progress OpenSpec change drafts stay local (`openspec/changes/` is gitignored).

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
- Keep bundled skills, references, walkthroughs, and golden outputs methodology-first. Use sanitized `demo-*`, `example-*`, or `fixture-*` names for examples.
- Concrete real package names, CVEs, and advisory URLs are acceptable only when they are user-provided finding data, schema/format validation examples, or explicit primary-source research outputs with appropriate context.

## Pull Requests

Before opening a PR:

1. Run `npm run validate`.
2. Update docs when commands, outputs, contracts, or release behavior changes.
3. Update `CHANGELOG.md` for release-facing changes.
4. Explain whether skill output behavior changed.

## Creating a New Skill

Use this template to add a new skill to the collection.

### 1. Directory Structure

```
skills/omv-<name>/
  SKILL.md                    — skill definition (frontmatter name must match directory)
  references/                 — detailed guidance loaded on demand
    patterns/<ecosystem>.md   — ecosystem-specific patterns (if applicable)
  scripts/
    check_output.py           — heuristic eval checker
  evals/
    evals.json                — eval scenarios (minimum 3)
    golden/                   — stable golden outputs
  contracts/                  — copies of consumed contracts
```

### 2. SKILL.md Frontmatter

```yaml
---
name: omv-<name>
description: |
  One paragraph describing when to invoke this skill.
---
```

The `name` field MUST match the directory basename exactly.

### 3. Eval Requirements

Every skill needs at least 3 eval scenarios covering:

- **Happy path** — normal successful invocation
- **Edge case** — boundary condition or unusual input
- **Error/blocked path** — graceful handling of invalid or impossible requests

Each eval in `evals.json` must have:
- `id`: unique integer
- `prompt`: the invocation string
- `expected_output`: human-readable description
- `files`: list of golden output paths
- `assertions`: list of `{type, text}` pairs checked by `check_output.py`

### 4. check_output.py Template

```python
#!/usr/bin/env python3
"""Heuristic checker for omv-<name> eval outputs."""

from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path
from typing import Any

SKILL_DIR = Path(__file__).resolve().parents[1]

def load_eval(evals_path: Path, eval_id: int) -> dict[str, Any]:
    data = json.loads(evals_path.read_text(encoding="utf-8"))
    item = next((e for e in data["evals"] if e["id"] == eval_id), None)
    if item is None:
        raise SystemExit(f"unknown eval id: {eval_id}")
    return item

def check(assertion_type: str, text: str) -> bool:
    # Add assertion checks here
    raise SystemExit(f"unknown assertion type: {assertion_type}")

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--evals", type=Path, default=SKILL_DIR / "evals" / "evals.json")
    args = parser.parse_args()
    eval_item = load_eval(args.evals, args.eval_id)
    output = args.output.read_text(encoding="utf-8")
    failures = [
        a["type"] for a in eval_item.get("assertions", [])
        if not check(str(a["type"]), output)
    ]
    if failures:
        print("FAIL: " + ", ".join(failures), file=sys.stderr)
        raise SystemExit(1)
    print(f"OK: eval {args.eval_id} heuristic assertions passed")

if __name__ == "__main__":
    main()
```

### 5. Registration

After creating the skill:

1. Run `python3 scripts/validate_skill.py skills/omv-<name>` to verify structure.
2. Add the skill to `registry.yaml` with version, produces/consumes bindings.
3. Run `python3 scripts/sync_skill_assets.py` to sync shared references.
4. Run `npm test` to verify no regressions.

### 6. Pattern Registry (if applicable)

If your skill uses ecosystem-specific vulnerability patterns, add them to `shared/references/patterns/<ecosystem>.md` with this structure:

```markdown
## <Vuln Class>: <short description>

- Source pattern: ...
- Sink signature: ...
- Common misuse: ...
- Expected guard: ...
- Evidence criteria: ...
- False-positive checks: ...
- CWE: CWE-XXX
```

Currently supported ecosystems: npm, python, go, rust, java, ruby, php, csharp, swift, dart, elixir, perl.
