## Audit Result

status: confirmed

evidence:
  source: lib/template.js:9 user-supplied template string from request body
  sink: lib/template.js:33 new Function(templateCode)
  guard: missing — no sandbox or input sanitization
  reproducer: call render({template: "{{constructor.constructor('return process')()}}"}) locally
  observed_result: arbitrary code execution in Node.js process context

cvss:
  vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H
  score: 10.0
  severity: Critical

dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none

cvss_notes:
  scope_changed: true — sandbox escape from template context to host process
