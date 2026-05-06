# Release Process

This repository ships standalone `.skill` archives for every installable skill in `registry.yaml`.

## Version policy

- Use `v0.x` tags while the skill contracts are still evolving.
- Treat `package.json` as the version source of truth; sync metadata updates registry and lockfile versions from it.
- Treat `SKILL.md` behavior, referenced contracts, eval prompts, and packaged file layout as release surface.
- Bump the changelog whenever a release changes invocation, output format, handoff fields, or report templates.

## Pre-release checks

Run the full release check without changing root artifacts:

```bash
npm run validate
npm run release:check
npm run pack:check
```

`scripts/release_check.py` verifies metadata sync, version consistency, skill-local runtime assets synchronized from canonical `shared/` and `contracts/` sources, skill structure, stable eval checkers, and self-contained packages.

`npm run pack:check` runs `npm pack --json --dry-run` and fails if required release files are missing or private/local state would be included.

`npm run release:check` runs the full validation suite plus `pack:check`.

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
6. Run `npm pack --dry-run` and confirm `.omv/`, `.claude/`, local reports, and local reproduction artifacts are not included.
7. Commit source changes and rebuilt `.skill` artifacts together.
8. Tag the release, for example `git tag v0.7.1`.

## npm publish checklist

Before running `npm publish`, verify:

```bash
npm view oh-my-vul version
npm run release:check
npm run pack:check
npm pack --dry-run
```

Then publish:

```bash
npm publish --access public
```

After publishing:

```bash
npm view oh-my-vul version
npx -p oh-my-vul omv version
npx -p oh-my-vul omv setup --dry-run
```

## Compatibility checklist

Before tagging, verify:

- `omv-find` still rejects invalid flags without fabricating projects.
- `omv-find` can create or emit `.omv/findings/<id>.yaml` handoffs from `contracts/evidence.v1.yaml`.
- `omv-audit` can consume candidate Evidence.v1 files and leave confirmed or blocked evidence.
- `omv-repro` can guide local confirmation without modifying the reproducer field or inventing observations.
- `omv findings validate <id>` catches missing confirmed evidence before report generation.
- `omv doctor` reports stale or modified installed skills through the install manifest.
- `omv-report` can consume validated handoffs without asking for already-provided metadata.
- `omv-report` can produce VulDB, GHSA, OSV, and standalone Markdown advisory formats.
