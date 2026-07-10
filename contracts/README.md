# Contracts

Single-source schema definitions shared across all oh-my-vul skills.

Skills reference these files directly rather than duplicating schema content in their own `references/` directories.

## Files

| File | Description |
|---|---|
| `campaign.v1.yaml` | Local research target, scope, priorities, and candidate finding lanes used by `omv campaign`. |
| `source-ref.v1.yaml` | Optional local source identity and Evidence hash sidecar used by `omv sources`. |
| `report-provenance.v1.yaml` | Generated hash manifest for report artifacts and their local inputs. |
| `evidence.v1.yaml` | Finding object passed between `omv-find` and `omv-report`. Replaces the old `handoff-contract.md` in both skills. |
| `candidate-list.v1.yaml` | Schema for the candidate list output produced by `omv-find`. |
| `threat-map.v1.yaml` | Optional dataflow threat map sidecar produced by `omv-audit`. |
| `verification.v1.yaml` | Adversarial verifier review sidecar for evidence graph and report-readiness claims. |
| `submission.v1.yaml` | Local submission tracking sidecar for post-report bookkeeping. |

## Versioning

Contract files are named `<name>.v<major>.yaml`. Bump the major version when fields are removed or semantics change. Add new optional fields within the same version.

Skills state which contract version they consume at the top of their reference section.
