# Handoff Contract

This is the input contract accepted from `vuln-finder` when a research candidate becomes a report-writing task.

`vuldb-report` should preserve the packet's verified facts, ask only for missing blocker fields, and avoid reinterpreting unverified fields as confirmed evidence.

## Accepted packet

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

## Consumption rules

- If `status: blocked`, do not write a submission-ready report. Explain the blockers and give the minimum local evidence needed.
- If `status: candidate`, write a triage note or draft outline only. Do not claim a confirmed vulnerability.
- If `status: confirmed`, generate the requested format and keep unverified fields visibly marked.
- If `disclosure.existing_cve_search` names a likely duplicate, lead with the duplicate warning before any report draft.
- If `disclosure.ghsa_status` is `draft` or `published`, warn about duplicate CNA risk before suggesting VulDB/CVE submission.

## Minimum fields for submission-ready output

- Vendor, product, package ecosystem, and package identity
- Tested version and affected range
- Vulnerability class or CWE
- Affected component and function when known
- Source -> sink -> guard evidence
- Local PoC or reproduction steps
- Impact and attack requirements
- Vendor contact status and duplicate-CVE search status

When one of these is missing, include a "Missing before submission" section instead of pretending the report is complete.
