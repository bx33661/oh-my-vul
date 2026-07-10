from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from .pattern_packs import (
    EXPECTED_ECOSYSTEMS,
    PatternPackError,
    load_pattern_packs,
    pattern_asset_mappings,
)
from .release_check import validate_pattern_registry
from .sync_skill_assets import mappings as sync_mappings


class PatternPackTests(unittest.TestCase):
    def test_repository_has_fourteen_complete_unique_packs(self) -> None:
        root = Path(__file__).resolve().parents[1]
        packs = load_pattern_packs(root)

        self.assertEqual([pack.ecosystem for pack in packs], list(EXPECTED_ECOSYSTEMS))
        self.assertEqual(len({pack.id for pack in packs}), 14)
        for pack in packs:
            self.assertTrue((root / "shared" / pack.reference).is_file())
            self.assertTrue(pack.vulnerability_classes)
            self.assertEqual(pack.consumers, ("omv-audit", "omv-find"))

    def test_asset_mappings_are_derived_for_every_declared_consumer(self) -> None:
        root = Path(__file__).resolve().parents[1]
        mappings = {
            (source.relative_to(root).as_posix(), destination.relative_to(root).as_posix())
            for source, destination in pattern_asset_mappings(root)
        }

        self.assertEqual(len(mappings), 14 * 2 * 2)
        for ecosystem in EXPECTED_ECOSYSTEMS:
            for consumer in ("omv-audit", "omv-find"):
                self.assertIn(
                    (
                        f"shared/references/patterns/{ecosystem}.md",
                        f"skills/{consumer}/references/patterns/{ecosystem}.md",
                    ),
                    mappings,
                )

    def test_skill_sync_includes_every_manifest_derived_mapping(self) -> None:
        root = Path(__file__).resolve().parents[1]
        expected = set(pattern_asset_mappings(root))
        self.assertTrue(expected.issubset(set(sync_mappings())))

    def test_skill_local_manifests_resolve_their_runtime_references(self) -> None:
        root = Path(__file__).resolve().parents[1]
        for pack in load_pattern_packs(root):
            for consumer in pack.consumers:
                skill_root = root / "skills" / consumer
                manifest_path = skill_root / "references" / "pattern-packs" / f"{pack.ecosystem}.json"
                value = json.loads(manifest_path.read_text(encoding="utf-8"))
                self.assertTrue(
                    (skill_root / value["reference"]).is_file(),
                    f"{manifest_path} has unresolved reference {value['reference']}",
                )

    def test_release_pattern_validation_loads_manifests_from_the_selected_root(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-pattern-packs-") as tmp:
            root = Path(tmp)
            self._write_complete_fixture(root)
            with self.assertRaisesRegex(SystemExit, r"npm\.md missing Source pattern"):
                validate_pattern_registry(root)
                self.assertIn(
                    (
                        f"shared/pattern-packs/{ecosystem}.json",
                        f"skills/{consumer}/references/pattern-packs/{ecosystem}.json",
                    ),
                    mappings,
                )

    def test_loader_rejects_unknown_keys_and_unsafe_reference_paths(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-pattern-packs-") as tmp:
            root = Path(tmp)
            self._write_complete_fixture(root)
            path = root / "shared/pattern-packs/npm.json"
            value = json.loads(path.read_text(encoding="utf-8"))
            value["invented"] = True
            path.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(PatternPackError, r"npm\.json.*unknown.*invented"):
                load_pattern_packs(root)

            del value["invented"]
            value["reference"] = "../outside.md"
            path.write_text(json.dumps(value), encoding="utf-8")
            with self.assertRaisesRegex(PatternPackError, r"npm\.json.*reference"):
                load_pattern_packs(root)

    def test_loader_rejects_duplicate_ids_and_incomplete_ecosystem_sets(self) -> None:
        with tempfile.TemporaryDirectory(prefix="omv-pattern-packs-") as tmp:
            root = Path(tmp)
            self._write_complete_fixture(root)
            java_path = root / "shared/pattern-packs/java.json"
            java = json.loads(java_path.read_text(encoding="utf-8"))
            java["id"] = "npm"
            java_path.write_text(json.dumps(java), encoding="utf-8")
            with self.assertRaisesRegex(PatternPackError, r"duplicate.*npm|id.*java"):
                load_pattern_packs(root)

            java_path.unlink()
            with self.assertRaisesRegex(PatternPackError, r"missing.*java"):
                load_pattern_packs(root)

    @staticmethod
    def _write_complete_fixture(root: Path) -> None:
        for consumer in ("omv-audit", "omv-find"):
            skill_dir = root / "skills" / consumer
            skill_dir.mkdir(parents=True, exist_ok=True)
            (skill_dir / "SKILL.md").write_text(f"---\nname: {consumer}\n---\n", encoding="utf-8")
        for ecosystem in EXPECTED_ECOSYSTEMS:
            reference = root / "shared" / "references" / "patterns" / f"{ecosystem}.md"
            reference.parent.mkdir(parents=True, exist_ok=True)
            reference.write_text("# fixture\n", encoding="utf-8")
            manifest = root / "shared" / "pattern-packs" / f"{ecosystem}.json"
            manifest.parent.mkdir(parents=True, exist_ok=True)
            manifest.write_text(
                json.dumps(
                    {
                        "schema_version": "1",
                        "id": ecosystem,
                        "ecosystem": ecosystem,
                        "aliases": [ecosystem],
                        "reference": f"references/patterns/{ecosystem}.md",
                        "vulnerability_classes": ["path-traversal"],
                        "consumers": ["omv-audit", "omv-find"],
                    }
                ),
                encoding="utf-8",
            )


if __name__ == "__main__":
    unittest.main()
