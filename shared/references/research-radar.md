# Research Radar Reference

Use this reference when a request asks for creative target discovery, portfolio-style output, recent risky diffs, novelty checks, duplicate risk, or audit-readiness notes.

The radar layer does not confirm vulnerabilities. It ranks candidate hypotheses for passive, local review.

## Portfolio Lanes

Assign one primary lane to each strong candidate. Mention secondary lane fit only when it changes the suggested next step.

| Lane | Use when | Required evidence | Typical next local step |
|---|---|---|---|
| `fast-win` | Small focused codebase, exact source -> sink -> guard note, and an obvious local test or harness | File/function path plus weak or missing guard | Add a unit test or small harness around the named sink |
| `deep-audit` | Impact or reach looks meaningful, but reachability crosses several files, plugins, or state transitions | Exact sink plus unresolved source path or guard ordering question | Trace call graph, configuration, or plugin boundary locally |
| `diff-alert` | A recent public commit, release, or file change added a parser, loader, renderer, fetcher, upload path, importer, or guard change | Commit, release, or changed file reference, or `未确认` when request limits block verification | Compare before/after guard behavior in a local checkout |
| `underrated` | Stars are modest but verified downloads, dependents, importers, toolchain use, or transitive reach suggests real exposure | Registry dependents/downloads/importers or documented toolchain usage | Prioritize exact source evidence before scoring it above better-known packages |

If no lane has sufficient evidence, keep the candidate in the normal ranked table and mark radar fields as `未确认` or `low`.

## Radar Fields

Record these fields when radar mode is relevant:

- `portfolio_lane`: one of `fast-win`, `deep-audit`, `diff-alert`, `underrated`, or `未确认`.
- `playbooks`: pattern-pack tags such as `archive-extractor`, `renderer-pipeline`, `template-engine`, `config-loader`, `media-tool`, `webhook-client`, or `upload-handler`.
- `diff_signal`: recent commit, release, changed file, or `未确认`.
- `novelty_signal`: why the candidate still looks worth reviewing after duplicate checks.
- `duplicate_risk`: `low`, `medium`, `likely_duplicate`, or `未确认`, with a concise reason.
- `audit_readiness`: `high`, `medium`, or `low`, plus the first local file/function/test idea and blocker.

## Bounded Diff Checks

Keep diff analysis cheap and passive:

1. Check the default branch recent commits, release notes, or package changelog through public metadata.
2. Inspect at most 3 recent commits or releases per candidate.
3. Inspect at most 5 changed file names before deciding whether a diff signal exists.
4. Fetch file content only through the existing manifest-first source strategy and per-candidate fetch budget.
5. If GitHub, registry, or raw source requests are refused, record the refusal class when known and set `diff_signal: 未确认`.

Do not clone full history unless the user already has a local checkout or explicitly asks for deeper local analysis.

## Novelty and Duplicate Checks

Duplicate checks are confidence adjustments, not proof of novelty.

Strong duplicate risk requires all of these:

- Same package or repository.
- Same vulnerability class.
- Same affected behavior or sink.
- Same or overlapping affected version range, release note, advisory, or issue context.

Treat these as inconclusive, not duplicate:

- Package-name overlap only.
- Same broad vulnerability class but a different sink or feature.
- Advisory against a fork, plugin, or unrelated integration.
- Unverified search result snippets with no source link.

Recommended passive sources include registry advisory pages, GitHub Security Advisories, OSV, NVD, release notes, issue titles, and changelogs. If request limits block this check, write `duplicate_risk: 未确认` and do not reward novelty.

## Audit-Readiness Notes

For each high-ranked radar candidate, include one compact note:

```text
Audit readiness: high | entry: src/archive.ts#extractEntry | local test: crafted fixture archive with ../ entry | expected guard: normalize then base-prefix check | blocker: symlink handling 未确认
```

Use `high` only when exact source -> sink -> guard evidence exists. Use `medium` when metadata and sink evidence are strong but source reachability needs tracing. Use `low` when the candidate is primarily metadata-driven or source fetching failed.

## Score Effects

Apply these after the base scoring rubric and clamp the final score to 0-100:

- +3 to +8 for exact, recent `diff-alert` evidence touching a relevant guard or sink.
- +2 to +6 for verified `underrated` reach that is not captured by stars.
- +2 to +5 for high audit readiness.
- -5 to -15 when radar fields are mostly `未确认`.
- -10 to -25 for medium duplicate risk.
- -20 to -40 or block from the main list for likely duplicate evidence.

Never let radar metadata outrank weak source -> sink -> guard evidence.
