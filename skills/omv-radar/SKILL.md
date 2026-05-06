---
name: omv-radar
description: |
  Provides passive watchlist intelligence for oh-my-vul. Use when the user asks what changed for watched packages, ecosystems, vulnerability classes, advisories, releases, or invokes `/omv-radar`. Reads `.omv/radar/watchlist.yaml`, uses only passive external sources or offline fixtures, and writes local radar events for later briefings.
---

# omv-radar

Maintain passive intelligence for watched packages and vulnerability classes.

## Invocation

```text
/omv-radar refresh [--dry-run]
/omv-radar brief
```

## Workflow

1. Read `.omv/radar/watchlist.yaml`.
2. For refresh, prefer the CLI:
   - `omv radar refresh --dry-run` for fixture-backed offline validation.
   - `omv radar refresh` for local event append.
3. For summaries, run `omv radar brief`.
4. Group output by ecosystem, package, and signal type: advisory, release, suspected fix, or watchlist snapshot.
5. After a successful manual refresh, offer a weekly Monday refresh reminder, but do not create it unless the user asks.

## Signal Methodology

Use radar as a triage aid, not as proof of a vulnerability.

- Advisory signal: compare ecosystem, package identity, affected range, vulnerability class, and referenced fix locations.
- Release signal: look for security-relevant changelog language, dependency bumps, parser/validation changes, or guard hardening.
- Suspected-fix signal: treat commit messages such as "validate", "sanitize", "allowlist", or "path check" as review prompts only.
- Watchlist signal: record that a watched item was evaluated, even when no advisory-like signal appears.

Prioritize review when multiple independent signals point to the same component or guard. Lower priority when only a broad keyword matches.

## Passive Boundary

Radar may read advisory databases, registries, and public repository metadata. It must not send requests to target runtime services, run PoCs, or probe package deployments.

## Output

End with a concise brief:

- new advisories or CVEs
- new releases
- suspected fix commits
- audit candidates worth reviewing next

If the watchlist is missing, tell the user to create `.omv/radar/watchlist.yaml` and include a sanitized example. Do not present any real active vulnerability as a tutorial target.
