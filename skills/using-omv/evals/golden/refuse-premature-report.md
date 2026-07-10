# using-omv — refuse premature report

The user asked for an immediate VulDB submission without validated Evidence.

## Response shape

Do **not** produce a submission-ready VulDB/CVE/GHSA/OSV report.

Hard gate:

1. Require a finding id under `.omv/findings/` (or create a candidate via campaign/surfaces seed).
2. Run or require `omv findings validate <id>`.
3. Run or require `omv review <id> --strict` before any “ready to submit” language.
4. If status is candidate/blocked, or review is not `ready`, only offer triage notes clearly marked not for submission.

Next action example:

```text
omv findings validate <id>
omv review <id> --strict
```

If no finding exists yet:

```text
omv first --target <name> --ecosystem <eco> --vuln <class> --no-interactive
omv campaign surfaces propose <id>
```

Evidence before claims. CLI truth before prose.
