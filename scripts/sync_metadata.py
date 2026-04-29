#!/usr/bin/env python3
"""Synchronize package, registry, and README metadata."""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
INSTALLABLE_STATUSES = {"active", "internal", "stable"}


@dataclass
class Skill:
    name: str
    category: str
    invocation: str
    status: str
    description: str


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def load_package() -> dict[str, object]:
    return json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))


def parse_scalar(value: str) -> str:
    value = re.sub(r"\s+#.*$", "", value).strip()
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    return value


def parse_registry(text: str) -> tuple[dict[str, str], list[Skill]]:
    metadata: dict[str, str] = {}
    skills: list[Skill] = []
    in_skills = False
    current: dict[str, str] | None = None

    for line in text.splitlines():
        if not in_skills:
            match = re.match(r"^([a-z_]+):\s*(.+)$", line)
            if match:
                metadata[match.group(1)] = parse_scalar(match.group(2))
            if line.strip() == "skills:":
                in_skills = True
            continue

        if re.match(r"^[a-z_]+:", line):
            break

        item = re.match(r"^  - name:\s*(.+)$", line)
        if item:
            if current:
                skills.append(skill_from_dict(current))
            current = {"name": parse_scalar(item.group(1))}
            continue

        if current is None:
            continue

        field = re.match(r"^    ([a-z_]+):\s*(.*)$", line)
        if field:
            key, value = field.groups()
            if key in {"category", "invocation", "status", "description"}:
                current[key] = parse_scalar(value)

    if current:
        skills.append(skill_from_dict(current))

    return metadata, skills


def skill_from_dict(data: dict[str, str]) -> Skill:
    return Skill(
        name=data.get("name", ""),
        category=data.get("category", ""),
        invocation=data.get("invocation", ""),
        status=data.get("status", ""),
        description=data.get("description", ""),
    )


def registry_text() -> str:
    return (REPO_ROOT / "registry.yaml").read_text(encoding="utf-8")


def installable_skills() -> list[Skill]:
    _, skills = parse_registry(registry_text())
    return [skill for skill in skills if skill.status in INSTALLABLE_STATUSES]


def extract_aliases() -> list[str]:
    skill_md = (REPO_ROOT / "skills" / "omv-find" / "SKILL.md").read_text(encoding="utf-8")
    match = re.search(r"Valid vulnerability aliases:\s*(.+)", skill_md)
    if not match:
        fail("could not find vulnerability aliases in skills/omv-find/SKILL.md")
    return re.findall(r"`([^`]+)`", match.group(1))


def wrap_words(words: list[str], width: int = 80) -> str:
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = word if not current else f"{current} {word}"
        if len(candidate) > width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return "\n".join(lines)


def skill_count_phrase(count: int) -> str:
    words = {1: "one", 2: "two", 3: "three"}
    return words.get(count, str(count))


def render_skill_table(skills: list[Skill]) -> str:
    rows = [
        "<!-- omv:skills:start -->",
        "| Skill | Command | Category | Purpose |",
        "|---|---|---|---|",
    ]
    rows.extend(
        f"| `{skill.name}` | `{skill.invocation}` | {skill.category} | {skill.description} |"
        for skill in skills
    )
    rows.append("<!-- omv:skills:end -->")
    return "\n".join(rows)


def replace_between_markers(text: str, start: str, end: str, replacement: str) -> str:
    pattern = re.compile(rf"{re.escape(start)}.*?{re.escape(end)}", re.DOTALL)
    if not pattern.search(text):
        fail(f"missing metadata markers: {start} / {end}")
    return pattern.sub(replacement, text)


def sync_readme(content: str, package: dict[str, object], skills: list[Skill], aliases: list[str]) -> str:
    package_name = str(package["name"])
    skill_count = skill_count_phrase(len(skills))

    content = re.sub(
        r"https://img\.shields\.io/npm/v/[^)\]]+",
        f"https://img.shields.io/npm/v/{package_name}",
        content,
    )
    content = re.sub(
        r"https://www\.npmjs\.com/package/[^)\]]+",
        f"https://www.npmjs.com/package/{package_name}",
        content,
    )
    content = re.sub(
        r"This installs [a-z0-9-]+ self-contained skills",
        f"This installs {skill_count} self-contained skills",
        content,
    )
    content = replace_between_markers(
        content,
        "<!-- omv:skills:start -->",
        "<!-- omv:skills:end -->",
        render_skill_table(skills),
    )
    content = re.sub(
        r"(Supported `--vuln` aliases:\n\n```text\n).*?(\n```)",
        rf"\1{wrap_words(aliases)}\2",
        content,
        flags=re.DOTALL,
    )
    return content


def sync_registry(content: str, package: dict[str, object]) -> str:
    version = str(package["version"])
    return re.sub(r'^version:\s*".*"$', f'version: "{version}"', content, count=1, flags=re.MULTILINE)


def sync_package_lock(content: str, package: dict[str, object]) -> str:
    data = json.loads(content)
    version = package["version"]
    data["version"] = version
    if "" in data.get("packages", {}):
        data["packages"][""]["version"] = version
    return json.dumps(data, indent=2) + "\n"


def planned_changes() -> list[tuple[Path, str]]:
    package = load_package()
    skills = installable_skills()
    aliases = extract_aliases()

    changes: list[tuple[Path, str]] = []
    files = [
        (REPO_ROOT / "README.md", lambda text: sync_readme(text, package, skills, aliases)),
        (REPO_ROOT / "registry.yaml", lambda text: sync_registry(text, package)),
        (REPO_ROOT / "package-lock.json", lambda text: sync_package_lock(text, package)),
    ]

    for path, syncer in files:
        if not path.exists():
            continue
        current = path.read_text(encoding="utf-8")
        updated = syncer(current)
        if updated != current:
            changes.append((path, updated))
    return changes


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if metadata is out of sync")
    args = parser.parse_args()

    changes = planned_changes()
    if args.check:
        if changes:
            fail("metadata is out of sync:\n  " + "\n  ".join(str(path.relative_to(REPO_ROOT)) for path, _ in changes) + "\nRun: python3 scripts/sync_metadata.py")
        print("OK: metadata is in sync")
        return

    for path, updated in changes:
        path.write_text(updated, encoding="utf-8")
        print(f"sync {path.relative_to(REPO_ROOT)}")
    if not changes:
        print("OK: metadata is already in sync")


if __name__ == "__main__":
    main()
