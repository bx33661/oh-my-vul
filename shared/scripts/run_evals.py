#!/usr/bin/env python3
"""Run existing skill eval checkers through one deterministic interface."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import asdict, dataclass
from pathlib import Path, PurePosixPath
from typing import Any, Sequence


REPO_ROOT = Path(__file__).resolve().parents[2]
SAFE_SKILL = re.compile(r"^[a-z0-9][a-z0-9-]*$")
MANIFEST_KEYS = {"schema_version", "cases"}
CASE_KEYS = {"id", "skill", "eval_id", "checker", "output"}


class EvalConfigurationError(ValueError):
    """Raised when eval configuration is incomplete or unsafe."""


@dataclass(frozen=True)
class EvalCase:
    id: str
    skill: str
    eval_id: int
    checker: Path
    output: Path
    root: Path


@dataclass(frozen=True)
class EvalResult:
    id: str
    skill: str
    eval_id: int
    passed: bool
    duration_ms: int
    stdout: str
    stderr: str


def load_stable_cases(root: Path = REPO_ROOT, manifest_path: Path | None = None) -> list[EvalCase]:
    root = root.resolve()
    path = (manifest_path or root / "shared" / "evals" / "stable.json").resolve()
    _require_below_root(path, root, "manifest")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise EvalConfigurationError(f"manifest cannot be read: {path}: {error}") from error
    if not isinstance(value, dict):
        raise EvalConfigurationError("manifest must be an object")
    _reject_unknown(value, MANIFEST_KEYS, "manifest")
    if value.get("schema_version") != "1":
        raise EvalConfigurationError("manifest schema_version must be 1")
    raw_cases = value.get("cases")
    if not isinstance(raw_cases, list) or not raw_cases:
        raise EvalConfigurationError("manifest cases must be a non-empty list")

    cases: list[EvalCase] = []
    ids: set[str] = set()
    for index, raw in enumerate(raw_cases):
        if not isinstance(raw, dict):
            raise EvalConfigurationError(f"cases[{index}] must be an object")
        _reject_unknown(raw, CASE_KEYS, f"cases[{index}]")
        missing = sorted(CASE_KEYS - set(raw))
        if missing:
            raise EvalConfigurationError(f"cases[{index}] missing fields: {', '.join(missing)}")
        case_id = _canonical_text(raw["id"], f"cases[{index}].id")
        if case_id in ids:
            raise EvalConfigurationError(f"duplicate eval case id: {case_id}")
        ids.add(case_id)
        skill = _safe_skill(raw["skill"])
        eval_id = _eval_id(raw["eval_id"])
        checker = _manifest_file(root, raw["checker"], f"cases[{index}].checker")
        output = _manifest_file(root, raw["output"], f"cases[{index}].output")
        expected_prefix = (root / "skills" / skill / "scripts").resolve()
        _require_below_root(checker, expected_prefix, f"cases[{index}].checker")
        cases.append(EvalCase(case_id, skill, eval_id, checker, output, root))
    return cases


def build_targeted_case(root: Path, skill: str, eval_id: int, output: Path) -> EvalCase:
    root = root.resolve()
    safe_skill = _safe_skill(skill)
    normalized_id = _eval_id(eval_id)
    checker = root / "skills" / safe_skill / "scripts" / "check_output.py"
    if not checker.is_file():
        raise EvalConfigurationError(f"skill checker does not exist: {checker}")
    output_path = output.expanduser().resolve()
    if not output_path.is_file():
        raise EvalConfigurationError(f"eval output does not exist: {output_path}")
    return EvalCase(
        id=f"{safe_skill}-{normalized_id}",
        skill=safe_skill,
        eval_id=normalized_id,
        checker=checker,
        output=output_path,
        root=root,
    )


def run_cases(cases: Sequence[EvalCase]) -> list[EvalResult]:
    results: list[EvalResult] = []
    for case in cases:
        started = time.perf_counter()
        process = subprocess.run(
            [
                sys.executable,
                str(case.checker),
                "--eval-id",
                str(case.eval_id),
                "--output",
                str(case.output),
            ],
            cwd=case.root,
            capture_output=True,
            text=True,
            check=False,
        )
        duration_ms = max(0, round((time.perf_counter() - started) * 1000))
        results.append(
            EvalResult(
                id=case.id,
                skill=case.skill,
                eval_id=case.eval_id,
                passed=process.returncode == 0,
                duration_ms=duration_ms,
                stdout=process.stdout,
                stderr=process.stderr,
            )
        )
    return results


def summarize(results: Sequence[EvalResult]) -> dict[str, Any]:
    passed = sum(1 for result in results if result.passed)
    failed = len(results) - passed
    return {
        "schema_version": "1",
        "ok": failed == 0,
        "total": len(results),
        "passed": passed,
        "failed": failed,
        "duration_ms": sum(result.duration_ms for result in results),
    }


def render_json(results: Sequence[EvalResult]) -> str:
    payload = summarize(results)
    payload["results"] = [asdict(result) for result in results]
    return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def render_junit(results: Sequence[EvalResult]) -> str:
    summary = summarize(results)
    suite = ET.Element(
        "testsuite",
        {
            "name": "oh-my-vul-evals",
            "tests": str(summary["total"]),
            "failures": str(summary["failed"]),
            "errors": "0",
            "time": f"{int(summary['duration_ms']) / 1000:.3f}",
        },
    )
    for result in results:
        case = ET.SubElement(
            suite,
            "testcase",
            {
                "classname": result.skill,
                "name": result.id,
                "time": f"{result.duration_ms / 1000:.3f}",
            },
        )
        if not result.passed:
            failure = ET.SubElement(case, "failure", {"message": "eval checker failed"})
            failure.text = (result.stderr or result.stdout).strip()
        if result.stdout:
            ET.SubElement(case, "system-out").text = result.stdout
        if result.stderr:
            ET.SubElement(case, "system-err").text = result.stderr
    return ET.tostring(suite, encoding="unicode", xml_declaration=True) + "\n"


def render_human(results: Sequence[EvalResult]) -> str:
    lines = []
    for result in results:
        state = "PASS" if result.passed else "FAIL"
        lines.append(f"[{state}] {result.id} ({result.duration_ms} ms)")
        if not result.passed:
            detail = (result.stderr or result.stdout).strip()
            if detail:
                lines.extend(f"  {line}" for line in detail.splitlines())
    summary = summarize(results)
    lines.append(
        f"evals: {summary['passed']}/{summary['total']} passed, "
        f"{summary['failed']} failed ({summary['duration_ms']} ms)"
    )
    return "\n".join(lines) + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run oh-my-vul skill eval checks")
    parser.add_argument("--format", choices=["human", "json", "junit"], default="human")
    parser.add_argument("--manifest", type=Path)
    parser.add_argument("--skill")
    parser.add_argument("--eval-id", type=int)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args(argv)
    targeted = [args.skill is not None, args.eval_id is not None, args.output is not None]
    try:
        if any(targeted) and not all(targeted):
            raise EvalConfigurationError("--skill, --eval-id, and --output must be supplied together")
        if all(targeted):
            if args.manifest is not None:
                raise EvalConfigurationError("--manifest cannot be combined with targeted options")
            cases = [build_targeted_case(REPO_ROOT, args.skill, args.eval_id, args.output)]
        else:
            cases = load_stable_cases(REPO_ROOT, args.manifest)
        results = run_cases(cases)
    except EvalConfigurationError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2

    if args.format == "json":
        sys.stdout.write(render_json(results))
    elif args.format == "junit":
        sys.stdout.write(render_junit(results))
    else:
        sys.stdout.write(render_human(results))
    return 0 if all(result.passed for result in results) else 1


def _manifest_file(root: Path, value: Any, field: str) -> Path:
    text = _canonical_text(value, field)
    path = PurePosixPath(text)
    if path.is_absolute() or ".." in path.parts or "\\" in text:
        raise EvalConfigurationError(f"{field} must be a safe package-relative path")
    resolved = (root / text).resolve()
    _require_below_root(resolved, root, field)
    if not resolved.is_file():
        raise EvalConfigurationError(f"{field} does not exist: {text}")
    return resolved


def _require_below_root(path: Path, root: Path, field: str) -> None:
    try:
        path.resolve().relative_to(root.resolve())
    except ValueError as error:
        raise EvalConfigurationError(f"{field} path escapes the package root: {path}") from error


def _safe_skill(value: Any) -> str:
    if not isinstance(value, str) or not SAFE_SKILL.fullmatch(value):
        raise EvalConfigurationError("skill must be a lowercase package name")
    return value


def _eval_id(value: Any) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise EvalConfigurationError("eval_id must be a non-negative integer")
    return value


def _canonical_text(value: Any, field: str) -> str:
    if not isinstance(value, str) or not value or value != value.strip() or any(ord(char) < 32 for char in value):
        raise EvalConfigurationError(f"{field} must be canonical single-line text")
    return value


def _reject_unknown(value: dict[str, Any], allowed: set[str], field: str) -> None:
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise EvalConfigurationError(f"{field} has unknown fields: {', '.join(unknown)}")


if __name__ == "__main__":
    raise SystemExit(main())
