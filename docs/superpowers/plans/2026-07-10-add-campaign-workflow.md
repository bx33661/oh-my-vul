# Campaign Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative Campaign.v1 first-mile workflow with canonical `omv campaign` commands, `omv first` aliases, deterministic runbooks, and candidate-only finding seeding.

**Architecture:** A focused `src/cli/campaign.ts` domain module owns normalization, validation, persistence, runbooks, prompting contracts, and safe seeding. Thin parser/router/command adapters converge canonical and alias invocations, while `src/cli/render.ts` owns all human output. Campaign files are scanned directly under `.omv/campaigns/`; the finding index remains unchanged.

**Tech Stack:** TypeScript 6, Node.js 20 built-ins, `yaml`, Node test runner, Markdown/YAML contracts, Python stdlib release tooling.

**Working-tree note:** This branch already contains uncommitted in-scope preflight fixes. Preserve them, use diff checkpoints, and do not create partial commits unless the user explicitly requests commits.

---

## File Map

- Create `contracts/campaign.v1.yaml`: canonical annotated Campaign.v1 example and field semantics.
- Create `src/cli/campaign.ts`: Campaign types, normalization, validation, persistence, prompt resolution, runbook generation, and seeding.
- Create `src/cli/commands/campaign.ts`: canonical/alias invocation normalization, flag extraction, TTY prompt adapter, JSON routing.
- Create `src/cli/__tests__/campaign.test.ts`: domain, persistence, prompting, and seeding behavior.
- Modify `src/cli/paths.ts`: campaign directory/YAML/runbook path helpers.
- Modify `src/cli/workspace.ts`: create campaign directory only; do not index it.
- Modify `src/cli/findings.ts`: narrow typed initial values for candidate templates.
- Modify `src/cli/args.ts`: canonical and alias command grammar.
- Modify `src/cli/commands/index.ts`: register both top-level names to one adapter.
- Modify `src/cli/commands/shared.ts`: campaign value flags for positional extraction.
- Modify `src/cli/render.ts`: Campaign human output.
- Modify `src/cli/usage.ts`: Campaign/first help.
- Modify `src/index.ts`: public Campaign and path exports.
- Modify existing tests in `src/cli/__tests__/args.test.ts`, `workspace.test.ts`, `findings.test.ts`, `render.test.ts`, and `commands.test.ts`.
- Modify `skills/omv/SKILL.md`, `README.md`, `README.zh-CN.md`, `contracts/README.md`, `registry.yaml`, `skills/omv/references/registry.yaml`, `CHANGELOG.md`, and the historical design record.
- Modify `scripts/check_npm_pack.py`: require Campaign contract and compiled command assets.

## Task 1: Contract, Paths, and Workspace Storage

**Files:**

- Create: `contracts/campaign.v1.yaml`
- Modify: `src/cli/paths.ts`
- Modify: `src/cli/workspace.ts`
- Test: `src/cli/__tests__/workspace.test.ts`

- [ ] **Step 1: Write the failing workspace test**

Add imports for `campaignsDir`, `campaignPath`, and `campaignRunbookPath`, then extend the idempotency test with assertions equivalent to:

```ts
assert.equal(existsSync(campaignsDir(projectRoot)), true);
assert.equal(campaignPath("demo", projectRoot), join(projectRoot, ".omv", "campaigns", "demo.yaml"));
assert.equal(campaignRunbookPath("demo", projectRoot), join(projectRoot, ".omv", "campaigns", "demo.md"));

await writeFile(campaignPath("demo", projectRoot), "schema_version: \"1\"\n", "utf-8");
await writeFile(campaignRunbookPath("demo", projectRoot), "# Demo\n", "utf-8");
await initWorkspace(projectRoot);
assert.equal(await readFile(campaignRunbookPath("demo", projectRoot), "utf-8"), "# Demo\n");
assert.equal((await readWorkspaceIndex(projectRoot)).findings.some((entry) => entry.id === "demo"), false);
```

- [ ] **Step 2: Run RED**

Run `npm run build`.

Expected: TypeScript fails because the three campaign path helpers do not exist.

- [ ] **Step 3: Add the path helpers and workspace directory**

Add this ownership to `paths.ts`:

```ts
export function campaignsDir(projectRoot = process.cwd()): string;
export function campaignPath(id: string, projectRoot = process.cwd()): string;
export function campaignRunbookPath(id: string, projectRoot = process.cwd()): string;
```

Import `campaignsDir` in `workspace.ts` and create it in `ensureWorkspaceDirs()`. Do not add fields to `WorkspaceIndex` or `WorkspaceStatus`.

- [ ] **Step 4: Add the annotated Campaign contract**

Write the exact v1 shape from the OpenSpec design, including comments for supported modes, goals, depths, local-reproduction values, supported Evidence ecosystems plus `unknown`, safe default boundaries, class normalization, and lane/finding-id derivation.

- [ ] **Step 5: Verify GREEN**

Run `npm run build`, then `node --test dist/cli/__tests__/workspace.test.js`.

Expected: build succeeds and all workspace tests pass.

- [ ] **Step 6: Mark OpenSpec tasks 1.1 through 1.3 complete**

Change their checkboxes in `openspec/changes/add-campaign-workflow/tasks.md` immediately after the focused test passes.

## Task 2: Campaign Domain, Persistence, and Prompt Resolution

**Files:**

- Create: `src/cli/campaign.ts`
- Create: `src/cli/__tests__/campaign.test.ts`

- [ ] **Step 1: Write failing construction and validation tests**

The tests must use a fixed timestamp and assert the complete object, including these public interfaces and values:

```ts
const campaign = buildCampaign({
  target: " Acme ",
  version: " 1.2 ",
  vulnerabilities: [" XSS ", "auth z", "xss"],
}, () => new Date("2026-07-10T00:00:00.000Z"));

assert.equal(campaign.id, "acme-1-2");
assert.equal(campaign.profile, "generic");
assert.deepEqual(campaign.priorities.vulnerability_classes, ["xss", "auth-z"]);
assert.deepEqual(campaign.lanes.map((lane) => lane.finding_id), [
  "acme-1-2-xss",
  "acme-1-2-auth-z",
]);
assert.equal(campaign.scope.mode, "passive");
assert.equal(campaign.goal.output, "research-notes");
assert.equal(campaign.budget.depth, "standard");
assert.equal(campaign.target.ecosystem, "unknown");
```

Also test empty target, empty/unsluggable class lists, unsafe explicit ids, unsupported enums, malformed YAML, mismatched lanes, duplicate finding ids, and invalid timestamps.

- [ ] **Step 2: Run RED**

Run `npm run build`.

Expected: TypeScript fails because `../campaign.js` and its exports do not exist.

- [ ] **Step 3: Implement types and pure construction**

Define discriminated string unions for mode, goal, depth, local reproduction, status, and supported ecosystem. Define these main shapes:

```ts
export interface Campaign { /* exact OpenSpec design shape */ }
export interface CampaignInput {
  id?: string;
  target?: string;
  version?: string;
  source?: string;
  ecosystem?: string;
  mode?: CampaignMode;
  output?: CampaignOutput;
  depth?: CampaignDepth;
  vulnerabilities?: string[];
  localReproduction?: CampaignLocalReproduction;
}
export interface CampaignPromptAdapter {
  askTarget(): Promise<string>;
  askVulnerabilities(): Promise<string>;
}
```

Implement and export `normalizeCampaignId`, `normalizeVulnerabilityClasses`, `buildCampaign`, `validateCampaign`, `parseCampaignYaml`, and `renderCampaignRunbook`. Keep runbook sections limited to target facts, boundaries, lanes, candidate wording, and concrete OMV next commands.

- [ ] **Step 4: Verify pure-domain GREEN**

Run `npm run build`, then `node --test --test-name-pattern="Campaign construction|Campaign validation|Campaign runbook" dist/cli/__tests__/campaign.test.js`.

Expected: selected tests pass.

- [ ] **Step 5: Write failing persistence tests**

Cover:

```ts
await initCampaign(input, { projectRoot, now: fixedNow });
await assert.rejects(() => initCampaign(input, { projectRoot, now: fixedNow }), /already exists/);
await initCampaign(changedInput, { projectRoot, now: fixedNow, force: true });
assert.deepEqual((await listCampaigns(projectRoot)).map((item) => item.id), ["a", "b"]);
assert.deepEqual(await listCampaigns(missingRoot), []);
assert.equal((await showCampaign("a", projectRoot)).campaign.id, "a");
```

Record `index.json` bytes before campaign list/show and assert they are unchanged afterward.

- [ ] **Step 6: Implement persistence**

Implement `initCampaign`, `listCampaigns`, `showCampaign`, and result/summary types. Check both YAML and Markdown paths before init; write both only after validation. List only `.yaml`/`.yml` files, validate each, sort by id, and never call workspace-index helpers.

- [ ] **Step 7: Write failing prompt tests**

Use a recording adapter and assert:

```ts
const completed = await resolveCampaignInput({}, { interactive: true, prompt });
assert.deepEqual(prompt.calls, ["target", "vulnerabilities"]);
await assert.rejects(
  () => resolveCampaignInput({}, { interactive: false, prompt }),
  /target.*vulnerability/i,
);
assert.deepEqual(prompt.calls, []);
```

Test supplied target only, supplied vulnerabilities only, blank prompt responses, and comma splitting.

- [ ] **Step 8: Implement prompt resolution**

`resolveCampaignInput` may ask only for missing required values. Optional fields use safe defaults. It must call no adapter method when `interactive` is false.

- [ ] **Step 9: Verify all Campaign domain tests**

Run `npm run build`, then `node --test dist/cli/__tests__/campaign.test.js`.

Expected: domain, persistence, missing-directory, and prompt tests all pass.

- [ ] **Step 10: Mark OpenSpec tasks 2.1 through 2.6 complete**

Update the six checkboxes immediately.

## Task 3: Typed Candidate Templates and Safe Seeding

**Files:**

- Modify: `src/cli/findings.ts`
- Modify: `src/cli/campaign.ts`
- Test: `src/cli/__tests__/findings.test.ts`
- Test: `src/cli/__tests__/campaign.test.ts`

- [ ] **Step 1: Write the failing typed-template test**

Call `createFindingTemplate` with a narrow seed object:

```ts
await createFindingTemplate("demo-xss", {
  projectRoot,
  seed: {
    researcherGoal: "triage",
    product: "Acme",
    ecosystem: "npm",
    vulnerabilityClass: "xss",
  },
});
```

Parse the YAML and assert `status === "candidate"`, target identity is present, `versions.tested === "unknown"`, source/sink/guard/reproducer/observed result are `unknown`, all unknown accounting fields are listed, and neither `campaign_id` nor proof artifacts exist.

- [ ] **Step 2: Run RED**

Run `npm run build`.

Expected: TypeScript rejects the unknown `seed` option.

- [ ] **Step 3: Implement the narrow template extension**

Add a typed `FindingTemplateSeed` to `CreateFindingTemplateOptions`. Keep ordinary finding initialization byte-compatible with the commented contract template; only seed mode parses the canonical YAML, applies allowed identity fields and explicit unknowns, then serializes it with `yaml.stringify`.

- [ ] **Step 4: Verify template GREEN**

Run `npm run build`, then `node --test --test-name-pattern="campaign seed values" dist/cli/__tests__/findings.test.js`.

Expected: selected finding test passes.

- [ ] **Step 5: Write failing Campaign seed tests**

Create a two-lane campaign with a known ecosystem. Assert first seed creates two valid candidate findings; second seed creates none and reports two skips. Pre-create one `.yml` finding and assert it is skipped byte-for-byte. Assert unknown ecosystem fails before any finding is written. Assert these paths remain absent for every lane:

```ts
threatMapPath(id, projectRoot);
findingReproDir(id, projectRoot);
verificationPath(id, projectRoot);
findingReportsDir(id, projectRoot);
```

- [ ] **Step 6: Run seed RED**

Run `npm run build`, then `node --test --test-name-pattern="Campaign seed" dist/cli/__tests__/campaign.test.js`.

Expected: tests fail because `seedCampaign` is missing.

- [ ] **Step 7: Implement idempotent seeding**

Prevalidate the Campaign and its ecosystem. Preflight every lane for duplicate ids and both `.yaml`/`.yml` existing paths. For each unoccupied lane call the typed finding initializer with exclusive creation and `force: false`. Return stable `created`, `skipped`, and `failed` arrays plus a finding-level next action. Catch per-lane I/O failures after validation so successful lanes remain visible and retries stay idempotent. Do not expose or pass a force option.

- [ ] **Step 8: Verify seeding GREEN**

Run `npm run build`, then run the complete Campaign and findings test files.

Expected: all selected tests pass and seeded findings validate as candidates.

- [ ] **Step 9: Mark OpenSpec tasks 3.1 through 3.4 complete**

Update the four checkboxes immediately.

## Task 4: CLI Grammar, Aliases, Command Adapter, and Renderers

**Files:**

- Create: `src/cli/commands/campaign.ts`
- Modify: `src/cli/args.ts`
- Modify: `src/cli/commands/index.ts`
- Modify: `src/cli/commands/shared.ts`
- Modify: `src/cli/render.ts`
- Modify: `src/cli/usage.ts`
- Test: `src/cli/__tests__/args.test.ts`
- Test: `src/cli/__tests__/render.test.ts`
- Test: `src/cli/__tests__/commands.test.ts`

- [ ] **Step 1: Write parser RED tests**

Add the full canonical/alias matrix from the OpenSpec task, including:

```ts
assert.equal(validateArgs(["campaign"]).ok, true);
assert.equal(validateArgs(["first", "--target", "acme", "--vuln", "xss", "--no-interactive"]).ok, true);
assert.equal(validateArgs(["first", "show", "demo", "--json"]).ok, true);
assert.equal(validateArgs(["campaign", "seed", "demo", "--force"]).ok, false);
assert.equal(validateArgs(["campaign", "init", "--mode", "live"]).ok, false);
assert.equal(validateArgs(["campaign", "show"]).ok, false);
```

- [ ] **Step 2: Run parser RED**

Run `npm run build`, then `node --test dist/cli/__tests__/args.test.js` if compilation succeeds.

Expected: new grammar assertions fail.

- [ ] **Step 3: Implement shared grammar**

Add one `validateCampaignArgs(args, aliasMode)` function. Canonical no-subcommand maps to list; `first` no-subcommand or leading flag maps to init. Validate mode, goal, budget, local-lab, and ecosystem enum values; treat target/version/source/vuln/id as valued options. Register `campaign` and `first` in the valid-command error string.

- [ ] **Step 4: Verify parser GREEN**

Run `npm run build`, then `node --test dist/cli/__tests__/args.test.js`.

- [ ] **Step 5: Write renderer and process RED tests**

Renderer tests capture output for init, list, show, and seed and assert stable headings, target/lane counts, created/skipped counts, paths, and next commands. Process tests run compiled commands in temporary project roots and assert:

- canonical non-interactive init writes both files;
- `first` produces the same normalized JSON shape;
- `campaign` defaults to list;
- show JSON is one parseable document;
- seed JSON is one parseable document and second invocation reports skips;
- `first --json` with missing values exits non-zero without prompt text;
- `help campaign`, `help first`, and unknown subcommands are actionable.

- [ ] **Step 6: Run process RED**

Run `npm run build`.

Expected: compilation or process tests fail because the command module, registry entries, renderers, and help are missing.

- [ ] **Step 7: Implement the thin command adapter**

Normalize raw invocations to one of `init|list|show|seed`. Extract options with shared helpers. Compute interactive mode as `!json && !noInteractive && Boolean(process.stdin.isTTY && process.stdout.isTTY)`. Create/close a Node readline interface only in that branch. Route JSON with exactly one `JSON.stringify` call and human results through exported canonical renderers.

- [ ] **Step 8: Register aliases and help**

Map both registry keys to the same `campaign.run`. Add top-level and detailed usage for canonical and alias forms, flags, defaults, and the explicit ecosystem prerequisite for seed.

- [ ] **Step 9: Verify CLI GREEN**

Run `npm run build`, then run args, render, commands, Campaign, and workspace tests.

Expected: all selected suites pass with no warnings or stray prompt output.

- [ ] **Step 10: Mark OpenSpec tasks 4.1 through 4.4 complete**

Update all four checkboxes immediately.

## Task 5: Public API, Pack Gate, Skill, and Documentation

**Files:**

- Modify: `src/index.ts`
- Modify: `scripts/check_npm_pack.py`
- Modify: `skills/omv/SKILL.md`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Modify: `contracts/README.md`
- Modify: `registry.yaml`
- Modify generated: `skills/omv/references/registry.yaml`
- Modify: `CHANGELOG.md`
- Modify: `docs/superpowers/specs/2026-07-08-omv-first-campaign-plan-design.md`

- [ ] **Step 1: Add public exports and pack requirements**

Export Campaign types, init/list/show/seed/validation helpers, and campaign paths from `src/index.ts`. Add `contracts/campaign.v1.yaml` and `dist/cli/commands/campaign.js` to required npm files while preserving the `.omv/` forbidden prefix.

- [ ] **Step 2: Run the pack-gate RED check before the contract is recognized**

Temporarily verify the new assertion catches a missing required path by running `python3 scripts/check_npm_pack.py` before the built output is refreshed, or remove only the generated Campaign output and run the check.

Expected: the checker names the missing Campaign asset. Restore/build immediately afterward; do not leave generated output deleted.

- [ ] **Step 3: Update manager guidance**

Add `/omv first`, `/omv campaign`, `show`, and `seed` delegation. State that Campaign files are private and that seeded findings are unproven candidates. Explicitly forbid manual Campaign/Evidence writes for delegated operations and forbid claims that seed performed an audit or reproduction.

- [ ] **Step 4: Update user and contract documentation**

Add Campaign before finding creation in English and Chinese quick workflows, document non-interactive examples and safe defaults, list `campaign.v1.yaml`, add a changelog entry, update manager registry description/contract binding, and mark the old Plan.v1 design as superseded by Campaign.v1. Do not reintroduce `.omv/plans`, notes, target profiles, or ThreatMap seeding.

- [ ] **Step 5: Sync generated assets**

Run `npm run sync-metadata`, then `npm run sync-assets`. Inspect the diff and ensure only expected metadata copies changed.

- [ ] **Step 6: Validate skill and package integration**

Run `python3 scripts/validate_skill.py`, `npm run build`, and `python3 scripts/check_npm_pack.py`.

Expected: every skill validates and the dry-run npm tarball contains both Campaign assets while excluding `.omv/`.

- [ ] **Step 7: Mark OpenSpec tasks 5.1 through 6.3 complete**

Update the five checkboxes immediately.

## Task 6: Release Verification and Reviews

**Files:**

- Modify only files required by discovered defects.
- Update `openspec/changes/add-campaign-workflow/tasks.md` after each verified gate.

- [ ] **Step 1: Run focused and full gates**

Run, separately and read each exit status:

```text
npm run typecheck
npm run build
npm test
openspec validate add-campaign-workflow --strict --json
git diff --check
```

Mark OpenSpec task 7.1 only after every command succeeds.

- [ ] **Step 2: Run release and independent tarball checks**

Run `npm run release:check`. Then run `npm pack --json --dry-run` independently and inspect the returned file list for `contracts/campaign.v1.yaml`, all compiled Campaign module variants, forbidden `.omv/`, Python caches, source tests, and stale compiled CLI files. Record file count and leak list. Mark task 7.2 only after both checks succeed.

- [ ] **Step 3: Run isolated installation smoke tests**

Create temporary HOME and project directories. Run the compiled CLI setup with `HOME` and `CLAUDE_HOME` pointing into the temp tree, then `doctor --json`. In the temp project run canonical init/list/show/seed and equivalent `first` aliases with `--json`; validate the seeded findings. Remove the temp directories afterward. Mark task 7.3 only on complete success.

- [ ] **Step 4: Obtain two-stage and final review**

Give a spec reviewer the complete Campaign requirements and diff. Resolve all missing/extra behavior, then re-review. Give a separate quality reviewer the approved diff and test evidence. Resolve Critical/Important findings, rerun affected gates, then request a final whole-change review. Mark task 7.4 only after all reviewers approve.

- [ ] **Step 5: Archive the OpenSpec change**

Confirm `openspec instructions apply --change add-campaign-workflow --json` reports every task complete. Archive with the repository's OpenSpec archive workflow, run strict validation again, and verify the main specs contain the Campaign requirements.

---

## Plan Self-Review

- Every Campaign workflow scenario maps to a test or documentation step above.
- No task introduces Plan.v1, `.omv/plans`, campaign notes, target-name branches, automatic proof artifacts, or an Evidence `campaign_id`.
- JSON non-interactivity and seed overwrite protection have parser, domain, and process-level coverage.
- Ecosystem `unknown` remains a valid Campaign default but blocks seed before writes, preserving Evidence.v1 validity.
- Public type names and field names match the OpenSpec design throughout the plan.
