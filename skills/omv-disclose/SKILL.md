---
name: omv-disclose
description: |
  Helps prepare responsible disclosure communications and timelines from an Evidence.v1 finding. Use when the user asks to contact a vendor, create initial/follow-up/deadline disclosure email templates, plan a 90-day timeline, record disclosure fields, or invokes `/omv-disclose`.
---

# omv-disclose

Prepare local responsible disclosure material after a finding is report-ready.

## Invocation

```text
/omv-disclose <id>
/omv-disclose timeline <id> [--days N]
```

## Workflow

1. Read `.omv/findings/<id>.yaml`.
2. Identify vendor type: individual maintainer, company, foundation, or unknown.
3. Generate three templates: initial contact, follow-up, and disclosure deadline reminder.
4. Use `omv disclose timeline <id>` for 90-day milestones or `--days N` for a custom window.
5. Ask before writing Evidence.v1 disclosure fields.

## Template Requirements

Include package name, affected versions, impact summary, reproduction summary, suggested coordination deadline, and contact metadata. Avoid exploit payload expansion beyond what the existing Evidence.v1 reproducer already states.

## Local State

Submission bookkeeping belongs in `.omv/submissions/<id>.yaml` through `omv submissions`. Research notes belong in `.omv/notes/<id>.md`. Treat both as private local state until sanitized.
