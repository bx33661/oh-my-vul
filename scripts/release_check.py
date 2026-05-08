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
SYNC_SCRIPT = REPO_ROOT / "scripts" / "sync_skill_assets.py"
SYNC_METADATA_SCRIPT = REPO_ROOT / "scripts" / "sync_metadata.py"
STABLE_EVAL_CHECKS = [
    ("skills/omv/scripts/check_output.py", "0", "skills/omv/evals/golden/next-workflow.md"),
    ("skills/omv/scripts/check_output.py", "1", "skills/omv/evals/golden/archive-delegation.md"),
    ("skills/omv-audit/scripts/check_output.py", "0", "skills/omv-audit/evals/golden/incomplete-observed-result.md"),
    ("skills/omv-audit/scripts/check_output.py", "1", "skills/omv-audit/evals/golden/duplicate-blocked.md"),
    ("skills/omv-audit/scripts/check_output.py", "2", "skills/omv-audit/evals/golden/confirmed-complete.md"),
    ("skills/omv-repro/scripts/check_output.py", "0", "skills/omv-repro/evals/golden/no-agent-execution.md"),
    ("skills/omv-repro/scripts/check_output.py", "1", "skills/omv-repro/evals/golden/read-only-reproducer.md"),
    ("skills/omv-repro/scripts/check_output.py", "2", "skills/omv-repro/evals/golden/blocked-repro-failure.md"),
]

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


def validate_stable_evals() -> None:
    for script, eval_id, output in STABLE_EVAL_CHECKS:
        run([
            sys.executable,
            str(REPO_ROOT / script),
            "--eval-id",
            eval_id,
            "--output",
            str(REPO_ROOT / output),
        ])


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
                f"Re-run: python3 {renderer} --finding {fixture} --format {fmt}"
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
    run([sys.executable, str(VALIDATE_SCRIPT)])
    validate_stable_evals()
    validate_renderer()

    artifacts: list[Path] = []
    if args.write_artifacts:
        for skill in skills:
            out = REPO_ROOT / f"{skill.name}.skill"
            run(["bash", str(PACKAGE_SCRIPT), str(skill), str(out)])
            artifacts.append(out)
    else:
        with tempfile.TemporaryDirectory(prefix="omv-release-") as tmp:
            tmpdir = Path(tmp)
            for skill in skills:
                out = tmpdir / f"{skill.name}.skill"
                run(["bash", str(PACKAGE_SCRIPT), str(skill), str(out)])
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
