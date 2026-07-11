#!/usr/bin/env python3
"""Build and validate a cross-platform .skill archive."""

from __future__ import annotations

import subprocess
import sys
import zipfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
INCLUDED_DIRS = ("references", "scripts", "evals", "contracts")
IGNORED_PARTS = {"__pycache__", ".git", ".claude"}
IGNORED_SUFFIXES = {".pyc", ".pyo"}


def include(path: Path) -> bool:
    return not IGNORED_PARTS.intersection(path.parts) and path.suffix not in IGNORED_SUFFIXES


def main() -> None:
    if len(sys.argv) not in {2, 3}:
        raise SystemExit("Usage: package_skill.py <skill-dir> [output.skill]")

    skill_dir = Path(sys.argv[1])
    if not skill_dir.is_absolute():
        skill_dir = REPO_ROOT / skill_dir
    skill_dir = skill_dir.resolve()
    if not (skill_dir / "SKILL.md").is_file():
        raise SystemExit(f"Missing SKILL.md in {skill_dir}")

    output = Path(sys.argv[2]).resolve() if len(sys.argv) == 3 else REPO_ROOT / f"{skill_dir.name}.skill"
    output.unlink(missing_ok=True)
    files = [skill_dir / "SKILL.md"]
    for dirname in INCLUDED_DIRS:
        root = skill_dir / dirname
        if root.is_dir():
            files.extend(path for path in root.rglob("*") if path.is_file() and include(path.relative_to(skill_dir)))

    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(files):
            archive.write(path, path.relative_to(skill_dir).as_posix())

    subprocess.run(
        [sys.executable, str(REPO_ROOT / "scripts" / "validate_skill.py"), str(skill_dir), "--package", str(output)],
        cwd=REPO_ROOT,
        check=True,
    )
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
