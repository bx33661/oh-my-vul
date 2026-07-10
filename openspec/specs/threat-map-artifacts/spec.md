# threat-map-artifacts Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: ThreatMap.v1 artifact storage
The system SHALL store optional ThreatMap.v1 artifacts at `.omv/threatmaps/<id>.yaml` using the existing contract and SHALL validate them when explicitly requested or when included in readiness checks.

#### Scenario: Threat map is written for audited finding
- **WHEN** audit identifies source, transform, sink, and guard relationships
- **THEN** the workflow can write a ThreatMap.v1 artifact linked to the finding id

#### Scenario: Threat map validates successfully
- **WHEN** a threat map contains a matching finding id, package metadata, at least one path, source, sink, guard, and confidence fields
- **THEN** `omv threat-map validate <id>` reports OK

### Requirement: Graph-based evidence path
ThreatMap.v1 SHALL represent source-to-sink evidence as graph nodes and directed edges with guard annotations.

#### Scenario: Missing guard is explicit
- **WHEN** a sink edge has no allowlist, sanitizer, authorization check, or other mitigation
- **THEN** the edge records the missing guard explicitly rather than leaving the guard unknown

#### Scenario: Graph path includes transforms
- **WHEN** user-controlled input passes through parser, decoder, normalizer, validator, or authorization steps before the sink
- **THEN** the graph records each step as an ordered transform node

### Requirement: Backward-compatible Evidence integration
Threat maps SHALL augment, not replace, existing Evidence.v1 `evidence.source`, `evidence.sink`, and `evidence.guard` fields, and validation SHALL warn when a present threat map contradicts those summary fields.

#### Scenario: Finding without threat map remains valid
- **WHEN** a valid Evidence.v1 finding has no `.omv/threatmaps/<id>.yaml`
- **THEN** validation does not fail solely because the threat map is absent

#### Scenario: Threat map contradicts Evidence summary
- **WHEN** Evidence.v1 says the sink is `lib/a.js:10` but ThreatMap.v1 records only `lib/b.js:20`
- **THEN** readiness validation warns that graph evidence and Evidence summary may be inconsistent

### Requirement: ASCII threat map rendering
`omv findings show <id>` SHALL render a compact ASCII graph when a valid ThreatMap.v1 artifact exists.

#### Scenario: Show renders path
- **WHEN** a finding has a threat map containing an HTTP body source, parser node, HTTP client sink, and missing allowlist guard
- **THEN** the command displays a path equivalent to `[HTTP body] -> parseURL() -> http.Get() x no-allowlist`

