# omv first Campaign Plan Design

Date: 2026-07-08
Status: proposed

## Summary

Add `omv first` as the first-mile workflow for a vulnerability research campaign. The command turns a user's high-level research goal into a scoped, machine-readable `Plan.v1` file and a human-readable Markdown runbook that Claude Code can follow.

The feature fills the gap between workspace setup and finding-level evidence. Today, `omv` manages `Evidence.v1`, `ThreatMap.v1`, `Verification.v1`, reports, and submissions, but it has no task-level object that records the research target, scope, expected output, attack surface, candidate lanes, and execution order.

## Goals

- Provide a guided starting point for users who know the target but need a structured research plan.
- Generate both machine-readable and human-readable campaign artifacts.
- Keep the first version conservative: plan generation first, optional seed finding creation second.
- Make the output directly usable by Claude Code as a one-stop campaign runbook.
- Preserve local-first safety boundaries: passive research, local validation, and no live third-party testing.

## Non-Goals

- Do not automatically audit code or execute PoCs.
- Do not automatically promote findings to `confirmed`.
- Do not replace `Evidence.v1`, `ThreatMap.v1`, or `Verification.v1`.
- Do not make `dashboard` depend on a plan existing.
- Do not create a large autonomous agent scheduler in the first version.

## User Experience

### Primary Interactive Flow

```sh
omv first
```

The command asks a short series of questions and then writes a campaign plan:

1. Target name, such as `Zimbra`, `npm package`, or `Java web app`.
2. Target version, code path, package path, repository URL, or install artifact.
3. Audit mode: `whitebox`, `graybox`, `local-lab`, `passive`, or `mixed`.
4. Expected output: `course-report`, `cve`, `vuldb`, `internal-report`, or `research-notes`.
5. Time budget: `quick`, `standard`, or `deep`.
6. Priority vulnerability classes, such as `xss`, `ssrf`, `authz`, `upload`, `parser`, `deser`, `xxe`, or `infoleak`.
7. Whether local reproduction will be available.

After completion, it prints the generated paths and the recommended next action:

```text
Created campaign plan: zimbra-latest-hunt
  .omv/plans/zimbra-latest-hunt.yaml
  .omv/plans/zimbra-latest-hunt.md
  .omv/notes/zimbra-latest-hunt.md

Next: review the runbook, then initialize seed findings with:
  omv first seed zimbra-latest-hunt
```

### Non-Interactive Flow

The command also accepts flags so future automation can skip prompts:

```sh
omv first \
  --target zimbra \
  --version 10.1.19 \
  --mode whitebox \
  --goal course-report \
  --budget standard \
  --vuln xss,authz,ssrf,parser \
  --local-lab yes
```

Missing required values fall back to prompts unless `--no-interactive` is set. With `--no-interactive`, missing required values fail fast with a clear error.

## Files

Campaign artifacts live under `.omv/plans/`:

```text
.omv/plans/<campaign-id>.yaml
.omv/plans/<campaign-id>.md
.omv/notes/<campaign-id>.md
```

The YAML file is the source of truth for CLI features. The Markdown file is the human and Claude Code runbook. The notes file is an append-friendly campaign notebook.

Add path helpers:

```text
plansDir(projectRoot)
planPath(id, projectRoot)
planRunbookPath(id, projectRoot)
```

`ensureWorkspaceDirs()` should create `.omv/plans/`.

## Plan.v1

Add `contracts/plan.v1.yaml` with this shape:

```yaml
schema: Plan.v1
id: zimbra-latest-hunt
title: Zimbra latest-version vulnerability hunt
created_at: "2026-07-08"
updated_at: "2026-07-08"
status: active

target:
  name: Zimbra
  version: "10.1.19"
  source:
    type: local-path
    value: /path/to/source-or-unpacked-artifact
  environment: local-lab

scope:
  mode: whitebox
  boundaries:
    - local lab only
    - no live third-party testing
  assumptions:
    - source review is the primary discovery method

goals:
  output: course-report
  success_criteria:
    - attack surface map completed
    - candidate findings recorded with evidence gaps
    - confirmed findings pass strict review before reporting

budget:
  depth: standard
  timebox: unknown

priorities:
  vulnerability_classes:
    - xss
    - authz
    - ssrf
    - parser

attack_surface:
  - id: web-client
    name: Web client rendering
    status: planned
    notes: Review user-controlled HTML, email body rendering, and sanitizer boundaries.

candidate_lanes:
  - id: zimbra-10119-classic-mail-render-xss
    title: Classic mail rendering XSS variant review
    vuln_class: xss
    attack_surface: web-client
    status: planned
    seed_finding: true

workflow:
  strict_verification: true
  steps:
    - omv findings init <id>
    - omv threat-map init <id>
    - /omv-audit <id>
    - omv repro init <id>
    - /omv-repro <id>
    - omv verification init <id>
    - omv review <id> --strict

agent_pipeline:
  - dataflow-tracer
  - guard-checker
  - dedup-analyst
  - verifier
  - omv-critic

documentation:
  outputs:
    - attack-surface.md
    - hunting-log.md
    - ai-assisted-hunting.md
```

`id`, `target.name`, `scope.mode`, `goals.output`, and `priorities.vulnerability_classes` are required. Unknown values should be explicit strings such as `unknown`, not omitted.

## Markdown Runbook

Generate `.omv/plans/<campaign-id>.md` from the YAML. It should include:

- Campaign scope and safety boundaries.
- Success criteria and stopping conditions.
- Attack surface checklist.
- Candidate lanes with suggested finding IDs.
- OMV execution flow for each lane.
- Suggested agent pipeline.
- Documentation outline for the final deliverable.
- A "Next Actions" section with concrete commands.

For the Zimbra example, the runbook should naturally include lanes like:

```text
zimbra-10119-classic-mail-render-xss
zimbra-10119-attachment-preview
zimbra-10119-admin-soap-authz
zimbra-10119-proxy-mailboxd-boundary
```

The generator should use generic defaults for unknown targets and stronger target-specific defaults only when the target name matches a known profile.

## Commands

### `omv first`

Create a new campaign plan. By default, prompts interactively.

Flags:

```text
--target <name>
--version <version>
--source <path-or-url>
--mode whitebox|graybox|local-lab|passive|mixed
--goal course-report|cve|vuldb|internal-report|research-notes
--budget quick|standard|deep
--vuln <comma-list>
--local-lab yes|no|unknown
--id <campaign-id>
--force
--json
--no-interactive
```

### `omv first list`

List campaign IDs, target names, statuses, and next actions.

### `omv first show <campaign-id>`

Show the campaign summary and paths. With `--json`, return the parsed `Plan.v1`.

### `omv first seed <campaign-id>`

Optional command that creates findings and threat maps for `candidate_lanes` where `seed_finding: true`.

It should be conservative:

- Create only planned seed findings from the plan.
- Keep seeded findings at `status: candidate`.
- Treat candidate lanes as hypotheses, not evidence; do not fabricate source, sink, guard, reproducer, or observed result values.
- Skip existing findings unless `--force` is provided.
- Initialize matching threat maps.
- Never run `/omv-audit`, `/omv-repro`, or verification automatically.

## Data Flow

```text
user answers / flags
  -> normalize campaign input
  -> derive campaign id
  -> build Plan.v1 object
  -> render Markdown runbook
  -> write .omv/plans/<id>.yaml
  -> write .omv/plans/<id>.md
  -> write .omv/notes/<id>.md
  -> append workspace activity
```

`omv first seed <id>` then reads the plan and delegates to the existing finding and threat-map initialization helpers.

## Safety and Error Handling

- Refuse unsupported audit modes with a validation error.
- Refuse invalid campaign IDs that cannot safely become filenames.
- If a campaign already exists, fail unless `--force` is set.
- If `--no-interactive` is set and required inputs are missing, fail instead of guessing.
- If target-specific defaults are unavailable, generate a generic plan instead of inventing facts.
- Seeded findings must preserve unknown evidence fields until `/omv-audit` or `/omv-repro` supplies real values.
- If seed finding creation partially succeeds, report created and skipped items separately.
- Keep campaign notes and reproduction artifacts local by default.

## Dashboard Integration

MVP does not require dashboard integration, but the YAML contract should make it easy later.

Future dashboard additions can show:

```text
active campaign
target
planned attack surfaces
seed findings created / planned
findings by status
next campaign action
```

## Testing

Add focused tests for:

- Argument validation for `omv first`, `first list`, `first show`, and `first seed`.
- Interactive fallback behavior through a testable prompt abstraction.
- Non-interactive missing required fields.
- Campaign ID normalization.
- YAML and Markdown file creation.
- `--force` overwrite behavior.
- Listing and showing multiple campaign plans.
- Seed creation skips existing findings by default.
- Seed creation initializes matching threat maps.
- JSON output stability.

Add at least one snapshot-like golden assertion for a Zimbra latest-version campaign runbook.

## Documentation Updates

Update:

- `README.md`: add `omv first` to the fast workflow before finding creation.
- `README.zh-CN.md`: add a short Chinese first-mile workflow.
- `contracts/README.md`: list `plan.v1.yaml`.
- `skills/omv/SKILL.md`: add `/omv first` delegation guidance.

## Rollout

Implement in two steps:

1. Plan generation: `omv first`, `first list`, `first show`, `Plan.v1`, and docs.
2. Seeding: `omv first seed <id>` and optional dashboard awareness.

This keeps the first release useful without making the system over-automated.
