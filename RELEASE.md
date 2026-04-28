# Release Process

This repository ships standalone `.skill` archives for `vuln-finder` and `vuldb-report`.

## Version policy

- Use `v0.x` tags while the skill contracts are still evolving.
- Treat `SKILL.md` behavior, referenced contracts, eval prompts, and packaged file layout as release surface.
- Bump the changelog whenever a release changes invocation, output format, handoff fields, or report templates.

## Pre-release checks

Run the full release check without changing root artifacts:

```bash
python3 scripts/release_check.py
```

Rebuild tracked package artifacts:

```bash
python3 scripts/release_check.py --write-artifacts
```

The release check validates every skill directory, builds each `.skill` archive, validates archive contents, and prints package size plus SHA-256 digests for release notes.

## Tagging checklist

1. Update `CHANGELOG.md`.
2. Run `python3 scripts/release_check.py --write-artifacts`.
3. Review `git diff --stat` and package digest output.
4. Commit source changes and rebuilt `.skill` artifacts together.
5. Tag the release, for example `git tag v0.5`.

## Compatibility checklist

Before tagging, verify:

- `vuln-finder` still rejects invalid flags without fabricating projects.
- `vuln-finder` can emit the handoff fields listed in `references/handoff-contract.md`.
- `vuldb-report` can consume that handoff without asking for already-provided metadata.
- `vuldb-report` can produce VulDB, GHSA, OSV, and standalone Markdown advisory formats.
