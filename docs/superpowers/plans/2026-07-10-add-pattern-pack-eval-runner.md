# PatternPack and Eval Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all fourteen ecosystem pattern packs manifest-driven and expose existing eval checks through one human/JSON/JUnit runner and CLI command.

**Architecture:** Canonical per-ecosystem JSON manifests drive both methodology validation and skill-local asset copies. A Python runner reads a stable case manifest and invokes existing checkers; the TypeScript adapter only validates and forwards arguments.

**Tech Stack:** Python 3 stdlib, TypeScript 6, Node 20 child processes/test runner, JSON, JUnit XML.

---

## File Structure

- `scripts/pattern_packs.py`: strict manifest loader shared by dev scripts.
- `shared/pattern-packs/*.json`: fourteen canonical PatternPack manifests.
- `shared/references/patterns/{r,lua}.md`: missing method registries.
- `shared/evals/stable.json`: data-driven stable case registry.
- `shared/scripts/run_evals.py`: packaged unified runner.
- `src/cli/commands/eval.ts`: Python transport adapter.
- `src/cli/__tests__/eval.test.ts`: process coverage for output and exit semantics.

### Task 1: PatternPack Loader and Data

- [ ] **Step 1: Write failing loader tests**

Use temporary manifests to assert exactly fourteen supported ecosystems, safe relative references, closed keys, unique ids, valid consumer skill directories, and actionable invalid-field errors.

- [ ] **Step 2: Verify RED**

Run `python3 -m unittest scripts.test_pattern_packs` and confirm the missing loader fails.

- [ ] **Step 3: Implement loader and manifests**

Expose:

```py
def load_pattern_packs(root: Path = REPO_ROOT) -> list[dict[str, object]]: ...
def pattern_asset_mappings(root: Path = REPO_ROOT) -> list[tuple[Path, Path]]: ...
```

Add one JSON file per Evidence ecosystem with `schema_version`, `id`, `ecosystem`, `aliases`, `reference`, `vulnerability_classes`, and `consumers`.

- [ ] **Step 4: Add R/Lua references and verify GREEN**

Each Markdown entry must contain the seven methodology markers used by release validation. Run the loader tests.

### Task 2: Manifest-Driven Sync

- [ ] **Step 1: Add failing sync checks**

Assert mappings include both `references/patterns/<ecosystem>.md` and `references/pattern-packs/<ecosystem>.json` for every declared consumer, including R and Lua.

- [ ] **Step 2: Verify RED**

Run `python3 scripts/sync_skill_assets.py --check` and confirm missing generated targets are reported.

- [ ] **Step 3: Replace static pattern mappings**

Keep non-pattern `ASSET_MAPPINGS`; append `pattern_asset_mappings()` and use `load_pattern_packs()` in `release_check.py#validate_pattern_registry`.

- [ ] **Step 4: Generate and verify GREEN**

Run `python3 scripts/sync_skill_assets.py` followed by `--check` and `python3 scripts/validate_skill.py`.

### Task 3: Unified Eval Runner

- [ ] **Step 1: Write failing runner tests**

Test a passing checker, failing checker, unsafe path, targeted invocation, JSON parsing, and JUnit parsing with `xml.etree.ElementTree`.

- [ ] **Step 2: Verify RED**

Run `python3 -m unittest shared.scripts.test_run_evals` and confirm the missing runner fails.

- [ ] **Step 3: Implement result model and execution**

```py
@dataclass(frozen=True)
class EvalResult:
    id: str
    skill: str
    eval_id: int
    passed: bool
    duration_ms: int
    stdout: str
    stderr: str
```

Validate every path stays below package root, invoke checker scripts with `sys.executable`, and serialize one summary consistently across formats.

- [ ] **Step 4: Add stable manifest and release integration**

Move every existing stable case plus documented finder/report goldens into `shared/evals/stable.json`; replace `STABLE_EVAL_CHECKS` with one runner call.

- [ ] **Step 5: Verify GREEN**

Run the Python tests and `python3 shared/scripts/run_evals.py --format json`; assert zero failures.

### Task 4: `omv eval` Adapter

- [ ] **Step 1: Add failing argument/process tests**

Cover stable JSON, JUnit XML, full targeted options, incomplete triples, invalid ids, conflicting formats, and extra positionals.

- [ ] **Step 2: Verify RED**

Run `npm run build && node --test dist/cli/__tests__/args.test.js dist/cli/__tests__/eval.test.js`.

- [ ] **Step 3: Implement transport-only adapter**

Use `OMV_PYTHON || "python3"`, `packageRoot()`, and `spawnSync`; forward `--format` and targeted arguments, inherit stdout/stderr, and preserve non-zero status.

- [ ] **Step 4: Verify GREEN**

Run focused tests, typecheck, and direct `node dist/cli/omv.js eval --json` / `--junit` smoke checks.

### Task 5: Docs and Release Gate

- [ ] Update README files, DEVELOPMENT.md, changelog, manager/finder/audit guidance, npm assertions, and synced assets.
- [ ] Run `npm run release:check`, both OpenSpec strict validations, and `git diff --check`.
- [ ] Inspect `npm pack --json --dry-run` for runner/manifests and private/cache leaks; reinstall under isolated HOME and rerun `omv eval --json`.

