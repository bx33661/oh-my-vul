#!/usr/bin/env python3
"""Validate npm tarball contents before publishing."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = {
    "package.json",
    "README.md",
    "README.zh-CN.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "RELEASE.md",
    "LICENSE",
    "dist/cli/omv.js",
    "dist/cli/omv-mcp.js",
    "dist/index.js",
    "registry.yaml",
    "contracts/evidence.v1.yaml",
    "contracts/candidate-list.v1.yaml",
    "contracts/submission.v1.yaml",
    "contracts/threat-map.v1.yaml",
    "docs/vulnerability-research-best-practices.zh-CN.md",
    "skills/omv/SKILL.md",
    "skills/omv-find/SKILL.md",
    "skills/omv-audit/SKILL.md",
    "skills/omv-repro/SKILL.md",
    "skills/omv-report/SKILL.md",
    "skills/omv-radar/SKILL.md",
    "skills/omv-dedup/SKILL.md",
    "skills/omv-disclose/SKILL.md",
    "skills/omv-critic/SKILL.md",
    "shared/scripts/collect_metadata.py",
    "shared/scripts/estimate_loc.sh",
    "shared/scripts/http_client.py",
    "shared/scripts/resolve_source_path.py",
    "shared/references/patterns/npm.md",
    "shared/references/research-radar.md",
    "shared/references/pattern-packs.md",
}

REQUIRED_PREFIXES = {
    "agents/",
    "contracts/",
    "docs/",
    "skills/omv/",
    "skills/omv-find/",
    "skills/omv-audit/",
    "skills/omv-repro/",
    "skills/omv-report/",
    "skills/omv-radar/",
    "skills/omv-dedup/",
    "skills/omv-disclose/",
    "skills/omv-critic/",
    "shared/",
}

FORBIDDEN_PREFIXES = {
    ".omv/",
    ".claude/",
    ".codex/",
    ".agents/",
    ".github/",
    "node_modules/",
    "src/",
    "scripts/",
}

FORBIDDEN_SUFFIXES = {
    ".skill",
    ".tgz",
}


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def npm_pack() -> dict[str, object]:
    result = subprocess.run(
        ["npm", "pack", "--json", "--dry-run"],
        cwd=REPO_ROOT,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )
    parsed = json.loads(result.stdout)
    if not isinstance(parsed, list) or len(parsed) != 1 or not isinstance(parsed[0], dict):
        fail("unexpected npm pack JSON shape")
    return parsed[0]


def main() -> None:
    package = npm_pack()
    files = package.get("files", [])
    if not isinstance(files, list):
        fail("npm pack JSON is missing files[]")
    paths = {str(item.get("path", "")) for item in files if isinstance(item, dict)}

    missing = sorted(REQUIRED_FILES - paths)
    if missing:
        fail(f"missing required npm files: {', '.join(missing)}")

    for prefix in sorted(REQUIRED_PREFIXES):
        if not any(path.startswith(prefix) for path in paths):
            fail(f"missing required npm directory prefix: {prefix}")

    forbidden = sorted(
        path for path in paths
        if any(path.startswith(prefix) for prefix in FORBIDDEN_PREFIXES)
        or any(path.endswith(suffix) for suffix in FORBIDDEN_SUFFIXES)
    )
    if forbidden:
        fail(f"forbidden files in npm package: {', '.join(forbidden[:12])}")

    print(
        json.dumps(
            {
                "name": package.get("name"),
                "version": package.get("version"),
                "filename": package.get("filename"),
                "files": len(paths),
                "size": package.get("size"),
                "unpackedSize": package.get("unpackedSize"),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
