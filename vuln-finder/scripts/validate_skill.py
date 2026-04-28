#!/usr/bin/env python3
"""Validate the vuln-finder skill layout and optional .skill package."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]
VALID_NAME = re.compile(r"^[a-z0-9-]{1,64}$")


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_frontmatter(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail("SKILL.md must start with YAML frontmatter")
    try:
        _, raw_frontmatter, body = text.split("---\n", 2)
    except ValueError:
        fail("SKILL.md must contain closing frontmatter delimiter")

    data: dict[str, str] = {}
    current_key: str | None = None
    current_lines: list[str] = []

    for line in raw_frontmatter.splitlines():
        match = re.match(r"^([a-zA-Z0-9_-]+):(?:\s*(\|)?\s*(.*))?$", line)
        if match:
            if current_key is not None:
                data[current_key] = "\n".join(current_lines).strip()
            current_key = match.group(1).strip()
            current_lines = []
            literal = match.group(2)
            value = (match.group(3) or "").strip()
            if value and not literal:
                current_lines.append(value)
        elif current_key is not None and line.startswith("  "):
            current_lines.append(line[2:])
        elif line.strip():
            fail(f"unsupported frontmatter line: {line}")

    if current_key is not None:
        data[current_key] = "\n".join(current_lines).strip()

    return data, body


def validate_skill_md() -> None:
    skill_md = SKILL_DIR / "SKILL.md"
    if not skill_md.exists():
        fail("missing SKILL.md")

    frontmatter, body = parse_frontmatter(skill_md)
    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")

    if not VALID_NAME.match(name):
        fail("frontmatter name must be 1-64 chars of lowercase letters, digits, or hyphens")
    if not description:
        fail("frontmatter description is required")
    if len(description) > 1024:
        fail(f"frontmatter description is {len(description)} chars; maximum is 1024")

    referenced = sorted(set(re.findall(r"`(references/[^`]+\.md)`", body)))
    if not referenced:
        fail("SKILL.md should reference at least one references/*.md file")
    for rel in referenced:
        if not (SKILL_DIR / rel).exists():
            fail(f"missing referenced file: {rel}")

    required_scripts = [
        "scripts/validate_skill.py",
        "scripts/package_skill.sh",
        "scripts/collect_metadata.py",
        "scripts/estimate_loc.sh",
        "scripts/check_output.py",
    ]
    for rel in required_scripts:
        if not (SKILL_DIR / rel).exists():
            fail(f"missing script: {rel}")


def validate_evals() -> None:
    path = SKILL_DIR / "evals" / "evals.json"
    if not path.exists():
        fail("missing evals/evals.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("skill_name") != "vuln-finder":
        fail("evals skill_name must be vuln-finder")
    evals = data.get("evals")
    if not isinstance(evals, list) or not evals:
        fail("evals must be a non-empty list")

    ids: list[int] = []
    for index, item in enumerate(evals):
        if not isinstance(item, dict):
            fail(f"eval at index {index} must be an object")
        for key in ("id", "prompt", "expected_output", "assertions"):
            if key not in item:
                fail(f"eval {index} missing {key}")
        if not isinstance(item["assertions"], list) or not item["assertions"]:
            fail(f"eval {item.get('id')} must have assertions")
        ids.append(item["id"])
        for assertion in item["assertions"]:
            if "type" not in assertion or "text" not in assertion:
                fail(f"eval {item.get('id')} has malformed assertion")

    if len(ids) != len(set(ids)):
        fail("eval ids must be unique")
    if ids != sorted(ids):
        fail("eval ids should be sorted for stable diffs")


def is_package_source(path: Path) -> bool:
    return "__pycache__" not in path.parts and path.suffix not in {".pyc", ".pyo"}


def validate_package(path: Path) -> None:
    if not path.exists():
        fail(f"package not found: {path}")
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()

    package_files = {name for name in names if not name.endswith("/")}
    generated = sorted(
        name for name in package_files if "__pycache__/" in name or name.endswith((".pyc", ".pyo"))
    )
    if generated:
        fail(f"package contains generated Python cache files: {', '.join(generated)}")

    required = {"SKILL.md"}
    for dirname in ("references", "scripts", "evals"):
        root = SKILL_DIR / dirname
        if not root.exists():
            fail(f"missing package source directory: {dirname}")
        required.update(
            str(file.relative_to(SKILL_DIR))
            for file in root.rglob("*")
            if file.is_file() and is_package_source(file)
        )

    missing = sorted(required - package_files)
    if missing:
        fail(f"package missing entries: {', '.join(missing)}")
    nested = [name for name in names if name.startswith("vuln-finder/")]
    if nested:
        fail("package contains nested vuln-finder/ entries; rebuild from inside the skill directory")
    duplicates = [name for name in names if names.count(name) > 1]
    if duplicates:
        fail(f"package contains duplicate entries: {sorted(set(duplicates))}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package", type=Path, help="Optional .skill package to validate")
    args = parser.parse_args()

    validate_skill_md()
    validate_evals()
    if args.package:
        validate_package(args.package.resolve())

    print("OK: skill structure is valid")


if __name__ == "__main__":
    main()
