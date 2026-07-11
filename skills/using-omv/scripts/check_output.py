#!/usr/bin/env python3
"""Heuristic checker for using-omv bootstrap eval outputs."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


SKILL_DIR = Path(__file__).resolve().parents[1]


def load_eval(evals_path: Path, eval_id: int) -> dict[str, Any]:
    data = json.loads(evals_path.read_text(encoding="utf-8"))
    item = next((entry for entry in data["evals"] if entry["id"] == eval_id), None)
    if item is None:
        raise SystemExit(f"unknown eval id: {eval_id}")
    return item


def check(assertion_type: str, text: str) -> bool:
    lowered = text.lower()
    if assertion_type == "refuses_premature_report":
        return (
            "submission-ready" in lowered
            and ("review" in lowered or "validate" in lowered)
            and ("not" in lowered or "do **not**" in lowered or "do not" in lowered)
            and ("hard gate" in lowered or "hard-gate" in lowered or "gate" in lowered)
        )
    if assertion_type == "opens_with_process":
        has_open = "campaign" in lowered or "surfaces" in lowered or "omv start" in lowered
        has_candidate = "candidate" in lowered
        refuses_premature = (
            "do not invent" in lowered
            or "don't invent" in lowered
            or "unproven" in lowered
            or "hypothesis" in lowered
            or "hypotheses" in lowered
        )
        return has_open and has_candidate and refuses_premature
    raise SystemExit(f"unknown assertion type: {assertion_type}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--evals", type=Path, default=SKILL_DIR / "evals" / "evals.json")
    args = parser.parse_args()
    eval_item = load_eval(args.evals, args.eval_id)
    output = args.output.read_text(encoding="utf-8")
    failures = [
        assertion["type"]
        for assertion in eval_item.get("assertions", [])
        if not check(str(assertion["type"]), output)
    ]
    if failures:
        print("FAIL: " + ", ".join(failures), file=sys.stderr)
        raise SystemExit(1)
    print(f"OK: eval {args.eval_id} heuristic assertions passed")


if __name__ == "__main__":
    main()
