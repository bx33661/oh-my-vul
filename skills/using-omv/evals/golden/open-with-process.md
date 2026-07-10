# using-omv — open research with process

The user wants to start auditing an npm package for XSS.

## Response shape

Do **not** invent a confirmed vulnerability.

Open the problem:

1. Prefer campaign first-mile: `omv first` / `omv campaign init` with ecosystem npm and vuln xss.
2. Prefer Attack Surface Cards: `omv campaign surfaces propose`, then `select`, then `seed`.
3. Seed creates **candidate** Evidence only — unproven hypotheses.
4. Deepen with `/omv-audit <id>` only after a candidate exists.
5. Stay passive: public source / local lab only.

Example next actions:

```text
omv first --target acme --ecosystem npm --vuln xss --no-interactive
omv campaign surfaces propose acme
omv campaign surfaces select acme --cards renderer-pipeline
omv campaign seed acme
/omv-audit acme-renderer-pipeline
```

Quality over sprawl: one hypothesis at a time, evidence before claims.
