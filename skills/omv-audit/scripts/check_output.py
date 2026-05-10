#!/usr/bin/env python3
"""Heuristic checker for omv-audit eval outputs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SKILL_DIR = Path(__file__).resolve().parents[1]
CVSS_RE = re.compile(r"CVSS:3\.1/AV:[NALP]/AC:[LH]/PR:[NLH]/UI:[NR]/S:[UC]/C:[HLN]/I:[HLN]/A:[HLN]")
FILE_LINE_RE = re.compile(r"[\w./-]+\.[A-Za-z0-9]+:\d+")


def load_eval(evals_path: Path, eval_id: int) -> dict[str, Any]:
    data = json.loads(evals_path.read_text(encoding="utf-8"))
    item = next((entry for entry in data["evals"] if entry["id"] == eval_id), None)
    if item is None:
        raise SystemExit(f"unknown eval id: {eval_id}")
    return item


def has_status(text: str, status: str) -> bool:
    return re.search(rf"\bstatus:\s*{re.escape(status)}\b", text, re.IGNORECASE) is not None


def contains_all(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return all(term.lower() in lowered for term in terms)


def check(assertion_type: str, text: str) -> bool:
    if assertion_type == "candidate_when_observed_unknown":
        return (
            has_status(text, "candidate")
            and "observed_result: unknown" in text
            and "evidence.observed_result" in text
            and not has_status(text, "confirmed")
        )
    if assertion_type == "duplicate_blocks_promotion":
        return (
            has_status(text, "blocked")
            and contains_all(text, ["blockers", "duplicate"])
            and ("CVE-" in text or "GHSA" in text or "existing_cve" in text)
        )
    if assertion_type == "confirmed_complete_evidence":
        return (
            has_status(text, "confirmed")
            and len(FILE_LINE_RE.findall(text)) >= 2
            and contains_all(text, ["source:", "sink:", "guard:", "reproducer:", "observed_result:", "dedup:"])
            and CVSS_RE.search(text) is not None
            and contains_all(text, ["nvd_searched: true", "ghsa_searched: true", "ecosystem_db_searched: true"])
        )
    if assertion_type == "guard_bypass_documented":
        return (
            has_status(text, "confirmed")
            and "guard:" in text
            and ("bypass" in text.lower() or "bypassable" in text.lower())
            and len(FILE_LINE_RE.findall(text)) >= 2
        )
    if assertion_type == "blocked_inaccessible_source":
        return (
            has_status(text, "blocked")
            and contains_all(text, ["blockers", "source code"])
            and text.lower().count("unknown") >= 5
            and "unverified_fields" in text
        )
    if assertion_type == "critical_scope_change":
        return (
            has_status(text, "confirmed")
            and CVSS_RE.search(text) is not None
            and "S:C" in text
            and any(float(m) >= 9.0 for m in re.findall(r"score:\s*([\d.]+)", text))
        )
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
