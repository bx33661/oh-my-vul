# Preflight Issues Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Fix the four preflight issues identified in the repository review: private workspace defaults, report-readiness consistency, clean/reproducible package builds, and dashboard renderer drift.

**Architecture:** Preserve the existing domain modules and command split. Add behavior-level regressions first, then make the smallest changes needed so privacy policy, readiness policy, package contents, and human rendering each have one effective implementation.

**Tech Stack:** TypeScript 6, Node.js built-in test runner, Python release checks, npm packaging, YAML fixtures.

**Status (2026-07-10):** Implemented on mainline. All four tasks are done:

1. `workspace.ts` uses a single `.omv/` gitignore entry.
2. `workflow.ts` gates report recommendations on `submissionScore >= 75` via `isSubmissionScoreReady` / `isReportReady`.
3. `package.json` clean build + `dist/cli/commands/*` pack patterns; `check_npm_pack.py` rejects stale/missing modules.
4. `commands/dashboard.ts` routes through `printDashboard` from `render.ts`.

Do not re-implement from this plan unless a regression reopens one of the items.

---

### Task 1: Make `.omv/` private by default in gitignore guidance

**Files:**
- Modify: `src/cli/workspace.ts`
- Test: `src/cli/__tests__/workspace.test.ts`

- [x] **Step 1: Write failing privacy tests**

Add tests that establish these behaviors:

```ts
test("workspace init --gitignore ignores the entire private .omv directory", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));
  try {
    await writeFile(join(projectRoot, ".gitignore"), "", "utf-8");
    const result = await initWorkspace(projectRoot, { gitignore: true });
    assert.equal(await readFile(join(projectRoot, ".gitignore"), "utf-8"), ".omv/\n");
    assert.equal(result.warnings.some((warning) => warning.includes("add .omv/")), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workspace init --gitignore creates a missing gitignore", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));
  try {
    await initWorkspace(projectRoot, { gitignore: true });
    assert.equal(await readFile(join(projectRoot, ".gitignore"), "utf-8"), ".omv/\n");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
```

Also assert that non-mutating advice recommends `.omv/` and never says to keep `.omv/findings/` tracked.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```sh
npm run build
node --test dist/cli/__tests__/workspace.test.js
```

Expected: FAIL because the current implementation appends only `.omv/repro/`, `.omv/reports/`, and `.omv/archive/`, and does not create a missing `.gitignore`.

- [x] **Step 3: Implement the minimal privacy fix**

Change gitignore advice to use `.omv/` as the single private-state entry. When `gitignore: true`, create or append the entry idempotently. Compute the returned workspace warnings after this mutation so a successful auto-add does not return a stale privacy warning.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the same focused test. Expected: all workspace tests pass.

### Task 2: Use submission readiness in every report recommendation

**Files:**
- Modify: `src/cli/workflow.ts`
- Test: `src/cli/__tests__/findings.test.ts`

- [x] **Step 1: Write a failing workflow regression**

Create a confirmed fixture with valid structural evidence but low submission confidence:

```ts
const lowConfidence = BASE_FINDING
  .replace("status: candidate", "status: confirmed")
  + `verdict:\n  exploitability: plausible\n  confidence: low\n  reason: incomplete confidence\n`;
```

Assert `validation.ok === true`, `validation.submissionScore < 75`, `nextAction !== "/omv-report low-confidence"`, and `priority < 100`.

- [x] **Step 2: Run the focused test and verify RED**

Run:

```sh
npm run build
node --test dist/cli/__tests__/findings.test.js
```

Expected: FAIL because `workflowNextAction()` and `workflowPriority()` currently treat every structurally valid confirmed finding as report-ready.

- [x] **Step 3: Implement the minimal readiness fix**

Require all three conditions before recommending a report or assigning priority 100:

```ts
finding.status === "confirmed"
  && validation.ok
  && finding.submissionScore >= 75
```

Do not change score weights or the default/non-strict review policy.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the same focused test. Expected: all findings tests pass.

### Task 3: Make builds clean and npm packages complete and exact

**Files:**
- Modify: `package.json`
- Modify: `scripts/check_npm_pack.py`

- [x] **Step 1: Strengthen the package checker first**

Before changing build/package configuration, make `check_npm_pack.py` fail when:

- `dist/cli/commands/index.js` and the other compiled command modules are absent;
- a top-level compiled module exists under `dist/cli/` without a matching `src/cli/*.ts` source, such as stale `dist/cli/plan.js`;
- `dist/cli/__tests__/` is packaged.

Derive expected command modules from `src/cli/commands/*.ts` instead of maintaining another static command list.

- [x] **Step 2: Run the package check and verify RED**

Run:

```sh
npm run pack:check
```

Expected: FAIL because command modules are not currently packaged and the local `dist/cli/plan.*` stale output is included.

- [x] **Step 3: Implement clean build and complete package patterns**

Add a cross-platform `clean` npm script using Node `fs.rmSync("dist", { recursive: true, force: true })`, and invoke it before `tsc` in `build`.

Extend `package.json#files` with the four command-module patterns:

```json
"dist/cli/commands/*.d.ts",
"dist/cli/commands/*.d.ts.map",
"dist/cli/commands/*.js",
"dist/cli/commands/*.js.map"
```

Keep compiled tests excluded.

- [x] **Step 4: Verify GREEN and executable package entrypoints**

Run:

```sh
npm run build
npm run pack:check
node dist/cli/omv.js version --json
```

Expected: stale plan artifacts are gone, all command modules are present in the dry-run tarball, no tests are packaged, and the CLI entrypoint starts successfully.

### Task 4: Route dashboard output through the canonical renderer

**Files:**
- Modify: `src/cli/commands/dashboard.ts`
- Test: `src/cli/__tests__/commands.test.ts`

- [x] **Step 1: Add a failing command-level dashboard test**

Spawn the compiled CLI in a temporary project with one Evidence.v1 fixture and assert that human dashboard output contains the canonical columns `verdict` and `blocker`. Use `spawnSync(process.execPath, [cliPath, "dashboard"], { cwd: projectRoot, encoding: "utf-8" })` so the test does not change the test runner's global working directory.

- [x] **Step 2: Run the command test and verify RED**

Run:

```sh
npm run build
node --test dist/cli/__tests__/commands.test.js
```

Expected: FAIL because `commands/dashboard.ts` uses its own older five-column renderer.

- [x] **Step 3: Use the canonical renderer**

Import `printDashboard` from `../render.js`, delete the local duplicate renderer, and remove the now-unused TUI imports. Do not change JSON output.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the same focused test. Expected: PASS.

### Task 5: Full verification and self-review

**Files:**
- Review all files changed above

- [x] **Step 1: Run static and full release checks**

```sh
npm run typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run release:check
```

Expected: all commands exit zero. If pre-existing unused-code failures outside the touched files remain, do not broaden scope silently; report them separately.

- [x] **Step 2: Check repository state**

```sh
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors, no generated `dist` files tracked, and only scoped source/test/plan changes.

- [x] **Step 3: Self-review**

Confirm each of the four original failures has a regression test, no score policy changed, `.omv/` remains opt-in to automatic `.gitignore` modification through `--gitignore`, command JSON shapes are unchanged, and no unrelated refactor was introduced.

Do not commit; return the working-tree changes to the controller for independent review.
