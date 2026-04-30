## Audit Result

status: candidate

evidence:
  source: lib/parser.js:18 user supplied include path
  sink: lib/parser.js:64 fs.readFileSync
  guard: missing base directory normalization
  reproducer: create a local fixture with `!include ../../secret.txt` and render it with the tested package version
  observed_result: unknown

provenance:
  unverified_fields:
    - evidence.observed_result

Next: run `/omv-repro demo-incomplete-observed-result` before any report.
