# Demo Finding Flow

This document shows a sanitized end-to-end `oh-my-vul` workflow. It is a documentation example only; do not treat the package, paths, or vulnerability details below as a real advisory.

## Goal

Demonstrate how a candidate moves through:

```text
/omv-find
  -> .omv/findings/<id>.yaml
  -> /omv-audit
  -> /omv-repro
  -> omv findings validate <id>
  -> /omv-report <id>
```

The important part is not the specific vulnerability class. The important part is how evidence is promoted from a hypothesis into a reportable finding.

## 1. Find Candidates

Start with a narrow scope:

```text
/omv-find --lang go --vuln ssrf --count 8 webhook
```

Good candidates should include:

- repository and registry identity
- maintenance and version signals
- code-reading entry points
- source -> sink -> guard notes
- uncertainty called out explicitly

Do not create a confirmed finding from `/omv-find` output alone. Finder output is a triage starting point.

## 2. Create Evidence

Create a project-local Evidence.v1 file:

```sh
omv findings init go-demo-ssrf
omv findings show go-demo-ssrf
```

The file lives under:

```text
.omv/findings/go-demo-ssrf.yaml
```

`.omv/` is local research state and should not be committed unless you are deliberately publishing sanitized examples.

## 3. Audit Source -> Sink -> Guard

Run:

```text
/omv-audit go-demo-ssrf
```

The audit should answer:

| Evidence | Question |
|---|---|
| `evidence.source` | What attacker-controlled input enters the system? |
| `evidence.sink` | What dangerous operation does that input reach? |
| `evidence.guard` | What check is missing, weak, or bypassable? |
| `evidence.reproducer` | How can a reviewer reproduce this locally? |
| `verdict` | Is exploitability proven, plausible, blocked, or disproven? |

If the default configuration blocks the exploit path, keep the finding as `candidate` or `blocked`. Do not report a vulnerability just because an unsafe sink exists.

## 4. Understand The Scores

After audit, inspect the dashboard:

```sh
omv dashboard
```

Example output shape:

```text
id            status      evidence           submission         next action
go-demo-ssrf  candidate   ████████░░ 80/100  ███░░░░░░░ 30/100 /omv-audit go-demo-ssrf
```

Interpretation:

- **evidence score** means fields are filled.
- **submission score** means the finding is close to reportable.
- A high evidence score with a low submission score usually means unresolved blockers, missing local observations, weak version boundaries, or unproven exploitability.

## 5. Reproduce Locally

If the only missing piece is a local observation, run:

```text
/omv-repro go-demo-ssrf
```

Recommended artifact layout:

```text
.omv/repro/go-demo-ssrf/
  README.md
  commands.sh
  observed.txt
  docker-compose.yml
  screenshots/
```

Record artifact paths in Evidence.v1:

```yaml
evidence:
  repro_artifacts:
    - .omv/repro/go-demo-ssrf/commands.sh
    - .omv/repro/go-demo-ssrf/observed.txt
```

Only write `evidence.observed_result` from actual local output reported by the researcher. Do not infer it from the reproducer text.

## 6. Validate Before Reporting

Run:

```sh
omv findings validate go-demo-ssrf
omv findings workflow
```

If validation returns warnings such as these, do not submit yet:

```text
evidence.observed_result is unknown; local reproduction is not complete
versions.affected_range is unknown; affected version boundary is not established
evidence.guard says a default mitigation blocks part of the exploit path
```

Resolve the blocker, or mark the finding blocked:

```sh
omv findings promote go-demo-ssrf --status blocked
omv findings archive go-demo-ssrf --reason blocked
```

## 7. Report Only Confirmed Findings

When the finding is confirmed and validation passes:

```text
/omv-report go-demo-ssrf
```

Then archive the completed item:

```sh
omv findings archive go-demo-ssrf --reason reported
```

For stricter local process, require report artifacts:

```sh
omv findings archive go-demo-ssrf --reason reported --strict
```

## Quality Bar

A submission-ready finding should have:

- concrete tested version
- exact package identity and repository URL
- source -> sink -> guard with file references
- local reproducer
- observed result from a real local run
- dedup search results
- CVSS vector that matches the actual preconditions
- `verdict.exploitability: proven`
- no unresolved blockers

If any of these are missing, keep the finding out of the submission path.
