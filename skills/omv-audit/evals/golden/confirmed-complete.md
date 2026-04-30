## Audit Result

status: confirmed

evidence:
  source: lib/index.js:12 attacker controlled filename
  sink: lib/index.js:44 fs.readFileSync
  guard: missing path normalization
  reproducer: run `node repro.js` in a local checkout with version 1.2.3
  observed_result: local run reads a file outside the configured base directory

cvss:
  vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N
  score: 5.5
  severity: Medium

dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none
