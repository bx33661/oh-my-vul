---
name: omv-dedup
description: |
  Checks whether an Evidence.v1 finding is likely already disclosed. Use when the user asks to deduplicate a finding, check CNA duplicate risk, search NVD/GHSA/OSV/ecosystem advisory databases, or invokes `/omv-dedup`. Produces deterministic advisory queries and writes Evidence.v1 dedup fields only after confirmation.
---

# omv-dedup

Assess duplicate disclosure risk for a local finding.

## Invocation

```text
/omv-dedup <id>
```

## Workflow

1. Read `.omv/findings/<id>.yaml` using `contracts/evidence.v1.yaml` as the local schema reference.
2. Run `omv dedup <id>` to produce deterministic NVD, GHSA, OSV, and ecosystem advisory queries.
3. Show the queries before conclusions.
4. Compare package, ecosystem, affected range, vulnerability class, CWE, source, sink, guard, and fixed version signals.
5. Grade CNA duplicate risk as `High`, `Medium`, or `Low`.
6. Only after user confirmation, write fields with:
   - `omv dedup <id> --confirm --existing-cve <CVE|none> --notes <summary>`

## Risk Rules

- `High`: same package plus same vulnerability class plus overlapping affected range or sink behavior.
- `Medium`: same package or same sink behavior, but incomplete version or guard overlap.
- `Low`: no close advisory match after source-specific searches.

Do not block a novel finding solely from package-name overlap.

## Comparison Method

Build a table before assigning risk:

- Query source: NVD, GHSA, OSV, ecosystem database, maintainer advisory.
- Identity overlap: ecosystem, registry name, repository, vendor/product.
- Version overlap: affected range, fixed version, release date, vulnerable component.
- Behavior overlap: source type, sink API, guard/fix description, CWE, exploitability preconditions.
- Provenance quality: primary advisory, maintainer fix, registry metadata, or secondary mention.

Use sanitized fixture names in examples and evals. Do not teach from a real public CVE as the default example; real CVEs are allowed only when supplied by the user or when validating identifier format.
