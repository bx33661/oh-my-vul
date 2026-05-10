# Dedup result

Sanitized fixture: all package, advisory, and identifier values below are synthetic test data.

Queries:

- NVD: demo-package prototype pollution CWE-1321 <1.2.4
- GHSA: demo-package prototype pollution CWE-1321 <1.2.4
- OSV: ecosystem:npm package:demo-package prototype pollution
- npm advisory db: demo-package prototype pollution CWE-1321 <1.2.4

duplicate_risk: High
result: likely duplicate
existing_cve: CVE-2099-99999

Reason: same package, same vulnerability class, overlapping affected range, matching recursive merge sink, and matching guard/fix language.
