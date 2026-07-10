# Source Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SourceRef sidecars and hash-based report provenance with backward-compatible freshness checks.

**Architecture:** Keep SourceRef and report provenance in separate domain modules. SourceRef is hand-editable YAML tied to Evidence bytes; the generated JSON report manifest hashes Evidence, reports, and optional local dependencies. Existing report artifact checks consume manifest validation additively.

**Tech Stack:** TypeScript 6, Node 20 filesystem/crypto APIs, `yaml`, Node test runner, OpenSpec.

---

## File Structure

- `contracts/source-ref.v1.yaml`: documented SourceRef shape.
- `contracts/report-provenance.v1.yaml`: documented generated manifest shape.
- `src/cli/source-ref.ts`: SourceRef construction, parsing, persistence, and freshness.
- `src/cli/report-provenance.ts`: manifest generation, parsing, dependency hashing, and freshness.
- `src/cli/commands/sources.ts`: source command routing only.
- `src/cli/commands/report.ts`: add provenance routing without formatting logic.
- `src/cli/__tests__/source-ref.test.ts`: domain and filesystem behavior.
- `src/cli/__tests__/report-provenance.test.ts`: manifest and artifact integration behavior.

### Task 1: Paths, Contracts, and Workspace

- [ ] **Step 1: Write failing workspace/path tests**

Add assertions equivalent to:

```ts
assert.equal(sourcesDir(root), join(root, ".omv", "sources"));
await initWorkspace(root);
assert.equal((await stat(sourcesDir(root))).isDirectory(), true);
```

- [ ] **Step 2: Verify RED**

Run `npm run build && node --test dist/cli/__tests__/workspace.test.js` and confirm missing exports/directories fail.

- [ ] **Step 3: Add contract files and path helpers**

Implement `sourcesDir()`, `sourceRefPath()`, and `reportProvenancePath()` in `src/cli/paths.ts`; call `mkdir(sourcesDir(...), {recursive:true})` from workspace initialization. Add both contracts to `contracts/README.md` and npm pack assertions.

- [ ] **Step 4: Verify GREEN**

Run the same focused test and `npm run typecheck`.

### Task 2: SourceRef Domain

- [ ] **Step 1: Write failing SourceRef tests**

Cover known repository derivation, empty sources with warnings, unknown-key rejection, invalid hashes/timestamps, filename mismatch, `--force` protection, and stale Evidence:

```ts
const result = await initSourceRef("demo", root);
assert.equal(result.sourceRef.finding_id, "demo");
assert.equal(result.sourceRef.finding_sha256, await sha256File(findingPath));
assert.equal((await validateSourceRef("demo", root)).stale, false);
```

- [ ] **Step 2: Verify RED**

Run `npm run build && node --test dist/cli/__tests__/source-ref.test.js`; failure must be missing SourceRef behavior.

- [ ] **Step 3: Implement the minimal public API**

```ts
export async function initSourceRef(target: string, projectRoot = process.cwd(), options = {}): Promise<SourceRefInitResult>;
export async function showSourceRef(target: string, projectRoot = process.cwd()): Promise<SourceRefDetail>;
export async function validateSourceRef(target: string, projectRoot = process.cwd()): Promise<SourceRefValidation>;
```

Use closed key sets, `parseYaml`, existing `sha256File`, exclusive writes, safe ids, and current Evidence package fields only.

- [ ] **Step 4: Verify GREEN and refactor names**

Run the focused test until all cases pass, then rerun `npm run typecheck`.

### Task 3: Report Provenance

- [ ] **Step 1: Write failing manifest tests**

Create a report file and optional sidecars/repro files. Assert deterministic roles, SHA-256 values, project-relative paths, existing-manifest protection, force replacement, and manifest exclusion from report artifact counts.

- [ ] **Step 2: Verify RED**

Run `npm run build && node --test dist/cli/__tests__/report-provenance.test.js`.

- [ ] **Step 3: Implement generation and validation**

```ts
export async function createReportProvenance(id: string, projectRoot = process.cwd(), options = {}): Promise<ReportProvenanceResult>;
export async function validateReportProvenance(id: string, projectRoot = process.cwd()): Promise<ReportProvenanceValidation>;
```

Hash required Evidence and each non-empty report; add optional SourceRef, ThreatMap, Verification, and existing declared repro files. Reject manifest-only report directories. Write sorted, two-space JSON plus newline.

- [ ] **Step 4: Integrate status-aware artifact freshness**

Extend `ReportArtifactsResult` additively. Missing manifest is always a warning. Malformed/stale dependencies are errors only when Evidence status is `confirmed`.

- [ ] **Step 5: Verify GREEN**

Run provenance and existing findings tests together.

### Task 4: CLI, Renderers, and Public API

- [ ] **Step 1: Add failing parser/process tests**

Cover `sources init|show|validate`, `report provenance`, JSON purity, help, force restrictions, and positional arity.

- [ ] **Step 2: Verify RED**

Run `npm run build && node --test dist/cli/__tests__/args.test.js dist/cli/__tests__/commands.test.js`.

- [ ] **Step 3: Implement thin adapters**

Register `sources`; extend report routing; add canonical renderer functions and usage text; export domain/path types from `src/index.ts`.

- [ ] **Step 4: Verify GREEN**

Run focused tests and confirm JSON stdout parses as one document.

### Task 5: Docs and Release Gate

- [ ] Update `skills/omv/SKILL.md`, `skills/omv-report/SKILL.md`, README files, changelog, registry, and package checks; run `npm run sync-assets` and `npm run sync-metadata`.
- [ ] Run `npm run release:check`, `openspec validate add-source-provenance --strict`, and `git diff --check`.
- [ ] Under an isolated HOME, run setup, doctor, SourceRef init/validate, report provenance creation, and report artifact validation through `dist/cli/omv.js`.

