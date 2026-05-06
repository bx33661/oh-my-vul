#!/usr/bin/env python3
"""Check public guidance stays methodology-first and fixture-oriented."""

from __future__ import annotations

import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCAN_GLOBS = [
    "README.md",
    "CONTRIBUTING.md",
    "skills/*/SKILL.md",
    "skills/*/evals/evals.json",
    "shared/references/**/*.md",
    "docs/examples/**/*.md",
    "skills/*/evals/golden/*",
]
SANITIZED_MARKERS = {
    "sanitized",
    "synthetic",
    "fixture",
    "demo",
    "example",
    "format",
    "schema",
    "placeholder",
    "tbd",
    "xxxx",
    "2099",
}
IDENTIFIER_PATTERNS = [
    re.compile(r"\bCVE-\d{4}-\d{4,}\b"),
    re.compile(r"\bGHSA-[0-9a-z]{4}-[0-9a-z]{4}-[0-9a-z]{4}\b", re.IGNORECASE),
]
BANNED_REAL_CASE_TERMS = [
    "CVE-2017-18342",
    "PyYAML 6.0",
]


def iter_files() -> list[Path]:
    files: set[Path] = set()
    for pattern in SCAN_GLOBS:
        files.update(path for path in REPO_ROOT.glob(pattern) if path.is_file())
    return sorted(files)


def has_sanitized_context(lines: list[str], index: int) -> bool:
    start = max(0, index - 3)
    end = min(len(lines), index + 4)
    context = "\n".join(lines[start:end]).lower()
    return any(marker in context for marker in SANITIZED_MARKERS)


def check_file(path: Path) -> list[str]:
    rel = path.relative_to(REPO_ROOT)
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    findings: list[str] = []

    for term in BANNED_REAL_CASE_TERMS:
        if term in text and "user-provided" not in text.lower():
            findings.append(f"{rel}: contains real case term {term}; use sanitized fixture wording")

    for index, line in enumerate(lines):
        for pattern in IDENTIFIER_PATTERNS:
            if pattern.search(line) and not has_sanitized_context(lines, index):
                findings.append(
                    f"{rel}:{index + 1}: advisory identifier lacks sanitized/fixture/format context: {line.strip()}"
                )

    return findings


def main() -> None:
    findings: list[str] = []
    for path in iter_files():
        findings.extend(check_file(path))

    if findings:
        print("FAIL: public guidance contains unsanitized concrete vulnerability examples:", file=sys.stderr)
        for finding in findings:
            print(f"  {finding}", file=sys.stderr)
        raise SystemExit(1)

    print("OK: methodology-first public guidance")


if __name__ == "__main__":
    main()
