## Audit Result

status: confirmed

evidence:
  source: src/routes/upload.ts:22 user-controlled filename from multipart body
  sink: src/routes/upload.ts:58 path.join(uploadDir, filename)
  guard: src/routes/upload.ts:30 basename extraction — bypassable via encoded slashes (%2F)
  reproducer: POST multipart with filename=..%2F..%2Fetc%2Fpasswd to /upload endpoint on local server
  observed_result: file written outside upload directory to arbitrary path

cvss:
  vector: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:N
  score: 7.5
  severity: High

dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none
