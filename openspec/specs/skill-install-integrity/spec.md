# skill-install-integrity Specification

## Purpose
TBD - created by archiving change harden-evidence-workflow. Update Purpose after archive.
## Requirements
### Requirement: Setup writes an install manifest
`omv setup` SHALL write a manifest describing installed skills, package version, source registry version, installed file paths, and file hashes for each copied runtime asset.

#### Scenario: User-scope setup writes manifest
- **WHEN** the user runs `omv setup`
- **THEN** the CLI writes an install manifest under the user Claude home containing every installed skill and runtime file hash

#### Scenario: Project-scope setup writes manifest
- **WHEN** the user runs `omv setup --scope project`
- **THEN** the CLI writes the install manifest under project-local `.omv/` and records the project scope

### Requirement: Doctor detects stale or modified installs
`omv doctor` SHALL compare installed skill files with the install manifest and the current package runtime assets.

#### Scenario: Missing installed runtime file fails
- **WHEN** a required installed `SKILL.md`, reference, script, eval, or contract file is missing
- **THEN** doctor returns FAIL and suggests `omv setup --force`

#### Scenario: Modified installed runtime file warns
- **WHEN** an installed runtime file hash differs from the manifest but the file still exists
- **THEN** doctor returns WARN and identifies the modified file

#### Scenario: Stale installed skill warns
- **WHEN** the manifest package version or registry version differs from the current package
- **THEN** doctor returns WARN and suggests rerunning setup

### Requirement: Generated asset drift is checked before release
Release validation SHALL fail if generated README metadata, skill-local registry, skill-local shared references, or skill-local contracts differ from canonical sources.

#### Scenario: Skill-local contract is stale
- **WHEN** `contracts/evidence.v1.yaml` changes but a skill-local `contracts/evidence.v1.yaml` copy is not synchronized
- **THEN** `python3 scripts/release_check.py` fails and names the stale file

#### Scenario: README skill table is stale
- **WHEN** `registry.yaml` changes installable skills but README generated markers are not updated
- **THEN** metadata sync check fails and names `README.md`

### Requirement: Version source of truth is explicit
The release tooling SHALL treat `package.json` as the version source of truth and synchronize registry and lockfile versions from it.

#### Scenario: Registry version is manually bumped
- **WHEN** `registry.yaml` has a version different from `package.json`
- **THEN** release validation fails and instructs the developer to run metadata sync or update the package version intentionally

### Requirement: Pattern and eval manifests are packaged runtime assets
The npm package SHALL include canonical PatternPack manifests, the stable eval manifest, and the unified runner, while each consuming skill package SHALL include the PatternPack manifests and references declared for it.

#### Scenario: npm dry-run package inspection
- **WHEN** release checks inspect `npm pack --json --dry-run`
- **THEN** required manifest and runner paths exist and no private `.omv` or cache files are included

#### Scenario: Generated PatternPack copy drifts
- **WHEN** a skill-local manifest or reference differs from its canonical source
- **THEN** asset sync check fails and names the stale target

