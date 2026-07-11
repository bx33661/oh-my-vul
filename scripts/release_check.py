#!/usr/bin/env python3
"""Run release-time checks and emit package metadata."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from .pattern_packs import load_pattern_packs
except ImportError:
    from pattern_packs import load_pattern_packs


REPO_ROOT = Path(__file__).resolve().parents[1]
PACKAGE_SCRIPT = REPO_ROOT / "scripts" / "package_skill.py"
VALIDATE_SCRIPT = REPO_ROOT / "scripts" / "validate_skill.py"
SYNC_SCRIPT = REPO_ROOT / "scripts" / "sync_skill_assets.py"
SYNC_METADATA_SCRIPT = REPO_ROOT / "scripts" / "sync_metadata.py"
METHODOLOGY_SCRIPT = REPO_ROOT / "scripts" / "check_methodology_guidance.py"
RENDERER_FIXTURE = "skills/omv-report/evals/fixtures/confirmed-prototype-pollution.yaml"
RENDERER_FORMATS = ["vuldb", "ghsa", "osv", "md"]


def run(args: list[str]) -> None:
    subprocess.run(args, cwd=REPO_ROOT, check=True)


IGNORED_DIRS = {".git", ".github", ".claude", "scripts", "__pycache__", "shared", "agents", "contracts"}


def skill_dirs() -> list[Path]:
    dirs = []
    # root-level skill directories (legacy layout)
    for child in sorted(REPO_ROOT.iterdir()):
        if child.is_dir() and child.name not in IGNORED_DIRS and child.name != "skills":
            if (child / "SKILL.md").exists():
                dirs.append(child)
    # skills/ subdirectories (oh-my-vul layout)
    skills_root = REPO_ROOT / "skills"
    if skills_root.is_dir():
        for child in sorted(skills_root.iterdir()):
            if child.is_dir() and (child / "SKILL.md").exists():
                dirs.append(child)
    return dirs


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


def registry_version(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("version:"):
            return stripped.split(":", 1)[1].strip().strip('"').strip("'")
    raise SystemExit(f"missing version in {path}")


def validate_versions() -> None:
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    package_version = str(package.get("version", ""))
    registry = registry_version(REPO_ROOT / "registry.yaml")

    versions = {
        "package.json": package_version,
        "registry.yaml": registry,
    }

    lock_path = REPO_ROOT / "package-lock.json"
    if lock_path.exists():
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        versions["package-lock.json"] = str(lock.get("version", ""))
        root_package = lock.get("packages", {}).get("", {})
        versions['package-lock.json packages[""]'] = str(root_package.get("version", ""))

    unique_versions = set(versions.values())
    if len(unique_versions) != 1:
        details = ", ".join(f"{name}={version}" for name, version in versions.items())
        raise SystemExit(f"version mismatch: {details}")

    print(f"OK: version {package_version}", flush=True)


def exported_names(text: str, *, type_only: bool) -> set[str]:
    prefix = r"export\s+type\s*" if type_only else r"export\s+(?!type\b)"
    blocks = re.findall(prefix + r"\{([^}]+)\}\s+from", text, flags=re.MULTILINE)
    names: set[str] = set()
    for block in blocks:
        for raw in block.split(","):
            name = raw.strip().split(" as ")[-1].strip()
            if name:
                names.add(name)
    return names


def validate_public_node_api() -> None:
    inventory_path = REPO_ROOT / "contracts" / "node-api.v1.json"
    inventory = json.loads(inventory_path.read_text(encoding="utf-8"))
    package = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    exports = package.get("exports")
    if not isinstance(exports, dict) or sorted(exports) != sorted(inventory.get("entrypoints", [])):
        raise SystemExit("package exports do not match contracts/node-api.v1.json")

    declaration_path = REPO_ROOT / "dist" / "index.d.ts"
    declaration = declaration_path.read_text(encoding="utf-8")
    declared_runtime = exported_names(declaration, type_only=False)
    declared_types = exported_names(declaration, type_only=True)
    expected_runtime = set(inventory.get("runtime_exports", []))
    expected_types = set(inventory.get("type_exports", []))
    if declared_runtime != expected_runtime:
        raise SystemExit(
            "public runtime declaration drift: "
            f"missing={sorted(expected_runtime - declared_runtime)} "
            f"unexpected={sorted(declared_runtime - expected_runtime)}"
        )
    if declared_types != expected_types:
        raise SystemExit(
            "public type declaration drift: "
            f"missing={sorted(expected_types - declared_types)} "
            f"unexpected={sorted(declared_types - expected_types)}"
        )

    result = subprocess.run(
        [
            "node",
            "--input-type=module",
            "--eval",
            "import('./dist/index.js').then(m => console.log(JSON.stringify(Object.keys(m).sort())))",
        ],
        cwd=REPO_ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    runtime = set(json.loads(result.stdout))
    if runtime != expected_runtime:
        raise SystemExit(
            "public runtime export drift: "
            f"missing={sorted(expected_runtime - runtime)} unexpected={sorted(runtime - expected_runtime)}"
        )
    print(f"OK: public Node API ({len(runtime)} runtime, {len(expected_types)} type exports)", flush=True)


def validate_compatibility_inventories() -> None:
    contracts_dir = REPO_ROOT / "contracts"
    artifact_inventory = json.loads((contracts_dir / "artifact-contracts.v1.json").read_text(encoding="utf-8"))
    artifacts = artifact_inventory.get("contracts", [])
    if not isinstance(artifacts, list):
        raise SystemExit("artifact contract inventory must contain contracts[]")
    inventoried_files = {str(item.get("file", "")) for item in artifacts if isinstance(item, dict)}
    canonical_files = {path.name for path in contracts_dir.glob("*.v[0-9].yaml")}
    if inventoried_files != canonical_files:
        raise SystemExit(
            "artifact contract inventory drift: "
            f"missing={sorted(canonical_files - inventoried_files)} "
            f"unexpected={sorted(inventoried_files - canonical_files)}"
        )
    for item in artifacts:
        if not isinstance(item, dict) or item.get("compatibility_mode") not in {"closed", "extensible"}:
            raise SystemExit("artifact contracts must declare closed or extensible compatibility_mode")

    json_inventory = json.loads((contracts_dir / "cli-json.v1.json").read_text(encoding="utf-8"))
    commands = json_inventory.get("commands", [])
    if not isinstance(commands, list):
        raise SystemExit("CLI JSON inventory must contain commands[]")
    command_names = [str(item.get("command", "")) for item in commands if isinstance(item, dict)]
    if len(command_names) != len(set(command_names)):
        raise SystemExit("CLI JSON inventory contains duplicate commands")
    allowed_types = {"array", "boolean", "null", "number", "object", "string"}
    for item in commands:
        if not isinstance(item, dict) or item.get("result_kind") not in {"array", "object"}:
            raise SystemExit("CLI JSON command must declare array or object result_kind")
        for key in ("required", "item_required"):
            fields = item.get(key, {})
            if not isinstance(fields, dict) or not set(fields.values()).issubset(allowed_types):
                raise SystemExit(f"CLI JSON {item.get('command')} has invalid {key} field types")

    usage = (REPO_ROOT / "src" / "cli" / "usage.ts").read_text(encoding="utf-8")
    match = re.search(r"export const PUBLIC_JSON_COMMANDS = \[(.*?)\] as const;", usage, flags=re.DOTALL)
    if not match:
        raise SystemExit("PUBLIC_JSON_COMMANDS metadata is missing")
    public_commands = re.findall(r'"([^"]+)"', match.group(1))
    if command_names != public_commands:
        raise SystemExit("CLI JSON inventory does not match PUBLIC_JSON_COMMANDS metadata")
    print(f"OK: compatibility inventories ({len(artifacts)} artifacts, {len(commands)} JSON commands)", flush=True)


def validate_stable_evals() -> None:
    run([sys.executable, str(REPO_ROOT / "shared" / "scripts" / "run_evals.py")])


def validate_pattern_registry(root: Path = REPO_ROOT) -> None:
    required = [
        "Source pattern:",
        "Sink signature:",
        "Common misuse:",
        "Expected guard:",
        "Evidence criteria:",
        "False-positive checks:",
        "CWE:",
    ]
    packs = load_pattern_packs(root)
    for pack in packs:
        path = root / "shared" / pack.reference
        text = path.read_text(encoding="utf-8")
        for marker in required:
            if marker not in text:
                raise SystemExit(f"{path.relative_to(root)} missing {marker}")
    print(f"OK: {len(packs)} PatternPack registries", flush=True)


def validate_renderer() -> None:
    renderer = REPO_ROOT / "skills/omv-report/scripts/render_template.py"
    fixture = REPO_ROOT / RENDERER_FIXTURE
    golden_dir = REPO_ROOT / "skills/omv-report/evals/golden"

    for fmt in RENDERER_FORMATS:
        ext = "json" if fmt == "osv" else "md"
        golden = golden_dir / f"render-{fmt}.{ext}"
        if not golden.exists():
            raise SystemExit(f"missing renderer golden: {golden}")

        result = subprocess.run(
            [sys.executable, str(renderer), "--finding", str(fixture), "--format", fmt],
            capture_output=True,
            text=True,
            encoding="utf-8",
            cwd=REPO_ROOT,
        )
        if result.returncode != 0:
            raise SystemExit(
                f"renderer failed for --format {fmt}:\n{result.stderr.strip()}"
            )

        actual = result.stdout
        expected = golden.read_text(encoding="utf-8")
        if actual != expected:
            raise SystemExit(
                f"renderer golden mismatch for --format {fmt}\n"
                f"Re-run with Python 3: {renderer} --finding {fixture} --format {fmt}"
            )

    print(f"OK: renderer golden tests passed ({', '.join(RENDERER_FORMATS)})", flush=True)


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

    run([sys.executable, str(SYNC_METADATA_SCRIPT), "--check"])
    run([sys.executable, str(SYNC_SCRIPT), "--check"])
    validate_versions()
    validate_public_node_api()
    validate_compatibility_inventories()
    validate_pattern_registry()
    run([sys.executable, str(METHODOLOGY_SCRIPT)])
    run([sys.executable, str(VALIDATE_SCRIPT)])
    validate_stable_evals()
    validate_renderer()

    artifacts: list[Path] = []
    if args.write_artifacts:
        for skill in skills:
            out = REPO_ROOT / f"{skill.name}.skill"
            run([sys.executable, str(PACKAGE_SCRIPT), str(skill), str(out)])
            artifacts.append(out)
    else:
        with tempfile.TemporaryDirectory(prefix="omv-release-") as tmp:
            tmpdir = Path(tmp)
            for skill in skills:
                out = tmpdir / f"{skill.name}.skill"
                run([sys.executable, str(PACKAGE_SCRIPT), str(skill), str(out)])
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
