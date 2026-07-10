"""Load and validate canonical PatternPack.v1 manifests."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ECOSYSTEMS = (
    "npm",
    "python",
    "go",
    "rust",
    "java",
    "ruby",
    "php",
    "csharp",
    "swift",
    "dart",
    "elixir",
    "perl",
    "r",
    "lua",
)
MANIFEST_KEYS = {
    "schema_version",
    "id",
    "ecosystem",
    "aliases",
    "reference",
    "vulnerability_classes",
    "consumers",
}
SAFE_ID = re.compile(r"^[a-z][a-z0-9-]*$")


class PatternPackError(ValueError):
    """Raised when a PatternPack manifest is invalid."""


@dataclass(frozen=True)
class PatternPack:
    id: str
    ecosystem: str
    aliases: tuple[str, ...]
    reference: str
    vulnerability_classes: tuple[str, ...]
    consumers: tuple[str, ...]
    manifest_path: Path


def load_pattern_packs(root: Path = REPO_ROOT) -> list[PatternPack]:
    manifest_dir = root / "shared" / "pattern-packs"
    paths = sorted(manifest_dir.glob("*.json")) if manifest_dir.is_dir() else []
    stems = {path.stem for path in paths}
    expected = set(EXPECTED_ECOSYSTEMS)
    missing = sorted(expected - stems)
    extra = sorted(stems - expected)
    if missing or extra:
        details = []
        if missing:
            details.append(f"missing ecosystems: {', '.join(missing)}")
        if extra:
            details.append(f"unsupported ecosystems: {', '.join(extra)}")
        raise PatternPackError("PatternPack manifest set is incomplete: " + "; ".join(details))

    by_ecosystem: dict[str, PatternPack] = {}
    ids: set[str] = set()
    for path in paths:
        pack = _load_one(path, root)
        if pack.id in ids:
            raise PatternPackError(f"{path.name}: duplicate PatternPack id {pack.id}")
        ids.add(pack.id)
        if pack.ecosystem in by_ecosystem:
            raise PatternPackError(f"{path.name}: duplicate ecosystem {pack.ecosystem}")
        by_ecosystem[pack.ecosystem] = pack
    return [by_ecosystem[ecosystem] for ecosystem in EXPECTED_ECOSYSTEMS]


def pattern_asset_mappings(root: Path = REPO_ROOT) -> list[tuple[Path, Path]]:
    mappings: list[tuple[Path, Path]] = []
    for pack in load_pattern_packs(root):
        reference = root / "shared" / pack.reference
        for consumer in pack.consumers:
            skill_dir = root / "skills" / consumer
            mappings.append(
                (reference, skill_dir / "references" / "patterns" / f"{pack.ecosystem}.md")
            )
            mappings.append(
                (
                    pack.manifest_path,
                    skill_dir / "references" / "pattern-packs" / f"{pack.ecosystem}.json",
                )
            )
    return sorted(mappings, key=lambda item: (item[1].as_posix(), item[0].as_posix()))


def _load_one(path: Path, root: Path) -> PatternPack:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PatternPackError(f"{path.name}: invalid JSON: {error}") from error
    if not isinstance(value, dict):
        raise PatternPackError(f"{path.name}: manifest must be an object")
    unknown = sorted(set(value) - MANIFEST_KEYS)
    if unknown:
        raise PatternPackError(f"{path.name}: unknown fields: {', '.join(unknown)}")
    missing = sorted(MANIFEST_KEYS - set(value))
    if missing:
        raise PatternPackError(f"{path.name}: missing fields: {', '.join(missing)}")
    if value["schema_version"] != "1":
        raise PatternPackError(f"{path.name}: schema_version must be 1")

    pack_id = _safe_id(value["id"], path, "id")
    ecosystem = _safe_id(value["ecosystem"], path, "ecosystem")
    if pack_id != path.stem:
        raise PatternPackError(f"{path.name}: id must match filename {path.stem}")
    if ecosystem != path.stem:
        raise PatternPackError(f"{path.name}: ecosystem must match filename {path.stem}")

    reference = _safe_reference(value["reference"], path)
    reference_path = root / "shared" / reference
    if not reference_path.is_file():
        raise PatternPackError(f"{path.name}: reference does not exist: {reference}")
    aliases = _string_tuple(value["aliases"], path, "aliases", safe_slug=False)
    vulnerability_classes = _string_tuple(
        value["vulnerability_classes"], path, "vulnerability_classes", safe_slug=True
    )
    consumers = _string_tuple(value["consumers"], path, "consumers", safe_slug=True)
    if tuple(sorted(consumers)) != consumers:
        raise PatternPackError(f"{path.name}: consumers must be sorted")
    for consumer in consumers:
        if not (root / "skills" / consumer / "SKILL.md").is_file():
            raise PatternPackError(f"{path.name}: consumer skill does not exist: {consumer}")

    return PatternPack(
        id=pack_id,
        ecosystem=ecosystem,
        aliases=aliases,
        reference=reference,
        vulnerability_classes=vulnerability_classes,
        consumers=consumers,
        manifest_path=path,
    )


def _safe_id(value: Any, path: Path, field: str) -> str:
    if not isinstance(value, str) or not SAFE_ID.fullmatch(value):
        raise PatternPackError(f"{path.name}: {field} must be a lowercase ASCII slug")
    return value


def _safe_reference(value: Any, path: Path) -> str:
    if not isinstance(value, str) or not value or "\\" in value:
        raise PatternPackError(f"{path.name}: reference must be a safe relative POSIX path")
    parsed = PurePosixPath(value)
    if parsed.is_absolute() or ".." in parsed.parts or parsed.parts[:2] != ("references", "patterns"):
        raise PatternPackError(f"{path.name}: reference must stay under references/patterns")
    if parsed.name != f"{path.stem}.md":
        raise PatternPackError(f"{path.name}: reference filename must match ecosystem {path.stem}")
    return value


def _string_tuple(value: Any, path: Path, field: str, *, safe_slug: bool) -> tuple[str, ...]:
    if not isinstance(value, list) or not value:
        raise PatternPackError(f"{path.name}: {field} must be a non-empty list")
    items: list[str] = []
    for index, item in enumerate(value):
        if not isinstance(item, str) or not item or item != item.strip() or any(ord(char) < 32 for char in item):
            raise PatternPackError(f"{path.name}: {field}[{index}] must be canonical text")
        if safe_slug and not SAFE_ID.fullmatch(item):
            raise PatternPackError(f"{path.name}: {field}[{index}] must be a lowercase ASCII slug")
        if item in items:
            raise PatternPackError(f"{path.name}: {field}[{index}] must be unique")
        items.append(item)
    return tuple(items)
