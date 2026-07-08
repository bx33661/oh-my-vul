---
name: omv-critic
description: |
  Performs adversarial pre-submission review of an Evidence.v1 finding plus optional ThreatMap.v1 and Verification.v1 sidecars. Use before `/omv-report` when the user wants likely CNA rejection reasons, report argument quality review, or a reject_risk rating.
---

# omv-critic

Challenge the finding before report submission.

## Invocation

```text
/omv-critic <id>
```

## Workflow

1. Read `.omv/findings/<id>.yaml` using `contracts/evidence.v1.yaml` as the local schema reference.
2. If present, read `.omv/threatmaps/<id>.yaml` using `contracts/threat-map.v1.yaml` as the local schema reference.
3. If present, read `.omv/verifications/<id>.yaml` using `contracts/verification.v1.yaml` as the local schema reference.
4. Run or inspect `omv findings validate <id>` and `omv verification validate <id>` when the sidecar exists.
5. Evaluate argument quality separately from structural validation.
6. Output `reject_risk: low|medium|high`.
7. For medium or high risk, list 3-5 likely CNA or maintainer rejection reasons and concrete strengthening actions.

## Review Focus

- novelty and duplicate risk
- affected version proof
- source -> sink -> guard clarity
- local observed result quality
- CVSS and impact overclaiming
- disclosure readiness

If `reject_risk: high`, do not recommend `/omv-report` yet.

## Rejection-Risk Method

Frame findings as argument-quality gaps:

- Novelty: duplicate risk, same affected range, same fix, or unresolved CNA path.
- Evidence chain: missing file:line source, sink, guard, transform, or ThreatMap edge.
- Verification: failed, stale, or missing adversarial review when the user expects a high-confidence submission.
- Reproducibility: no user-reported local observation or unclear tested version.
- Severity: CVSS metric overclaim, missing preconditions, or unsupported impact claim.
- Disclosure readiness: no contact plan, unclear vendor, or missing timeline.

Use generic, sanitized examples when explaining risk. Do not copy conclusions from a real vulnerability case unless the user supplied that finding as active research context.
