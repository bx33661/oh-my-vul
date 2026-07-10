# omv-find-fetch-strategy Specification

## Purpose
Define manifest-first source resolution and bounded fetch behavior for `omv-find` candidate source inspection.
## Requirements
### Requirement: Agent reads registry manifest before fetching npm source files
For npm ecosystem candidates, the agent SHALL fetch `https://registry.npmjs.org/<package-name>` once per candidate to obtain the registry manifest before attempting any source file fetch. The agent SHALL extract the `main` field and `repository.url` from the manifest to determine the authoritative source file path.

#### Scenario: npm package with main field
- **WHEN** the agent needs to inspect source for an npm package (e.g., `markdown-it-include`)
- **THEN** the agent fetches `https://registry.npmjs.org/markdown-it-include` first, reads `versions.<latest>.main` or `main`, constructs the raw GitHub URL, and fetches that file directly — without probing other paths

#### Scenario: main field points to dist/compiled output
- **WHEN** the manifest `main` field resolves to a `dist/`, `.min.js`, or bundled file
- **THEN** the agent SHALL fall back to `src/index.*` or `index.js` at repo root before trying further variants

#### Scenario: repository.url absent from manifest
- **WHEN** `repository.url` is missing or not a GitHub URL
- **THEN** the agent SHALL use `homepage` or `bugs.url` fields to derive the repository, and note the uncertainty in the source risk evidence

### Requirement: Agent respects a fetch budget during source inspection
The agent SHALL limit source file fetching to a maximum of **3 files per candidate** and **2 fetch attempts per file**. When the budget is exhausted without a successful read, the agent SHALL record confidence as low and move to the next candidate.

#### Scenario: First fetch attempt succeeds
- **WHEN** the constructed raw URL returns HTTP 200
- **THEN** the agent proceeds with source inspection of that file and counts it as 1 file toward the budget

#### Scenario: First fetch attempt returns 404
- **WHEN** the primary URL returns 404
- **THEN** the agent makes one fallback attempt (unpkg or jsdelivr CDN) and stops — it SHALL NOT probe additional path variants

#### Scenario: Budget reached with no successful reads
- **WHEN** all 3 file slots are exhausted or both attempts per file return non-200
- **THEN** the agent records source risk as "not inspected — fetch budget exhausted" and assigns low confidence to that candidate's source risk score

### Requirement: resolve_source_path.py script provides authoritative npm source URL
A new `shared/scripts/resolve_source_path.py` script SHALL accept a package name via CLI and print the resolved GitHub raw URL(s) for its main source file, using only the Python standard library.

#### Scenario: Successful resolution for an npm package
- **WHEN** called as `python3 resolve_source_path.py --ecosystem npm --pkg markdown-it-include`
- **THEN** the script prints a JSON object with `package`, `main_file`, `raw_url`, `fallback_urls`, and `registry_url` fields

#### Scenario: Package not found on registry
- **WHEN** the registry returns 404 for the package name
- **THEN** the script prints `{"error": "package not found", "package": "<name>"}` and exits with code 1

### Requirement: ecosystems.md documents fetch priority order for npm, PyPI, and Go
The `shared/references/ecosystems.md` SHALL include a "Source fetch priority" subsection for npm, PyPI, and Go ecosystems that specifies: (1) manifest-first, (2) CDN fallback, (3) direct GitHub with path from directory listing.

#### Scenario: Agent loads ecosystems.md for npm candidate
- **WHEN** the agent reads the npm section of `ecosystems.md`
- **THEN** it finds a numbered fetch priority list that resolves ambiguity about which URL to try first

#### Scenario: Agent loads ecosystems.md for PyPI candidate
- **WHEN** the agent reads the PyPI section of `ecosystems.md`
- **THEN** it finds guidance to read `https://pypi.org/pypi/<name>/json` and extract `info.project_urls["Source Code"]` or `info.home_page` before fetching source files

### Requirement: Discovery consumes pattern registry
`omv-find` SHALL use ecosystem-specific sink registries to guide candidate source-to-sink hypotheses.

#### Scenario: npm discovery uses npm sinks
- **WHEN** `/omv-find --lang npm --vuln ssrf` runs
- **THEN** candidate reasoning uses npm SSRF sink and guard guidance when available

### Requirement: Discovery can pre-dedup candidates
`omv-find` SHALL optionally use dedup query planning to lower priority for likely already-disclosed candidates.

#### Scenario: Candidate overlaps known CVE
- **WHEN** a candidate strongly matches a known advisory by package, vulnerability class, and affected range
- **THEN** discovery marks it as likely duplicate or lowers its ranking rather than presenting it as novel

### Requirement: Discovery preserves passive boundary
Pattern and dedup-enhanced discovery SHALL use only passive metadata, source repositories, registries, and advisory databases.

#### Scenario: No target probing during discovery
- **WHEN** discovery evaluates a package candidate
- **THEN** it does not send runtime requests to target services or execute proof-of-concept code

