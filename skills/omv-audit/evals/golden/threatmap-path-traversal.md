## Audit Result

status: confirmed

evidence:
  source: lib/extract.js:42 zip entry name from archive
  sink: lib/extract.js:88 fs.createWriteStream path joined without normalization
  guard: missing path traversal check before join
  reproducer: run `node repro.js` in a local checkout with version 0.4.1
  observed_result: local run writes a file outside the configured base directory

cvss:
  vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N
  score: 5.5
  severity: Medium

dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none

## ThreatMap.v1 sidecar

Ran `omv threat-map init demo-threatmap-path-traversal` to scaffold `.omv/threatmaps/demo-threatmap-path-traversal.yaml`, then filled one `paths[]` entry for the confirmed route:

```yaml
schema_version: "1"
finding_id: "demo-threatmap-path-traversal"
package:
  ecosystem: "npm"
  registry_name: "demo-archive-extractor"
  repository_url: "https://github.com/example/demo-archive-extractor"
  version_analyzed: "0.4.1"
paths:
  - id: 1
    source:
      type: file
      location: "lib/extract.js:42"
      description: "zip entry name read from archive"
    transforms:
      - type: normalize
        location: "lib/extract.js:60"
        description: "entry.name joined to base dir with path.join, no canonicalization"
    sink:
      type: fs_write
      location: "lib/extract.js:88"
      description: "fs.createWriteStream resolves outside base dir via ../"
    guard:
      present: false
      description: "no path traversal check before join"
      bypassable: true
    confidence: high
summary:
  path_count: 1
  confirmed_paths: 1
  highest_confidence: high
  vuln_classes: ["Path Traversal"]
```

The sidecar is optional and does not modify the parent Evidence.v1 file; `evidence.source`/`sink`/`guard` remain the compatibility summaries.
