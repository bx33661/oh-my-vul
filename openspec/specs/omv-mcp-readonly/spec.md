# omv-mcp-readonly Specification

## Purpose
TBD - created by archiving change advance-intelligence-disclosure-lifecycle. Update Purpose after archive.
## Requirements
### Requirement: Read-only MCP server
`omv-mcp` SHALL expose only read-only views backed by existing CLI commands.

#### Scenario: MCP lists findings
- **WHEN** an MCP client requests findings
- **THEN** the server returns data equivalent to `omv findings list` without modifying `.omv/`

### Requirement: Supported MCP views
The MCP server SHALL expose findings list/show/workflow/validate, radar brief, and submissions track views.

#### Scenario: Submission tracking is exposed
- **WHEN** an MCP client requests submission status for a finding
- **THEN** the server returns data equivalent to `omv submissions track <id>`

### Requirement: Write commands are excluded
The MCP server SHALL NOT expose commands that initialize, promote, archive, restore, refresh, record, close, or otherwise mutate local state.

#### Scenario: Write request is rejected
- **WHEN** an MCP client asks for a state-changing command
- **THEN** the server returns an unsupported-operation error and leaves files unchanged

### Requirement: Local privacy boundary
The MCP server SHALL document that it reads private `.omv/` workspace state and should be connected only to trusted local clients.

#### Scenario: Server starts with privacy notice
- **WHEN** the MCP server starts
- **THEN** startup output or documentation identifies `.omv/` data as local private research state

