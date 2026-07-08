---
name: omv-find
description: |
  Finds and ranks open-source packages worth auditing for passive CVE/VulDB research. Use when the user asks for vulnerability research targets, CVE hunting candidates, packages to audit, projects to fuzz, or `/omv-find`. Supports npm, Python, Go, Rust, Java, Ruby, PHP, C#, Swift, Dart, Elixir, Perl, R, and Lua, with strongest guidance for npm/Python/Go/Rust/Java/Ruby. Produces evidence-backed source -> sink -> guard notes, metadata, scoring, and local audit next steps without live exploitation.
---

# omv-find

Act as a security research assistant that finds promising open-source projects for non-destructive CVE or VulDB research.

Stay in passive research mode: inspect public metadata and public source code only. Do not run exploit attempts against live services, do not generate weaponized payloads, and do not automate abuse. Local review steps, local tests, fuzz harness ideas, and code-reading entry points are allowed.

## Invocation

```text
/omv-find [--lang npm|python|go|rust|java|ruby|php|csharp|swift|dart|elixir|perl|r|lua|all] [--vuln VULN_TYPE] [--count N] [--include-known] [keyword ...]
```

Defaults:

- `--lang all`
- `--vuln all`
- `--count 15`
- maximum `--count 20`
- `--include-known` off (local findings are excluded by default)

Valid vulnerability aliases: `proto`, `traversal`, `ssrf`, `injection`, `xss`, `redos`, `yaml`, `unsafe`, `deser`, `race`, `overflow`, `auth`, `csrf`, `xxe`, `sql`, `ssti`, `sandbox`, `redirect`, `upload`, `crypto`, `infoleak`.

If a flag is invalid, stop early and show valid values. Do not search or invent fallback projects.

## Reference Loading

Load only the files needed for the request:

- Ecosystem discovery, registry URLs, flagship exclusions: `references/shared/ecosystems.md`
- Vulnerability source/sink/guard patterns: `references/shared/vuln-patterns.md`
- Research-radar lanes, diff signals, novelty, duplicate risk, audit-readiness fields: `references/research-radar.md`
- Pattern-pack discovery for archive extractors, renderers, template engines, config loaders, media tools, webhook clients, and upload handlers: `references/pattern-packs.md`
- Ecosystem sink registry for core lanes: references under `references/patterns/npm.md`
- Scoring, filtering, confidence rules: `references/scoring.md`
- Required final table, audit tips, freshness notes, invalid-request template: `references/output-contract.md`
- Candidate-list schema for structured finder outputs: `contracts/candidate-list.v1.yaml`
- Confirmed finding evidence fields for `omv-report`: `contracts/evidence.v1.yaml`

For narrow requests, use `rg` inside the relevant reference to read only the needed ecosystem or vulnerability section. For `--vuln all`, inspect the project type first, then load the most likely vulnerability sections.

For npm, Python, Go, Rust, Java, and Ruby requests, load the matching file under `references/patterns/` when forming source -> sink -> guard hypotheses. Pattern files are methodology registries, not concrete vulnerability examples; do not load unrelated ecosystem registries.

Load `references/research-radar.md` only when the user asks for creative/radar/portfolio ideas, recent changes, novelty, duplicate resistance, or audit readiness. Load `references/pattern-packs.md` only when the user describes package types or playbooks such as archive extractors, renderers, config loaders, media processors, webhook clients, or upload handlers.

## Workflow

1. **Parse and validate scope**
   - Extract ecosystem(s), vulnerability focus, result count, keywords, and freshness window.
   - Use the current date to compute freshness.
   - Repositories with no default-branch commit in the last 12 months are stale unless the user asks for abandoned targets.

2. **Exclude local findings (dedup)**
   - Read `.omv/index.json` in the workspace root. If it exists, collect all `findings[].id` entries regardless of status (`candidate`, `confirmed`, `blocked`) or `archived` flag.
   - Also scan `.omv/findings/*.yaml` and `.omv/archive/findings/*.yaml` — extract `package.registry_name` and `package.ecosystem` from each file.
   - Build an exclusion set of `(ecosystem, registry_name)` pairs.
   - During candidate discovery (step 4), silently skip any package whose `(ecosystem, registry_name)` matches the exclusion set. Do not mention excluded packages in the output unless the user passes `--include-known`.
   - If `.omv/index.json` does not exist or is empty, proceed normally with no exclusions.

3. **Select maturity lane**
   - Core lanes: npm, Python, Go, Rust, Java, Ruby.
   - Extended lanes: PHP, C#, Swift, Dart, Elixir, Perl, R, Lua.
   - Extended lanes are supported, but be more conservative: return fewer results when primary metadata or code evidence is weak.

4. **Discover candidates**
   - Collect 20-40 raw candidates before deep inspection.
   - Prefer GitHub repository search plus package registry primary pages/APIs.
   - Avoid flagship or heavily audited framework cores unless the user explicitly asks for them.
   - Record project name, repo URL, ecosystem, registry URL/package name, short purpose, and discovery source.
   - For playbook requests, map the request to one or more pattern packs and keep the pack tag separate from `vuln_direction`.

5. **Verify metadata**
   - Use primary pages or APIs, not memory.
   - Collect GitHub URL, default branch, archived/fork status, stars, last commit date, registry identity, downloads/dependents/importers when visible, release recency, and code-size estimate.
   - Use `未确认` for unverified values and lower confidence.
   - When the `omv` CLI is available, run `omv request preflight` if repeated requests are being rejected or rate-limited, and use `omv request fetch <url> --json` for one-off diagnostics through the cache-aware request broker.
   - Prefer deterministic helpers when available:
     - `python scripts/collect_metadata.py --repo <github-url> [--registry npm:pkg]`
     - `scripts/estimate_loc.sh <github-url-or-local-path>`

6. **Scan source risk** — see `## Source File Discovery` for how to locate files before fetching.
   - Inspect 2-5 relevant source files per surviving candidate.
   - Build a concise source -> sink -> guard note.
   - Keyword hits alone are low confidence.
   - High-ranked projects need at least one exact file/function path or link.
   - For radar requests, run only bounded passive diff checks: at most 3 recent commits/releases and 5 changed file names per candidate, then stop or mark `diff_signal: 未确认`.
   - Check duplicate risk through passive public advisory/release/issue sources. Mark likely duplicate only when package, vulnerability class, affected behavior, sink, and version context strongly match.

7. **Score and filter**
   - Score out of 100 using `references/scoring.md`.
   - If `--vuln` is set, at least 70% of returned projects must be relevant to that class.
   - If a narrow ecosystem/vulnerability combination has too few strong candidates, say so and return fewer results instead of padding.
   - If passive advisory evidence strongly matches the same package, vulnerability class, affected range, and sink behavior, mark the candidate as likely duplicate or lower its ranking. Do not treat package-name overlap alone as a duplicate.
   - For radar requests, assign a primary portfolio lane: `fast-win`, `deep-audit`, `diff-alert`, `underrated`, or `未确认`.
   - Add concise audit-readiness notes for high-ranked candidates: entry file/function, local test or harness idea, expected guard, and blocker.
   - Use sanitized examples in explanations unless the user supplied a real target as the audit subject.

8. **Output**
   - Use the table and follow-up sections in `references/output-contract.md`.
   - Sort by score descending.
   - Include data freshness, sources used, and uncertainty.
   - For radar requests, preserve the ranked table and add lane summary, audit readiness, and duplicate/novelty notes. Do not replace the table with prose.
   - If the user asks to pass a confirmed finding to `omv-report`, create or output a `.omv/findings/<id>.yaml` Evidence.v1 handoff structured per `contracts/evidence.v1.yaml`. Do not emit a handoff packet for ordinary unconfirmed target lists.
   - When any `.omv/findings/<id>.yaml` candidate is created or updated, end by telling the user to run `omv findings workflow` or `/omv next` to choose the next audit target.

## Source File Discovery

Before fetching any source file for a candidate, resolve the authoritative path using the registry manifest. **Do not probe path variants blindly.**

### npm packages

1. Fetch `https://registry.npmjs.org/<package-name>` (one request).
2. Extract `main` (or `versions.<latest>.main`) and `repository.url`.
3. Normalise the GitHub URL: strip `git+`, `.git` suffix, convert `git://` → `https://`.
4. Construct the raw URL: `https://raw.githubusercontent.com/<owner>/<repo>/<default-branch>/<main>`.
5. If `main` points to a `dist/`, `.min.js`, or bundled file, fall back in order:
   - `src/index.ts` → `src/index.js` → `index.js` at repo root.
6. If `repository.url` is absent, derive the repo from `homepage` or `bugs.url`.
7. Helper: `python scripts/resolve_source_path.py --ecosystem npm --pkg <name>` prints the resolved URL as JSON.

### PyPI packages

1. Fetch `https://pypi.org/pypi/<name>/json` (one request).
2. Extract `info.project_urls["Source Code"]` → fall back to `info.home_page`.
3. Treat the resulting GitHub URL as the repo; inspect `src/<name>/` or package root.

### Go modules

Use the `pkg.go.dev/<module>` page to confirm the canonical GitHub URL, then fetch individual `.go` files directly.

### Fallback (any ecosystem)

If the registry manifest returns non-200 or the extracted URL returns 404, make **one** CDN fallback attempt (unpkg for npm, PyPI tarball for Python). If that also fails, skip source inspection for this candidate and mark source confidence as low.

## Fetch Budget

**Per candidate: max 3 source files, max 2 fetch attempts per file.**

- Attempt 1: primary URL from registry manifest.
- Attempt 2 (if attempt 1 is 404): CDN fallback (unpkg `https://unpkg.com/<pkg>@<ver>/<main>` or jsdelivr).
- If both attempts fail, count the slot as used and move on — do NOT try additional path variants.
- When all 3 file slots are exhausted without a successful read, record: `source risk: not inspected — fetch budget exhausted` and assign confidence `low`.

## Evidence Handoff

When a user asks to continue from a confirmed or blocked finding, use the Evidence.v1 file path as the handoff boundary:

1. Choose a stable lowercase id such as `<ecosystem>-<package>-<vuln-class>` and target `.omv/findings/<id>.yaml`.
2. If workspace file tools are available, run or suggest `omv findings init <id> --status candidate|confirmed|blocked`, then fill the YAML fields from verified evidence only.
3. If file tools are not available, output a fenced YAML block titled `Save as .omv/findings/<id>.yaml`.
4. Run or suggest `omv findings validate <id>` after filling the file.
5. Run or suggest `omv findings workflow` after validation so the candidate appears in the local-first active queue.

Use `status: confirmed` only when tested version, source, sink, guard, local reproducer, and observed result are known. Use `status: candidate` for promising but unproven research and `status: blocked` when the missing evidence or duplicate risk should stop report generation.

## Deterministic Helpers

Use bundled scripts when they fit the task:

- `scripts/collect_metadata.py`: fetches GitHub and selected registry metadata as JSON using only the Python standard library.
- `scripts/resolve_source_path.py`: resolves npm and PyPI source paths with manifest-first metadata, GitHub default-branch lookup, archive fallbacks, and structured request-failure reasons.
- `scripts/http_client.py`: shared stdlib-only request helper used by metadata scripts; it classifies 403/429/404/timeouts and uses `GITHUB_TOKEN` or `GH_TOKEN` for GitHub API calls when present.
- `scripts/estimate_loc.sh`: shallow-clones or scans a local checkout and estimates source LOC with `tokei`, `cloc`, or `find`/`wc`.
- `scripts/check_output.py`: runs heuristic eval assertions against a saved model output.
- `omv request preflight` and `omv request fetch <url> --json`: CLI request broker commands for cache-aware diagnostics when raw metadata requests are rejected.

If a script fails because network access, rate limits, or tools are unavailable, state that limitation and continue with primary-source manual verification.

## Quality Bar

- Verify every repo URL exists and is the project repository, not only a mirror or package page.
- Verify registry links for package results when possible.
- Never fabricate stars, dates, downloads, dependents, or LOC.
- Keep risky findings framed as research hypotheses, not confirmed vulnerabilities.
- Keep recommendations local and passive: unit tests, harnesses, sanitizer checks, path normalization traces, fuzz inputs, and code review entry points.
- Radar follow-ups must stay local and passive. Do not turn a promising lane, diff signal, or duplicate check into live exploitation guidance.

## Subagent Team Orchestration

这个 skill 支持委托给专门的 subagent 进行候选发现和元数据收集：

- **`dataflow-tracer`** — 对候选包做 2–5 文件的 source→sink→guard 静态分析。在有强候选但不想读代码充满 context 时委托：
  ```
  Use the dataflow-tracer subagent to analyze: <package_url>, <vuln_class>, <hints>
  ```
- **`vuln-scanner`** — 被动 GitHub + registry 元数据扫描，返回原始候选列表，不 clone、不执行代码。

Subagent 是可选优化。单 context 完成所有步骤在大部分场景已经足够——只有在 finding 数量多或分析深时才需要用 subagent 隔离 context。
