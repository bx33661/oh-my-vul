#!/usr/bin/env python3
"""Heuristic checker for omv-report eval outputs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


SKILL_DIR = Path(__file__).resolve().parents[1]

WRONG_VENDOR_TERMS = [
    "npm",
    "pypi",
    "pkg.go.dev",
    "crates.io",
    "rubygems",
    "maven central",
    "nuget",
    "packagist",
    "pub.dev",
    "hex",
    "cpan",
    "cran",
    "luarocks",
]

PLATFORM_FIELD_TERMS = {
    "vuldb": ["vendor", "product", "version", "class", "description"],
    "ghsa": ["ecosystem", "package name", "affected versions", "patched", "cwe"],
}


def load_eval(evals_path: Path, eval_id: int) -> dict[str, Any]:
    data = json.loads(evals_path.read_text(encoding="utf-8"))
    item = next((entry for entry in data["evals"] if entry["id"] == eval_id), None)
    if item is None:
        raise SystemExit(f"unknown eval id: {eval_id}")
    return item


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def extract_json(text: str) -> Any | None:
    stripped = text.strip()
    candidates = [stripped]
    fenced = re.findall(r"```(?:json)?\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    candidates.extend(block.strip() for block in fenced)

    for candidate in candidates:
        if not candidate:
            continue
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            continue
    return None


def values_for_key(data: Any, wanted: str) -> list[Any]:
    found: list[Any] = []
    if isinstance(data, dict):
        for key, value in data.items():
            if key == wanted:
                found.append(value)
            found.extend(values_for_key(value, wanted))
    elif isinstance(data, list):
        for item in data:
            found.extend(values_for_key(item, wanted))
    return found


def vendor_blocks(text: str) -> list[str]:
    blocks: list[str] = []
    patterns = [
        r"\*\*Vendor\*\*\s*`?([^`\n]+)`?",
        r"\*\*Vendor\*\*\s*```(?:text)?\s*(.*?)```",
        r"Vendor\s*[:\-]\s*([^\n]+)",
    ]
    for pattern in patterns:
        blocks.extend(match.strip() for match in re.findall(pattern, text, flags=re.DOTALL | re.IGNORECASE))
    return blocks


def check_vendor_not_registry(text: str) -> bool:
    vendors = vendor_blocks(text)
    if not vendors:
        return not contains_any(text, ["vendor\nnpm", "vendor: npm", "vendor\npypi", "vendor: pypi", "vendor: pkg.go.dev"])
    return all(not contains_any(vendor, WRONG_VENDOR_TERMS) for vendor in vendors)


def check_osv_json_valid(text: str) -> bool:
    data = extract_json(text)
    if not isinstance(data, dict):
        return False
    if "schema_version" not in data:
        return False
    affected = data.get("affected")
    if not isinstance(affected, list) or not affected:
        return False
    package_values = values_for_key(data, "package")
    return any(isinstance(value, dict) and value.get("ecosystem") and value.get("name") for value in package_values)


def check_osv_id_not_invented(text: str) -> bool:
    data = extract_json(text)
    if not isinstance(data, dict):
        return False
    osv_id = str(data.get("id", "TBD")).upper()
    return osv_id in {"", "TBD"} or osv_id.startswith("TBD")


def check_osv_range_present(text: str) -> bool:
    data = extract_json(text)
    if not isinstance(data, dict):
        return False
    serialized = json.dumps(data, sort_keys=True).lower()
    return "semver" in serialized and "introduced" in serialized and ("fixed" in serialized or "no fixed" in serialized)


def check_markdown_sections(text: str) -> bool:
    required = [
        "summary",
        "affected versions",
        "technical details",
        "impact",
        "proof of concept",
        "remediation",
        "disclosure timeline",
        "references",
    ]
    lowered = text.lower()
    return all(term in lowered for term in required)


def check_platform_fields(text: str) -> bool:
    lowered = text.lower()
    return all(term in lowered for terms in PLATFORM_FIELD_TERMS.values() for term in terms)


def check(assertion_type: str, text: str) -> bool:
    lowered = text.lower()

    if assertion_type == "vuldb_fields_present":
        return all(term in lowered for term in PLATFORM_FIELD_TERMS["vuldb"])
    if assertion_type == "ghsa_fields_present":
        return all(term in lowered for term in PLATFORM_FIELD_TERMS["ghsa"])
    if assertion_type == "platform_fields_present":
        return check_platform_fields(text)
    if assertion_type == "vendor_not_registry":
        return check_vendor_not_registry(text)
    if assertion_type == "version_vuldb_wording":
        return contains_any(lowered, ["up to and including", "before "]) and "latest version" not in lowered
    if assertion_type == "click_xss_medium":
        return "medium" in lowered and contains_any(lowered, ["click", "user interaction", "ui:r"])
    if assertion_type == "path_traversal_high":
        return "high" in lowered and contains_any(lowered, ["no auth", "unauthenticated", "authentication required: no"])
    if assertion_type == "duplicate_cve_warning":
        return contains_any(lowered, ["duplicate", "already exists", "existing cve", "cve-2017-18342", "rejected"])
    if assertion_type == "duplicate_cna_warning":
        return contains_any(lowered, ["duplicate cna", "duplicate cve", "cna risk", "ghsa", "do not also submit"])
    if assertion_type == "no_submission_ready_report":
        return contains_any(lowered, ["blocked", "not ready", "missing before submission", "cannot", "do not submit"]) and not (
            "vuldb form fields" in lowered and "submission-ready" in lowered
        )
    if assertion_type == "blockers_present":
        return contains_any(lowered, ["no tested version", "tested version"]) and contains_any(
            lowered, ["source to sink", "source -> sink", "data flow"]
        )
    if assertion_type == "source_sink_guard_present":
        return contains_any(lowered, ["source", "source -> sink"]) and "sink" in lowered and (
            "guard" in lowered or "blocklist" in lowered or "allowlist" in lowered or "length guard" in lowered
        )
    if assertion_type == "osv_json_valid":
        return check_osv_json_valid(text)
    if assertion_type == "osv_id_not_invented":
        return check_osv_id_not_invented(text)
    if assertion_type == "osv_range_present":
        return check_osv_range_present(text)
    if assertion_type == "cvss_vector_present":
        return "cvss:3.1/" in lowered
    if assertion_type == "markdown_advisory_sections":
        return check_markdown_sections(text)
    if assertion_type == "redos_not_rce":
        return contains_any(lowered, ["redos", "regular expression", "denial of service", "cwe-1333"]) and "rce" not in lowered
    if assertion_type == "safe_local_poc":
        return contains_any(lowered, ["localhost", "local", "minimal", "payload", "alert(document.domain)"]) and not contains_any(
            lowered, ["document.cookie", "exfiltrate", "attack live", "攻击线上"]
        )
    if assertion_type == "cwe_correct":
        return bool(re.search(r"CWE-\d+", text))

    print(f"WARN: unsupported assertion type {assertion_type}", file=sys.stderr)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--evals", type=Path, default=SKILL_DIR / "evals" / "evals.json")
    args = parser.parse_args()

    eval_item = load_eval(args.evals, args.eval_id)
    assertions = eval_item.get("assertions", [])
    if not assertions:
        raise SystemExit(f"eval {args.eval_id} has no assertions")

    output = args.output.read_text(encoding="utf-8")
    failures = []
    for assertion in assertions:
        assertion_type = assertion["type"]
        if not check(assertion_type, output):
            failures.append(assertion_type)

    if failures:
        print("FAIL:", ", ".join(failures), file=sys.stderr)
        raise SystemExit(1)

    print(f"OK: eval {args.eval_id} heuristic assertions passed")


if __name__ == "__main__":
    main()
