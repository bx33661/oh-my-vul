# pattern-pack-manifests Specification

## Purpose
TBD - created by archiving change add-pattern-pack-eval-runner. Update Purpose after archive.
## Requirements
### Requirement: PatternPack manifests cover every supported ecosystem
The repository SHALL contain one closed-schema PatternPack.v1 JSON manifest for each of npm, Python, Go, Rust, Java, Ruby, PHP, C#, Swift, Dart, Elixir, Perl, R, and Lua, with unique ids, aliases, a canonical Markdown reference, vulnerability classes, and consuming skills.

#### Scenario: Complete manifest set
- **WHEN** release validation loads `shared/pattern-packs/*.json`
- **THEN** it finds exactly fourteen unique manifests matching the Evidence ecosystem set

#### Scenario: Invalid manifest
- **WHEN** a manifest contains an unknown key, unsafe path, unsupported ecosystem, missing consumer, or duplicate id
- **THEN** validation fails and names the manifest and field

### Requirement: PatternPack references remain method-oriented
Every manifest SHALL reference an existing ecosystem Markdown file whose entries contain source pattern, sink signature, common misuse, expected guard, evidence criteria, false-positive checks, and CWE fields without relying on named real vulnerable packages.

#### Scenario: R and Lua coverage
- **WHEN** validation inspects the newly covered R and Lua packs
- **THEN** both references pass the same methodology markers as the other twelve ecosystems

### Requirement: PatternPack consumers are synchronized from manifests
Skill asset synchronization SHALL copy each canonical manifest and referenced Markdown file into every declared consuming skill and SHALL fail check mode when a declared copy is missing or stale.

#### Scenario: Add a new consumer in JSON
- **WHEN** a maintainer adds a valid skill name to a manifest consumer list and runs sync
- **THEN** the corresponding manifest and Markdown reference are copied without editing a Python path list

#### Scenario: Installed skill is self-contained
- **WHEN** an omv-find or omv-audit skill is packaged
- **THEN** it contains all fourteen declared PatternPack manifests and references under its own directory

