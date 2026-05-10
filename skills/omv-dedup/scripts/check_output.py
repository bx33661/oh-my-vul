#!/usr/bin/env python3
"""Deterministic checks for omv-dedup golden outputs."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


REQUIRED = {
    0: ["NVD:", "GHSA:", "OSV:", "duplicate_risk: High", "likely duplicate", "existing_cve:"],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    text = args.output.read_text(encoding="utf-8")
    missing = [item for item in REQUIRED.get(args.eval_id, []) if item not in text]
    if missing:
        print(f"FAIL: missing {missing}", file=sys.stderr)
        raise SystemExit(1)
    print("OK: omv-dedup output")


if __name__ == "__main__":
    main()
