#!/usr/bin/env python3
"""Run release-time checks and emit package metadata."""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_SCRIPT = REPO_ROOT / "scripts" / "package_skill.sh"
VALIDATE_SCRIPT = REPO_ROOT / "scripts" / "validate_skill.py"


def run(args: list[str]) -> None:
    subprocess.run(args, cwd=REPO_ROOT, check=True)


def skill_dirs() -> list[Path]:
    return sorted(
        child
        for child in REPO_ROOT.iterdir()
        if child.is_dir() and (child / "SKILL.md").exists()
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def package_metadata(path: Path) -> dict[str, object]:
    return {
        "file": path.name,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--write-artifacts",
        action="store_true",
        help="write root-level .skill artifacts instead of using a temporary directory",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        help="optional path for a JSON package manifest",
    )
    args = parser.parse_args()

    skills = skill_dirs()
    if not skills:
        raise SystemExit("no skill directories found")

    run([sys.executable, str(VALIDATE_SCRIPT)])

    artifacts: list[Path] = []
    if args.write_artifacts:
        for skill in skills:
            out = REPO_ROOT / f"{skill.name}.skill"
            run(["bash", str(PACKAGE_SCRIPT), skill.name, str(out)])
            artifacts.append(out)
    else:
        with tempfile.TemporaryDirectory(prefix="vulnflow-release-") as tmp:
            tmpdir = Path(tmp)
            for skill in skills:
                out = tmpdir / f"{skill.name}.skill"
                run(["bash", str(PACKAGE_SCRIPT), skill.name, str(out)])
                artifacts.append(out)

            manifest = {
                "skills": [skill.name for skill in skills],
                "artifacts": [package_metadata(path) for path in artifacts],
            }
            print(json.dumps(manifest, indent=2, sort_keys=True))
            if args.manifest:
                args.manifest.write_text(
                    json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                    encoding="utf-8",
                )
            return

    manifest = {
        "skills": [skill.name for skill in skills],
        "artifacts": [package_metadata(path) for path in artifacts],
    }
    print(json.dumps(manifest, indent=2, sort_keys=True))
    if args.manifest:
        args.manifest.write_text(
            json.dumps(manifest, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )


if __name__ == "__main__":
    main()
