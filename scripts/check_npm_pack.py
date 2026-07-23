#!/usr/bin/env python3
"""Validate npm tarball contents before publishing."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

try:
    from .pattern_packs import load_pattern_packs
except ImportError:
    from pattern_packs import load_pattern_packs


REPO_ROOT = Path(__file__).resolve().parents[1]

REQUIRED_FILES = {
    "package.json",
    "README.md",
    "README.zh-CN.md",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "SECURITY.md",
    "LICENSE",
    "dist/cli/omv.js",
    "dist/index.js",
    "registry.yaml",
    "contracts/evidence.v1.yaml",
    "contracts/node-api.v1.json",
    "contracts/cli-json.v1.json",
    "contracts/artifact-contracts.v1.json",
    "contracts/campaign.v1.yaml",
    "contracts/source-ref.v1.yaml",
    "contracts/report-provenance.v1.yaml",
    "contracts/candidate-list.v1.yaml",
    "contracts/submission.v1.yaml",
    "contracts/threat-map.v1.yaml",
    "docs/vulnerability-research-best-practices.zh-CN.md",
    "skills/using-omv/SKILL.md",
    "skills/omv/SKILL.md",
    "skills/omv-find/SKILL.md",
    "skills/omv-audit/SKILL.md",
    "skills/omv-repro/SKILL.md",
    "skills/omv-report/SKILL.md",
    "skills/omv-radar/SKILL.md",
    "skills/omv-dedup/SKILL.md",
    "skills/omv-disclose/SKILL.md",
    "skills/omv-critic/SKILL.md",
    "shared/scripts/collect_metadata.py",
    "shared/scripts/estimate_loc.mjs",
    "shared/scripts/http_client.py",
    "shared/scripts/resolve_source_path.py",
    "shared/scripts/run_evals.py",
    "shared/evals/stable.json",
    "shared/references/patterns/npm.md",
    "shared/references/research-radar.md",
    "shared/references/pattern-packs.md",
}

REQUIRED_PREFIXES = {
    "agents/",
    "contracts/",
    "docs/",
    "skills/omv/",
    "skills/omv-find/",
    "skills/omv-audit/",
    "skills/omv-repro/",
    "skills/omv-report/",
    "skills/omv-radar/",
    "skills/omv-dedup/",
    "skills/omv-disclose/",
    "skills/omv-critic/",
    "shared/",
}

FORBIDDEN_PREFIXES = {
    ".omv/",
    ".codex/",
    ".agents/",
    ".github/",
    "dist/cli/__tests__/",
    "node_modules/",
    "src/",
    "scripts/",
}

FORBIDDEN_SUFFIXES = {
    ".pyc",
    ".pyd",
    ".pyo",
    ".skill",
    ".tgz",
}

PUBLIC_DECLARATIONS = {
    "dist/index.d.ts",
    "dist/cli/campaign-seed.d.ts",
    "dist/cli/campaign.d.ts",
    "dist/cli/doctor.d.ts",
    "dist/cli/findings.d.ts",
    "dist/cli/report-provenance.d.ts",
    "dist/cli/review.d.ts",
    "dist/cli/setup.d.ts",
    "dist/cli/source-ref.d.ts",
    "dist/cli/start.d.ts",
    "dist/cli/submissions.d.ts",
    "dist/cli/threatmap.d.ts",
    "dist/cli/verification.d.ts",
    "dist/cli/workflow.d.ts",
    "dist/cli/workspace.d.ts",
}

COMPILED_SUFFIXES = (".d.ts.map", ".d.ts", ".js.map", ".js")


def fail(message: str) -> None:
    print(f"FAIL: {message}", file=sys.stderr)
    raise SystemExit(1)


def npm_pack() -> dict[str, object]:
    result = subprocess.run(
        ["npm.cmd" if os.name == "nt" else "npm", "pack", "--json", "--dry-run"],
        cwd=REPO_ROOT,
        check=True,
        text=True,
        stdout=subprocess.PIPE,
    )
    parsed = json.loads(result.stdout)
    if not isinstance(parsed, list) or len(parsed) != 1 or not isinstance(parsed[0], dict):
        fail("unexpected npm pack JSON shape")
    return parsed[0]


def expected_command_files() -> set[str]:
    command_sources = (REPO_ROOT / "src" / "cli" / "commands").glob("*.ts")
    return {f"dist/cli/commands/{source.stem}.js" for source in command_sources}


def expected_pattern_pack_files() -> set[str]:
    expected: set[str] = set()
    for pack in load_pattern_packs(REPO_ROOT):
        expected.add(pack.manifest_path.relative_to(REPO_ROOT).as_posix())
        expected.add(f"shared/{pack.reference}")
        for consumer in pack.consumers:
            expected.add(f"skills/{consumer}/references/pattern-packs/{pack.ecosystem}.json")
            expected.add(f"skills/{consumer}/references/patterns/{pack.ecosystem}.md")
    return expected


def stale_cli_files(paths: set[str]) -> list[str]:
    source_stems_by_output_dir = {
        "dist/cli": {source.stem for source in (REPO_ROOT / "src" / "cli").glob("*.ts")},
        "dist/cli/commands": {
            source.stem for source in (REPO_ROOT / "src" / "cli" / "commands").glob("*.ts")
        },
    }
    stale: list[str] = []
    for path in paths:
        compiled = Path(path)
        source_stems = source_stems_by_output_dir.get(compiled.parent.as_posix())
        if source_stems is None:
            continue
        for suffix in COMPILED_SUFFIXES:
            if compiled.name.endswith(suffix):
                if compiled.name.removesuffix(suffix) not in source_stems:
                    stale.append(path)
                break
    return sorted(stale)


def main() -> None:
    package_json = json.loads((REPO_ROOT / "package.json").read_text(encoding="utf-8"))
    exports = package_json.get("exports")
    if not isinstance(exports, dict) or set(exports) != {".", "./package.json"}:
        fail("package exports must contain only the root API and package.json")

    keywords = package_json.get("keywords")
    if not isinstance(keywords, list) or "pi-package" not in keywords:
        fail("package keywords must include pi-package for Pi gallery discovery")

    pi_manifest = package_json.get("pi")
    if not isinstance(pi_manifest, dict) or pi_manifest.get("skills") != ["./skills"]:
        fail("package pi.skills must declare the canonical ./skills directory")

    package = npm_pack()
    files = package.get("files", [])
    if not isinstance(files, list):
        fail("npm pack JSON is missing files[]")
    paths = {str(item.get("path", "")) for item in files if isinstance(item, dict)}

    missing = sorted(REQUIRED_FILES - paths)
    if missing:
        fail(f"missing required npm files: {', '.join(missing)}")

    pi_skill_entries = {
        path.relative_to(REPO_ROOT).as_posix()
        for path in (REPO_ROOT / "skills").glob("*/SKILL.md")
    }
    missing_pi_skills = sorted(pi_skill_entries - paths)
    if missing_pi_skills:
        fail(f"missing Pi skill entries: {', '.join(missing_pi_skills)}")
    if len(pi_skill_entries) != 10:
        fail(f"expected 10 canonical Pi skills, found {len(pi_skill_entries)}")

    missing_patterns = sorted(expected_pattern_pack_files() - paths)
    if missing_patterns:
        fail(f"missing PatternPack npm files: {', '.join(missing_patterns[:12])}")

    missing_commands = sorted(expected_command_files() - paths)
    if missing_commands:
        fail(f"missing compiled command modules: {', '.join(missing_commands)}")

    missing_declarations = sorted(PUBLIC_DECLARATIONS - paths)
    if missing_declarations:
        fail(f"missing public declarations: {', '.join(missing_declarations)}")

    for prefix in sorted(REQUIRED_PREFIXES):
        if not any(path.startswith(prefix) for path in paths):
            fail(f"missing required npm directory prefix: {prefix}")

    forbidden = sorted(
        path for path in paths
        if any(path.startswith(prefix) for prefix in FORBIDDEN_PREFIXES)
        or any(path.endswith(suffix) for suffix in FORBIDDEN_SUFFIXES)
        or path.endswith(".map")
        or (path.endswith(".d.ts") and path not in PUBLIC_DECLARATIONS)
    )
    if forbidden:
        fail(f"forbidden files in npm package: {', '.join(forbidden[:12])}")

    stale = stale_cli_files(paths)
    if stale:
        fail(f"compiled CLI files without matching sources: {', '.join(stale[:12])}")

    print(
        json.dumps(
            {
                "name": package.get("name"),
                "version": package.get("version"),
                "filename": package.get("filename"),
                "files": len(paths),
                "piSkills": len(pi_skill_entries),
                "size": package.get("size"),
                "unpackedSize": package.get("unpackedSize"),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
