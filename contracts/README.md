# Contracts

Single-source schema definitions shared across all oh-my-vul skills.

Skills reference these files directly rather than duplicating schema content in their own `references/` directories.

## Files

`artifact-contracts.v1.json` is the canonical machine-readable inventory. Its
`compatibility_mode` records how each v1 field set may evolve:

- `closed`: the complete field set is fixed for v1. Adding, removing, or renaming
  a field requires a new contract major.
- `extensible`: optional fields may be added only when every supported v1 reader
  tolerates them, applicable writers preserve them, and compatibility tests prove
  existing files remain readable.

| File | Mode | Description |
|---|---|---|
| `campaign.v1.yaml` | closed | Local research target, scope, priorities, and candidate finding lanes used by `omv campaign`. |
| `attack-surface-list.v1.yaml` | closed | Proposed/selected attack-surface cards for a campaign (`omv campaign surfaces`). |
| `source-ref.v1.yaml` | closed | Optional local source identity and Evidence hash sidecar used by `omv sources`. |
| `report-provenance.v1.yaml` | closed | Generated hash manifest for report artifacts and their local inputs. |
| `evidence.v1.yaml` | extensible | Finding object passed between `omv-find` and `omv-report`. |
| `candidate-list.v1.yaml` | extensible | Candidate list output produced by `omv-find`. |
| `threat-map.v1.yaml` | extensible | Optional dataflow threat map sidecar produced by `omv-audit`. |
| `verification.v1.yaml` | extensible | Adversarial review sidecar for evidence and report-readiness claims. |
| `submission.v1.yaml` | closed | Local submission tracking sidecar for post-report bookkeeping. |

## Versioning

Contract files are named `<name>.v<major>.yaml`. Within one major version, required
fields, types, enum meanings, identity rules, and safety semantics remain compatible.
Removing or renaming a field, changing its type or meaning, or making it required
needs a new major and an explicit migration. Closed contracts also need a new major
for field additions.

Package upgrades do not rewrite user-owned `.omv` data merely to update a schema.
Existing artifacts change only through an explicit mutating lifecycle command or a
future explicit migration command.

Skills state which contract version they consume at the top of their reference section.
