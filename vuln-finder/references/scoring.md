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

## Confidence Adjustments

- Subtract 5-15 points when key metadata is `未确认`.
- Subtract 10-20 points when evidence is mostly keyword based.
- Subtract 10-20 points for stale projects unless the user asked for abandoned targets.
- Subtract 5-15 points for flagship or heavily audited projects even if they fit the vulnerability class.
- Keep outside-range projects only if code evidence is unusually strong.

## Filtering Guidance

- Prefer 50-3000 stars.
- Prefer commits in the last 12 months.
- Prefer independent maintainers or small orgs.
- Prefer 5k-50k source LOC.
- Keep roughly 15-25 candidates for source scanning after metadata filtering.
- Return fewer high-confidence results instead of filling `--count` with weak candidates.

## Size Estimation

Best methods, in order:

1. Shallow clone and run `scripts/estimate_loc.sh <repo>`.
2. Use `cloc` or `tokei` if available.
3. Use `find`/`wc` over source extensions.
4. Use GitHub language/file counts or repository size only as an approximate estimate.
5. Write `未确认` if no credible method is available.
