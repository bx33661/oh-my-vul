#!/usr/bin/env python3
"""Validate skill directories and optional packaged .skill archives."""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
VALID_NAME = re.compile(r"^[a-z0-9-]{1,64}$")
IGNORED_DIRS = {".git", ".github", ".claude", "scripts", "__pycache__", "shared", "agents", "contracts"}


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_frontmatter(path: Path) -> tuple[dict[str, str], str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        fail(f"{path}: SKILL.md must start with YAML frontmatter")
    try:
        _, raw_frontmatter, body = text.split("---\n", 2)
    except ValueError:
        fail(f"{path}: SKILL.md must contain closing frontmatter delimiter")

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
                current_lines.append(value.strip('"'))
        elif current_key is not None and line.startswith("  "):
            current_lines.append(line[2:])
        elif line.strip():
            fail(f"{path}: unsupported frontmatter line: {line}")

    if current_key is not None:
        data[current_key] = "\n".join(current_lines).strip()

    return data, body


def discover_skill_dirs() -> list[Path]:
    dirs = []
    # scan root-level skill directories (legacy layout)
    for child in sorted(REPO_ROOT.iterdir()):
        if not child.is_dir() or child.name in IGNORED_DIRS or child.name == "skills":
            continue
        if (child / "SKILL.md").exists():
            dirs.append(child)
    # scan skills/ subdirectories (oh-my-vul layout)
    skills_root = REPO_ROOT / "skills"
    if skills_root.is_dir():
        for child in sorted(skills_root.iterdir()):
            if child.is_dir() and (child / "SKILL.md").exists():
                dirs.append(child)
    if not dirs:
        fail("no skill directories found (checked root level and skills/)")
    return dirs


def resolve_skill_dirs(values: list[str]) -> list[Path]:
    if not values:
        return discover_skill_dirs()

    dirs = []
    for value in values:
        path = Path(value)
        if not path.is_absolute():
            path = REPO_ROOT / path
        path = path.resolve()
        if not path.is_dir():
            fail(f"skill directory not found: {value}")
        if not (path / "SKILL.md").exists():
            fail(f"missing SKILL.md in {value}")
        dirs.append(path)
    return dirs


def is_package_source(path: Path) -> bool:
    return (
        "__pycache__" not in path.parts
        and ".git" not in path.parts
        and ".claude" not in path.parts
        and path.suffix not in {".pyc", ".pyo"}
    )


def validate_skill_md(skill_dir: Path) -> str:
    skill_md = skill_dir / "SKILL.md"
    frontmatter, body = parse_frontmatter(skill_md)
    name = frontmatter.get("name", "")
    description = frontmatter.get("description", "")

    if not VALID_NAME.match(name):
        fail(f"{skill_dir.name}: frontmatter name must be 1-64 lowercase letters, digits, or hyphens")
    if name != skill_dir.name:
        fail(f"{skill_dir.name}: frontmatter name must match directory name")
    if not description:
        fail(f"{skill_dir.name}: frontmatter description is required")
    if len(description) > 1024:
        fail(f"{skill_dir.name}: frontmatter description is {len(description)} chars; maximum is 1024")

    referenced = sorted(
        set(
            re.findall(
                r"`((?:references|contracts|scripts)/[^`]+(?:\.md|\.yaml|\.yml|\.py|\.mjs|\.sh))`",
                body,
            )
        )
    )
    upward_refs = sorted(set(re.findall(r"`(\.\./[^`]+)`", body)))
    if upward_refs:
        fail(f"{skill_dir.name}: SKILL.md must use package-local paths, not upward references: {', '.join(upward_refs)}")
    if not referenced and (skill_dir / "references").exists():
        fail(f"{skill_dir.name}: SKILL.md should reference at least one references/*.md file")
    for rel in referenced:
        resolved = (skill_dir / rel).resolve()
        if not resolved.exists():
            fail(f"{skill_dir.name}: missing referenced file: {rel}")

    return name


def validate_evals(skill_dir: Path, skill_name: str) -> None:
    evals_dir = skill_dir / "evals"
    if not evals_dir.exists():
        return

    path = evals_dir / "evals.json"
    if not path.exists():
        fail(f"{skill_name}: missing evals/evals.json")
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"{skill_name}: invalid evals/evals.json: {exc}")

    if data.get("skill_name") != skill_name:
        fail(f"{skill_name}: evals skill_name must be {skill_name}")
    evals = data.get("evals")
    if not isinstance(evals, list) or not evals:
        fail(f"{skill_name}: evals must be a non-empty list")

    ids: list[int] = []
    for index, item in enumerate(evals):
        if not isinstance(item, dict):
            fail(f"{skill_name}: eval at index {index} must be an object")
        for key in ("id", "prompt", "expected_output"):
            if key not in item:
                fail(f"{skill_name}: eval {index} missing {key}")
        if not isinstance(item["id"], int):
            fail(f"{skill_name}: eval {index} id must be an integer")
        ids.append(item["id"])
        if "assertions" in item and not isinstance(item["assertions"], list):
            fail(f"{skill_name}: eval {item['id']} assertions must be a list when present")
        if "files" in item and not isinstance(item["files"], list):
            fail(f"{skill_name}: eval {item['id']} files must be a list when present")

    if len(ids) != len(set(ids)):
        fail(f"{skill_name}: eval ids must be unique")
    if ids != sorted(ids):
        fail(f"{skill_name}: eval ids should be sorted for stable diffs")


def required_package_files(skill_dir: Path) -> set[str]:
    required = {"SKILL.md"}
    for dirname in ("references", "scripts", "evals", "contracts"):
        root = skill_dir / dirname
        if not root.exists():
            continue
        required.update(
            file.relative_to(skill_dir).as_posix()
            for file in root.rglob("*")
            if file.is_file() and is_package_source(file)
        )
    return required


def validate_package(skill_dir: Path, package: Path, skill_name: str) -> None:
    if not package.exists():
        fail(f"{skill_name}: package not found: {package}")
    with zipfile.ZipFile(package) as archive:
        names = archive.namelist()

    package_files = {name for name in names if not name.endswith("/")}
    generated = sorted(
        name
        for name in package_files
        if "__pycache__/" in name
        or name.endswith((".pyc", ".pyo"))
        or name.startswith((".git/", ".claude/"))
    )
    if generated:
        fail(f"{skill_name}: package contains generated or local files: {', '.join(generated)}")

    missing = sorted(required_package_files(skill_dir) - package_files)
    if missing:
        fail(f"{skill_name}: package missing entries: {', '.join(missing)}")

    nested_prefix = f"{skill_name}/"
    nested = [name for name in names if name.startswith(nested_prefix)]
    if nested:
        fail(f"{skill_name}: package contains nested {nested_prefix} entries; rebuild from inside the skill directory")

    duplicates = [name for name in names if names.count(name) > 1]
    if duplicates:
        fail(f"{skill_name}: package contains duplicate entries: {sorted(set(duplicates))}")


def validate_skill(skill_dir: Path, package: Path | None) -> None:
    skill_name = validate_skill_md(skill_dir)
    validate_evals(skill_dir, skill_name)
    if package:
        validate_package(skill_dir, package.resolve(), skill_name)
    print(f"OK: {skill_name}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("skill_dirs", nargs="*", help="Skill directories to validate; defaults to all root-level skills")
    parser.add_argument("--package", type=Path, help="Optional .skill package to validate; only valid with one skill")
    args = parser.parse_args()

    skill_dirs = resolve_skill_dirs(args.skill_dirs)
    if args.package and len(skill_dirs) != 1:
        fail("--package can only be used with exactly one skill directory")

    for skill_dir in skill_dirs:
        validate_skill(skill_dir, args.package)


if __name__ == "__main__":
    main()
