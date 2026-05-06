# Roadmap 0.8

`v0.7.1` stabilized the Evidence.v1 workflow, npm packaging, Chinese documentation, and the evidence/submission score split. `v0.8` should focus on making local reproduction and report readiness harder to misuse.

## Theme

Make the CLI answer one question clearly:

> What exact work remains before this finding can become a responsible disclosure report?

## Planned Work

### 1. `omv repro init <id>`

Create a standard reproduction artifact directory:

```sh
omv repro init <id>
```

Expected output:

```text
.omv/repro/<id>/
  README.md
  commands.sh
  observed.txt
  docker-compose.yml
  screenshots/
```

Acceptance criteria:

- Creates the directory idempotently.
- Does not overwrite non-empty user files unless `--force` is passed.
- Adds suggested `evidence.repro_artifacts` paths to the finding or prints a patch users can apply.
- Works for active findings only by default.

### 2. `omv findings doctor <id>`

Explain why a finding is not submission-ready:

```sh
omv findings doctor <id>
```

Expected checks:

- evidence score vs submission score
- unknown confirmed-required fields
- unresolved blockers
- missing local observations
- missing or stale reproduction artifacts
- suspicious CVSS choices, such as `PR:N` with admin-only source evidence
- guard text indicating a default mitigation blocks the exploit path

Acceptance criteria:

- Output is deterministic and actionable.
- JSON mode is available for CI or future UI use.
- It never suggests `/omv-report` unless the same finding would pass promotion and validation gates.

### 3. `omv report artifacts <id>`

Check report and reproduction material before archiving:

```sh
omv report artifacts <id>
```

Expected checks:

- `.omv/reports/<id>/` exists
- `.omv/repro/<id>/` exists when `evidence.repro_artifacts` are listed
- report files are non-empty
- artifact paths referenced from Evidence.v1 exist

Acceptance criteria:

- `omv findings archive <id> --reason reported --strict` can reuse the same artifact checks.
- Missing artifacts produce warnings for candidate findings and errors for strict confirmed archive.

### 4. Better Dashboard Detail

Improve `omv dashboard` without turning it into a full-screen app:

- show `verdict.exploitability`
- show top blocking reason when submission score is low
- show full next action below the table when truncated
- add `--json` fields for `evidenceScore`, `submissionScore`, `verdict`, and `blockers`

Acceptance criteria:

- Existing table remains compact.
- The first screen tells users whether to audit, reproduce, report, or archive.
- Long command truncation never hides the only actionable next step.

### 5. Documentation And Demo Assets

Add sanitized examples:

- `docs/examples/demo-finding-flow.md`
- one candidate example
- one blocked example
- one confirmed example with fake package names

Acceptance criteria:

- No private `.omv/` state committed.
- Examples pass manual Evidence.v1 validation if copied into `.omv/findings/`.
- The examples illustrate evidence score vs submission score.

## Non-Goals

- Do not build a full interactive TUI yet.
- Do not publish GitHub Packages as a second registry unless there is real user demand.
- Do not add live target scanning.
- Do not weaken the passive research boundary.

## Release Gate

Before `v0.8.0`:

```sh
npm run release:check
npm pack --dry-run
npx -p oh-my-vul omv version
```

The release should include at least one new deterministic test per new command.
