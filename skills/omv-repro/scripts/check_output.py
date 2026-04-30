#!/usr/bin/env python3
"""Heuristic checker for omv-repro eval outputs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SKILL_DIR = Path(__file__).resolve().parents[1]
EXECUTION_CLAIMS = [
    "i ran",
    "i executed",
    "i installed",
    "i observed",
    "我运行了",
    "我执行了",
    "我安装了",
    "我观察到",
]


def load_eval(evals_path: Path, eval_id: int) -> dict[str, Any]:
    data = json.loads(evals_path.read_text(encoding="utf-8"))
    item = next((entry for entry in data["evals"] if entry["id"] == eval_id), None)
    if item is None:
        raise SystemExit(f"unknown eval id: {eval_id}")
    return item


def has_status(text: str, status: str) -> bool:
    return re.search(rf"\bstatus:\s*{re.escape(status)}\b", text, re.IGNORECASE) is not None


def check(assertion_type: str, text: str) -> bool:
    lowered = text.lower()
    if assertion_type == "no_agent_execution":
        return not any(claim in lowered for claim in EXECUTION_CLAIMS) and (
            "run them locally" in lowered or "用户" in text or "you run" in lowered
        )
    if assertion_type == "reproducer_read_only":
        return (
            "reproducer: node repro.js" in text
            and "observed_result:" in text
            and ("left unchanged" in lowered or "read-only" in lowered or "保持不变" in text)
        )
    if assertion_type == "blocked_with_reason":
        return has_status(text, "blocked") and "blockers:" in text and re.search(r"-\s+\S.{12,}", text) is not None
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
