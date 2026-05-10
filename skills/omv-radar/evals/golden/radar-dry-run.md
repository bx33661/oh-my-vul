# Radar dry run

Sanitized fixture: all packages, repositories, advisories, and URLs below are synthetic test data.

Dry run only. Loaded `.omv/radar/watchlist.yaml` and used fixture sources:

- fixture:nvd
- fixture:ghsa
- fixture:osv
- fixture:registry

Events found:

- npm:demo-package advisory GHSA fixture advisory for demo-package
- python:url-parser-demo advisory OSV fixture advisory for parser redirect
- npm:demo-package release demo-package 1.2.4 released
- go:github.com/example/fetcher suspected-fix commit mentions allowlist validation before outbound request

No events were appended to `.omv/radar/events.jsonl`.
