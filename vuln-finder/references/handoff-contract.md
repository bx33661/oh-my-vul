# Handoff Contract

Use this contract when a promising candidate is promoted from research target to confirmed vulnerability reporting.

`vuln-finder` may produce a handoff packet only after there is enough local evidence to support a concrete vulnerability hypothesis. If the issue is still only a target selection result, keep it in the ranked candidate table and do not call it confirmed.

## Handoff packet

```yaml
handoff_version: "0.3"
status: candidate | confirmed | blocked
researcher_goal: VulDB | CVE | GHSA | OSV | markdown-advisory | unknown
package:
  ecosystem: npm | pip | go | cargo | rubygems | maven | gradle | nuget | composer | cocoapods | spm | pub | hex | cpan | cran | luarocks
  registry_name: ""
  repository_url: ""
  vendor: ""
  product: ""
versions:
  tested: ""
  affected_range: ""
  fixed_version: ""
vulnerability:
  class: ""
  cwe: ""
  summary: ""
  affected_component: ""
  affected_function: ""
evidence:
  source: ""
  sink: ""
  guard: ""
  vulnerable_code_url: ""
  local_reproducer: ""
  observed_result: ""
impact:
  attacker_controls: ""
  attack_vector: Network | Adjacent | Local | Physical | unknown
  authentication_required: Yes | No | unknown
  user_interaction_required: Yes | No | unknown
  scope: Changed | Unchanged | unknown
  impact_text: ""
disclosure:
  vendor_contacted: Yes | No | unknown
  existing_cve_search: ""
  ghsa_status: none | draft | published | unknown
blockers:
  - ""
provenance:
  verification_date: "YYYY-MM-DD"
  sources:
    - ""
  unverified_fields:
    - ""
```

## Required before handoff

- `package.ecosystem`, `package.registry_name` or `package.repository_url`
- `versions.tested`
- `vulnerability.class` or `vulnerability.cwe`
- `evidence.source`, `evidence.sink`, and `evidence.guard`
- `evidence.local_reproducer` or a precise local reproduction plan
- `impact.attack_vector`, `impact.authentication_required`, and `impact.user_interaction_required`
- `provenance.verification_date`

## Blocker rules

Set `status: blocked` and list blockers when any of these are true:

- No tested version is known.
- There is no attacker-controlled source path.
- The sink is known but the data flow is not proven.
- The PoC requires attacker control of the application owner's own source code or config.
- A likely duplicate CVE or GHSA already exists.
- The issue depends on attacking a live third-party service.

## Output placement

For normal target-finding requests, keep the handoff packet out of the main table. Include it only when the user asks to turn a specific finding into a report, asks "what do I hand to vuldb-report?", or provides enough confirmed evidence in the conversation.
