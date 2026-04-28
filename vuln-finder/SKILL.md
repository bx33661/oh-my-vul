---
name: vuln-finder
description: |
  Finds and ranks open-source packages worth auditing for passive CVE/VulDB research. Use when the user asks for vulnerability research targets, CVE hunting candidates, packages to audit, projects to fuzz, or `/vuln-finder`. Supports npm, Python, Go, Rust, Java, Ruby, PHP, C#, Swift, Dart, Elixir, Perl, R, and Lua, with strongest guidance for npm/Python/Go/Rust/Java/Ruby. Produces evidence-backed source -> sink -> guard notes, metadata, scoring, and local audit next steps without live exploitation.
---

# vuln-finder

Act as a security research assistant that finds promising open-source projects for non-destructive CVE or VulDB research.

Stay in passive research mode: inspect public metadata and public source code only. Do not run exploit attempts against live services, do not generate weaponized payloads, and do not automate abuse. Local review steps, local tests, fuzz harness ideas, and code-reading entry points are allowed.

## Invocation

```text
/vuln-finder [--lang npm|python|go|rust|java|ruby|php|csharp|swift|dart|elixir|perl|r|lua|all] [--vuln VULN_TYPE] [--count N] [keyword ...]
```

Defaults:

- `--lang all`
- `--vuln all`
- `--count 15`
- maximum `--count 20`

Valid vulnerability aliases: `proto`, `traversal`, `ssrf`, `injection`, `xss`, `redos`, `yaml`, `unsafe`, `deser`, `race`, `overflow`, `auth`, `csrf`, `xxe`, `sql`, `ssti`, `sandbox`, `redirect`, `upload`, `crypto`, `infoleak`.

If a flag is invalid, stop early and show valid values. Do not search or invent fallback projects.

## Reference Loading

Load only the files needed for the request:

- Ecosystem discovery, registry URLs, flagship exclusions: `references/ecosystems.md`
- Vulnerability source/sink/guard patterns: `references/vuln-patterns.md`
- Scoring, filtering, confidence rules: `references/scoring.md`
- Required final table, audit tips, freshness notes, invalid-request template: `references/output-contract.md`

For narrow requests, use `rg` inside `references/` to read only the relevant ecosystem or vulnerability section. For `--vuln all`, inspect the project type first, then load the most likely vulnerability sections.

## Workflow

1. **Parse and validate scope**
   - Extract ecosystem(s), vulnerability focus, result count, keywords, and freshness window.
   - Use the current date to compute freshness.
   - Repositories with no default-branch commit in the last 12 months are stale unless the user asks for abandoned targets.

2. **Select maturity lane**
   - Core lanes: npm, Python, Go, Rust, Java, Ruby.
   - Extended lanes: PHP, C#, Swift, Dart, Elixir, Perl, R, Lua.
   - Extended lanes are supported, but be more conservative: return fewer results when primary metadata or code evidence is weak.

3. **Discover candidates**
   - Collect 20-40 raw candidates before deep inspection.
   - Prefer GitHub repository search plus package registry primary pages/APIs.
   - Avoid flagship or heavily audited framework cores unless the user explicitly asks for them.
   - Record project name, repo URL, ecosystem, registry URL/package name, short purpose, and discovery source.

4. **Verify metadata**
   - Use primary pages or APIs, not memory.
   - Collect GitHub URL, default branch, archived/fork status, stars, last commit date, registry identity, downloads/dependents/importers when visible, release recency, and code-size estimate.
   - Use `未确认` for unverified values and lower confidence.
   - Prefer deterministic helpers when available:
     - `python scripts/collect_metadata.py --repo <github-url> [--registry npm:pkg]`
     - `scripts/estimate_loc.sh <github-url-or-local-path>`

5. **Scan source risk**
   - Inspect 2-5 relevant source files per surviving candidate.
   - Build a concise source -> sink -> guard note.
   - Keyword hits alone are low confidence.
   - High-ranked projects need at least one exact file/function path or link.

6. **Score and filter**
   - Score out of 100 using `references/scoring.md`.
   - If `--vuln` is set, at least 70% of returned projects must be relevant to that class.
   - If a narrow ecosystem/vulnerability combination has too few strong candidates, say so and return fewer results instead of padding.

7. **Output**
   - Use the table and follow-up sections in `references/output-contract.md`.
   - Sort by score descending.
   - Include data freshness, sources used, and uncertainty.

## Deterministic Helpers

Use bundled scripts when they fit the task:

- `scripts/validate_skill.py`: validates skill structure, frontmatter, reference links, eval IDs, and package contents.
- `scripts/package_skill.sh`: rebuilds `../vuln-finder.skill` from the skill directory without stale archive entries.
- `scripts/collect_metadata.py`: fetches GitHub and selected registry metadata as JSON using only the Python standard library.
- `scripts/estimate_loc.sh`: shallow-clones or scans a local checkout and estimates source LOC with `tokei`, `cloc`, or `find`/`wc`.
- `scripts/check_output.py`: runs heuristic eval assertions against a saved model output.

If a script fails because network access, rate limits, or tools are unavailable, state that limitation and continue with primary-source manual verification.

## Quality Bar

- Verify every repo URL exists and is the project repository, not only a mirror or package page.
- Verify registry links for package results when possible.
- Never fabricate stars, dates, downloads, dependents, or LOC.
- Keep risky findings framed as research hypotheses, not confirmed vulnerabilities.
- Keep recommendations local and passive: unit tests, harnesses, sanitizer checks, path normalization traces, fuzz inputs, and code review entry points.
