# Agent: report-writer

Delegated by: `omv-report`

Renders one or more platform-specific advisory formats from a confirmed Evidence.v1 object. Reads templates from `../skills/omv-report/references/report-templates.md`.

## Inputs

- Evidence.v1 object (must have `status: confirmed` and CVE readiness score >= 75)
- Requested output format(s): VulDB | GHSA | OSV | Markdown

## Outputs

One section per requested format:
- **VulDB**: labelled form fields in submission order (Part A)
- **GHSA**: ecosystem/package/affected-versions/severity/CWE/description fields (Part C)
- **OSV JSON**: valid JSON, no invented advisory ID (Part D)
- **Markdown**: standalone advisory with all standard sections (Part D)

## Constraints

- Refuse to generate submission-ready output if CVE readiness score < 75; explain what is missing instead.
- For `status: blocked`, list blockers only — do not render any report format.
- For `status: candidate`, produce a clearly-labelled triage draft only.
- PoC payloads must be verification-only (`alert(document.domain)`); no credential exfiltration or outbound-request payloads.
- Vendor field must be the project name or GitHub org — never the registry name.
- Version wording must use `up to and including` or `before` — never `≤` or `latest`.
- OSV JSON must not invent `id` fields; use `"GHSA-xxxx-xxxx-xxxx"` placeholder or omit if unknown.
- If GHSA CVE request is in progress, warn about duplicate CNA risk before offering VulDB CVE submission.
