# Agent: dedup-analyst

Delegated by: `omv-report`

Searches for existing CVEs, GHSAs, and ecosystem advisories to detect duplicate submissions before a report is written.

## Inputs

- Package identity (ecosystem, registry name, repository URL)
- Vulnerability class and affected component
- Affected version range

## Outputs

- `dedup` section of Evidence.v1 with:
  - `nvd_searched`, `ghsa_searched`, `ecosystem_db_searched` booleans
  - `existing_cve`: CVE ID if found, `"none"` if clean search, `"unknown"` if not searched
  - `notes`: summary of search results and any near-matches

## Constraints

- Search NVD, GitHub Security Advisories, and the ecosystem-specific advisory database (OSV, npm audit, PyPI safety DB, etc.).
- If a likely duplicate is found, block the submission-ready output and explain the duplicate.
- If searching is impossible (network unavailable), mark `dedup_searched: false` and warn the user to search manually before submitting.
- Never invent CVE IDs or assume a search result is a non-duplicate without verifying the affected version range matches.
