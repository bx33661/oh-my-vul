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
omv dashboard
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

## Copyable Example States

The snippets below use fake package names and paths. To try one locally:

```sh
omv findings init demo-candidate --force
# Replace .omv/findings/demo-candidate.yaml with one snippet, then:
omv findings validate demo-candidate
omv review demo-candidate
```

### Candidate: Needs Local Reproduction

Expected shape: validation can pass, evidence score is partially complete, submission score remains low because local observation and version boundary are unresolved.

```yaml
schema_version: "1"
handoff_version: "1.0"
status: candidate
researcher_goal: VulDB
package:
  ecosystem: npm
  registry_name: demo-widget-renderer
  repository_url: https://github.com/example/demo-widget-renderer
  vendor: example
  product: demo-widget-renderer
versions:
  tested: "1.4.2"
  affected_range: unknown
  fixed: unknown
vulnerability:
  class: path traversal
  cwe: CWE-22
  affected_component: lib/files.js
  affected_function: renderFile
evidence:
  source: lib/server.js:18 req.query.template
  sink: lib/files.js:44 fs.readFileSync
  guard: missing path normalization before join
  reproducer: node repro.js ../package.json
  observed_result: unknown
  repro_artifacts: []
cvss:
  vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N
  score: 5.5
  severity: Medium
impact:
  attack_vector: Local
  authentication_required: unknown
  user_interaction_required: unknown
  scope_changed: unknown
  confidentiality: High
  integrity: unknown
  availability: unknown
dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none
  notes: "searched NVD, GHSA, npm advisories"
disclosure:
  vendor_contacted: false
  contact_date: unknown
  vendor_response: unknown
  planned_disclosure_date: unknown
blockers: []
verdict:
  exploitability: plausible
  confidence: medium
  reason: source and sink are connected, but local output has not been observed yet
provenance:
  verification_date: "2026-05-08"
  researcher: demo
  unverified_fields:
    - versions.affected_range
    - versions.fixed
    - evidence.observed_result
    - disclosure.contact_date
    - disclosure.vendor_response
    - disclosure.planned_disclosure_date
  tool_versions: {}
```

### Blocked: Default Guard Prevents Exploit

Expected shape: validation passes only as `blocked`, submission score is zero, and the next action is archive or return to audit if the conclusion changes.

```yaml
schema_version: "1"
handoff_version: "1.0"
status: blocked
researcher_goal: triage
package:
  ecosystem: go
  registry_name: github.com/example/demo-webhook
  repository_url: https://github.com/example/demo-webhook
  vendor: example
  product: demo-webhook
versions:
  tested: "0.8.0"
  affected_range: unknown
  fixed: unknown
vulnerability:
  class: server-side request forgery
  cwe: CWE-918
  affected_component: internal/webhook/client.go
  affected_function: Send
evidence:
  source: internal/webhook/handler.go:31 request URL
  sink: internal/webhook/client.go:87 http.Client.Do
  guard: internal/webhook/client.go:63 default allowlist blocks private IP ranges
  reproducer: none
  observed_result: unknown
  repro_artifacts: []
cvss:
  vector: unknown
  score: unknown
  severity: unknown
impact:
  attack_vector: Network
  authentication_required: unknown
  user_interaction_required: unknown
  scope_changed: unknown
  confidentiality: unknown
  integrity: unknown
  availability: unknown
dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none
  notes: "no matching advisory found"
disclosure:
  vendor_contacted: false
  contact_date: unknown
  vendor_response: unknown
  planned_disclosure_date: unknown
blockers:
  - default configuration blocks private network requests
  - no bypass found during source audit
verdict:
  exploitability: blocked
  confidence: high
  reason: sink exists, but the default guard prevents the attacker-controlled URL from reaching private hosts
provenance:
  verification_date: "2026-05-08"
  researcher: demo
  unverified_fields:
    - versions.affected_range
    - versions.fixed
    - evidence.reproducer
    - evidence.observed_result
    - cvss.vector
    - cvss.score
    - cvss.severity
    - impact.authentication_required
    - impact.user_interaction_required
    - impact.scope_changed
    - impact.confidentiality
    - impact.integrity
    - impact.availability
    - disclosure.contact_date
    - disclosure.vendor_response
    - disclosure.planned_disclosure_date
  tool_versions: {}
```

### Confirmed: Ready For Report Drafting

Expected shape: validation passes as `confirmed`, submission score is above 75, and `omv report artifacts confirmed-demo` should pass after a non-empty report file exists under `.omv/reports/confirmed-demo/`.

```yaml
schema_version: "1"
handoff_version: "1.0"
status: confirmed
researcher_goal: VulDB
package:
  ecosystem: python
  registry_name: demo-config-loader
  repository_url: https://github.com/example/demo-config-loader
  vendor: example
  product: demo-config-loader
versions:
  tested: "2.1.0"
  affected_range: "up to and including 2.1.0"
  fixed: none
vulnerability:
  class: YAML unsafe deserialization
  cwe: CWE-502
  affected_component: demo_config_loader/loader.py
  affected_function: load_config
evidence:
  source: demo_config_loader/cli.py:22 user-supplied config path
  sink: demo_config_loader/loader.py:41 yaml.load
  guard: missing SafeLoader use before yaml.load
  reproducer: python repro.py payload.yml
  observed_result: local run printed marker DEMO_OWNED from the crafted YAML constructor
  repro_artifacts:
    - .omv/repro/confirmed-demo/commands.sh
    - .omv/repro/confirmed-demo/observed.txt
cvss:
  vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H
  score: 7.8
  severity: High
impact:
  attack_vector: Local
  authentication_required: false
  user_interaction_required: true
  scope_changed: false
  confidentiality: High
  integrity: High
  availability: High
dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none
  notes: "searched NVD, GHSA, PyPI advisory database, and repository issues"
disclosure:
  vendor_contacted: false
  contact_date: unknown
  vendor_response: unknown
  planned_disclosure_date: unknown
blockers: []
verdict:
  exploitability: proven
  confidence: high
  reason: local reproducer executed the unsafe YAML constructor on version 2.1.0
provenance:
  verification_date: "2026-05-08"
  researcher: demo
  unverified_fields:
    - disclosure.contact_date
    - disclosure.vendor_response
    - disclosure.planned_disclosure_date
  tool_versions: {}
```
