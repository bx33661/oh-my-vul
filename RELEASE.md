# Release Process

This repository ships standalone `.skill` archives for `omv`, `omv-find`, and `omv-report`.

## Version policy

- Use `v0.x` tags while the skill contracts are still evolving.
- Treat `SKILL.md` behavior, referenced contracts, eval prompts, and packaged file layout as release surface.
- Bump the changelog whenever a release changes invocation, output format, handoff fields, or report templates.

## Pre-release checks

Run the full release check without changing root artifacts:

```bash
npm run validate
```

`scripts/release_check.py` verifies metadata sync, version consistency, skill-local runtime assets synchronized from canonical `shared/` and `contracts/` sources, skill structure, and self-contained packages.

Rebuild tracked package artifacts:

```bash
python3 scripts/release_check.py --write-artifacts
```

The release check validates every skill directory, builds each `.skill` archive, validates archive contents, and prints package size plus SHA-256 digests for release notes.

## Tagging checklist

1. Update `CHANGELOG.md`.
2. Run `npm run sync-metadata`.
3. Run `npm run sync-assets`.
4. Run `python3 scripts/release_check.py --write-artifacts`.
5. Review `git diff --stat` and package digest output.
6. Commit source changes and rebuilt `.skill` artifacts together.
7. Tag the release, for example `git tag v0.7.0`.

## Compatibility checklist

Before tagging, verify:

- `omv-find` still rejects invalid flags without fabricating projects.
- `omv-find` can create or emit `.omv/findings/<id>.yaml` handoffs from `contracts/evidence.v1.yaml`.
- `omv findings validate <id>` catches missing confirmed evidence before report generation.
- `omv-report` can consume validated handoffs without asking for already-provided metadata.
- `omv-report` can produce VulDB, GHSA, OSV, and standalone Markdown advisory formats.
