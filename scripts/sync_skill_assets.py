#!/usr/bin/env python3
"""Sync canonical shared assets into self-contained skill directories."""

from __future__ import annotations

import argparse
import filecmp
import shutil
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]

ASSET_MAPPINGS = [
    ("registry.yaml", "skills/omv/references/registry.yaml"),
    ("shared/references/ecosystems.md", "skills/omv-find/references/shared/ecosystems.md"),
    ("shared/references/vuln-patterns.md", "skills/omv-find/references/shared/vuln-patterns.md"),
    ("shared/references/research-radar.md", "skills/omv-find/references/research-radar.md"),
    ("shared/references/pattern-packs.md", "skills/omv-find/references/pattern-packs.md"),
    ("shared/references/patterns/npm.md", "skills/omv-find/references/patterns/npm.md"),
    ("shared/references/patterns/python.md", "skills/omv-find/references/patterns/python.md"),
    ("shared/references/patterns/go.md", "skills/omv-find/references/patterns/go.md"),
    ("shared/references/patterns/rust.md", "skills/omv-find/references/patterns/rust.md"),
    ("shared/references/patterns/java.md", "skills/omv-find/references/patterns/java.md"),
    ("shared/references/patterns/ruby.md", "skills/omv-find/references/patterns/ruby.md"),
    ("shared/scripts/http_client.py", "skills/omv-find/scripts/http_client.py"),
    ("shared/scripts/collect_metadata.py", "skills/omv-find/scripts/collect_metadata.py"),
    ("shared/scripts/resolve_source_path.py", "skills/omv-find/scripts/resolve_source_path.py"),
    ("shared/scripts/estimate_loc.sh", "skills/omv-find/scripts/estimate_loc.sh"),
    ("contracts/evidence.v1.yaml", "skills/omv-find/contracts/evidence.v1.yaml"),
    ("contracts/candidate-list.v1.yaml", "skills/omv-find/contracts/candidate-list.v1.yaml"),
    ("shared/references/cvss-builder.md", "skills/omv-audit/references/shared/cvss-builder.md"),
    ("shared/references/patterns/npm.md", "skills/omv-audit/references/patterns/npm.md"),
    ("shared/references/patterns/python.md", "skills/omv-audit/references/patterns/python.md"),
    ("shared/references/patterns/go.md", "skills/omv-audit/references/patterns/go.md"),
    ("shared/references/patterns/rust.md", "skills/omv-audit/references/patterns/rust.md"),
    ("shared/references/patterns/java.md", "skills/omv-audit/references/patterns/java.md"),
    ("shared/references/patterns/ruby.md", "skills/omv-audit/references/patterns/ruby.md"),
    ("contracts/evidence.v1.yaml", "skills/omv-audit/contracts/evidence.v1.yaml"),
    ("contracts/threat-map.v1.yaml", "skills/omv-audit/contracts/threat-map.v1.yaml"),
    ("contracts/evidence.v1.yaml", "skills/omv-repro/contracts/evidence.v1.yaml"),
    ("shared/references/cvss-builder.md", "skills/omv-report/references/shared/cvss-builder.md"),
    ("contracts/evidence.v1.yaml", "skills/omv-report/contracts/evidence.v1.yaml"),
    ("contracts/evidence.v1.yaml", "skills/omv-dedup/contracts/evidence.v1.yaml"),
    ("contracts/evidence.v1.yaml", "skills/omv-disclose/contracts/evidence.v1.yaml"),
    ("contracts/submission.v1.yaml", "skills/omv-disclose/contracts/submission.v1.yaml"),
    ("contracts/evidence.v1.yaml", "skills/omv-critic/contracts/evidence.v1.yaml"),
    ("contracts/threat-map.v1.yaml", "skills/omv-critic/contracts/threat-map.v1.yaml"),
]


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def mappings() -> list[tuple[Path, Path]]:
    return [(REPO_ROOT / src, REPO_ROOT / dest) for src, dest in ASSET_MAPPINGS]


def check() -> None:
    stale: list[str] = []
    for src, dest in mappings():
        if not src.exists():
            fail(f"canonical asset missing: {src.relative_to(REPO_ROOT)}")
        if not dest.exists():
            stale.append(f"missing {dest.relative_to(REPO_ROOT)}")
        elif not filecmp.cmp(src, dest, shallow=False):
            stale.append(f"stale {dest.relative_to(REPO_ROOT)}")

    if stale:
        fail("skill assets are out of sync:\n  " + "\n  ".join(stale) + "\nRun: python3 scripts/sync_skill_assets.py")

    print("OK: skill assets are in sync")


def sync() -> None:
    for src, dest in mappings():
        if not src.exists():
            fail(f"canonical asset missing: {src.relative_to(REPO_ROOT)}")
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        print(f"sync {src.relative_to(REPO_ROOT)} -> {dest.relative_to(REPO_ROOT)}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if skill-local assets differ from canonical files")
    args = parser.parse_args()

    if args.check:
        check()
    else:
        sync()


if __name__ == "__main__":
    main()
