## Reproduction Result

status: confirmed

evidence:
  observed_result: local execution confirmed arbitrary file read outside base directory

repro_artifacts:
  - .omv/repro/demo-artifacts/repro.js
  - .omv/repro/demo-artifacts/output.log

versions:
  tested: 2.1.0
  latest: 2.3.1

Next: run `omv findings validate demo-artifacts` to check submission readiness.
