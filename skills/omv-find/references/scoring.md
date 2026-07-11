# Scoring Reference

Score each candidate out of 100. Keep scores explainable and tied to evidence.

## Rubric

| Dimension | Max | Scoring |
|---|---:|---|
| Input surface | 20 | +4 per meaningful untrusted input type; cap at 20 |
| Evidence quality | 35 | source identified +8, sink identified +8, guard missing/weak +8, plausible reachability +7, exact file/function link +4 |
| Influence sweet spot | 15 | 200-2000 stars = 15; 50-199 or 2001-3000 = 10; 30-49 or 3001-5000 = 5; otherwise 0 |
| Maintenance activity | 15 | commit in last 3 months = 15; last 6 months = 10; last 12 months = 5; older = 0 |
| Code size fit | 10 | 5k-50k LOC = 10; 1k-5k or 50k-100k = 6; otherwise 0 |
| Triage efficiency | 5 | small focused codebase, easy local tests, or existing parser/fuzzer harness |

## Research Radar Adjustments

Use these adjustments only when the request asks for portfolio/radar output, playbook-style discovery, diff signals, novelty, or duplicate risk. Apply them after the base rubric and clamp the final score to 0-100.

| Signal | Adjustment | Rule |
|---|---:|---|
| Exact `diff-alert` | +3 to +8 | Recent public commit, release, or changed file touches the relevant source, sink, or guard |
| Verified `underrated` reach | +2 to +6 | Low stars but verified downloads, dependents, importers, or toolchain usage show meaningful exposure |
| High audit readiness | +2 to +5 | Exact file/function evidence plus an obvious first local unit test or harness |
| Mostly unverified radar fields | -5 to -15 | Diff, novelty, duplicate, or audit-readiness fields are mostly `未确认` |
| Medium duplicate risk | -10 to -25 | Similar advisory/issue exists, but behavior or affected range is not a full match |
| Likely duplicate | -20 to -40 or block | Same package, class, sink behavior, and affected range appear to be covered publicly |

Do not add points for lane labels alone. A `fast-win`, `deep-audit`, `diff-alert`, or `underrated` label explains prioritization, but score still depends on source -> sink -> guard evidence.

## Confidence Adjustments

- Subtract 5-15 points when key metadata is `未确认`.
- Subtract 10-20 points when evidence is mostly keyword based.
- Subtract 10-20 points for stale projects unless the user asked for abandoned targets.
- Subtract 5-15 points for flagship or heavily audited projects even if they fit the vulnerability class.
- Subtract 10-25 points when duplicate risk is medium and the novelty signal is weak.
- Lower or block likely duplicates instead of presenting them as fresh leads.
- Keep outside-range projects only if code evidence is unusually strong.

## Filtering Guidance

- Prefer 50-3000 stars.
- Prefer commits in the last 12 months.
- Prefer independent maintainers or small orgs.
- Prefer 5k-50k source LOC.
- Keep roughly 15-25 candidates for source scanning after metadata filtering.
- Return fewer high-confidence results instead of filling `--count` with weak candidates.
- For radar requests, keep a balanced portfolio when evidence allows: at least one `fast-win`, one `deep-audit`, and one `underrated` or `diff-alert` candidate.
- For sparse ecosystem/vulnerability combinations, explain scarcity and avoid padding low-confidence candidates.

## Size Estimation

Best methods, in order:

1. Shallow clone and run `node scripts/estimate_loc.mjs <repo>`.
2. Use `cloc` or `tokei` if available.
3. Use `find`/`wc` over source extensions.
4. Use GitHub language/file counts or repository size only as an approximate estimate.
5. Write `未确认` if no credible method is available.
