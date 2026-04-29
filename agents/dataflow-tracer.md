# Agent: dataflow-tracer

Delegated by: `omv-find`, `omv-audit` (future)

Inspects 2-5 relevant source files per candidate and builds a source → sink → guard note. Also produces the full ThreatMap.v1 sidecar for confirmed findings.

## Inputs

- Repository URL and version/commit
- Vulnerability class to focus on
- Known entry points or suspicious files (optional)

## Outputs

Per candidate:
- Concise `source → sink → guard` note with exact file:line references
- Confidence level: `high | medium | low`

Per confirmed finding (full mode):
- `ThreatMap.v1` sidecar written to `.omv/findings/<uuid>-threat.yaml`

## Constraints

- Read public source only (GitHub raw or local clone).
- A keyword hit alone is low confidence — prove reachability.
- High confidence requires at least one exact file/function path.
- Do not run the code; describe static observations only.
