#!/usr/bin/env python3
"""Deterministic skeleton renderer for omv-report.

Input:  Evidence.v1 YAML (--finding) + output format (--format)
Output: Filled report skeleton on stdout; prose fields carry [DRAFT: ...] markers.

Usage:
  python3 render_template.py --finding .omv/findings/demo.yaml --format vuldb
  python3 render_template.py --finding .omv/findings/demo.yaml --format ghsa
  python3 render_template.py --finding .omv/findings/demo.yaml --format osv
  python3 render_template.py --finding .omv/findings/demo.yaml --format md

Gates (bypassed with --force):
  - status must be 'confirmed'
  - submission_score must be >= 75
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml


GHSA_ECOSYSTEM: dict[str, str] = {
    "npm": "npm", "python": "pip", "go": "Go", "rust": "Rust",
    "java": "Maven", "ruby": "RubyGems", "php": "Composer",
    "csharp": "NuGet", "swift": "Swift", "dart": "Pub",
    "elixir": "Erlang", "perl": "CPAN", "r": "CRAN", "lua": "LuaRocks",
}

OSV_ECOSYSTEM: dict[str, str] = {
    "npm": "npm", "python": "PyPI", "go": "Go", "rust": "crates.io",
    "java": "Maven", "ruby": "RubyGems", "php": "Packagist",
    "csharp": "NuGet", "swift": "Swift", "dart": "Pub",
    "elixir": "Hex", "perl": "CPAN", "r": "CRAN", "lua": "LuaRocks",
}


def is_set(value: Any) -> bool:
    """True when a field has a real value (not unknown/empty/None/false)."""
    if value is None:
        return False
    s = str(value).strip().lower()
    return s not in ("", "unknown", "none", "false", "[]", "{}")


def draft(instruction: str) -> str:
    return f"[DRAFT: {instruction}]"


def isodate(date_str: str) -> str:
    """Convert a YYYY-MM-DD string to ISO 8601 with time component."""
    stripped = date_str.strip()
    if stripped and stripped != "unknown" and "T" not in stripped:
        return f"{stripped}T00:00:00Z"
    return stripped or "[DRAFT: YYYY-MM-DDT00:00:00Z]"


@dataclass
class Finding:
    # Identity
    status: str = ""
    researcher_goal: str = "VulDB"
    # Package
    ecosystem: str = ""
    registry_name: str = ""
    repository_url: str = ""
    vendor: str = ""
    product: str = ""
    # Versions
    tested: str = ""
    affected_range: str = "unknown"
    fixed: str = "unknown"
    # Vulnerability
    vuln_class: str = ""
    cwe: str = ""
    affected_component: str = ""
    affected_function: str = ""
    # Evidence
    source: str = "unknown"
    sink: str = "unknown"
    guard: str = "unknown"
    reproducer: str = "unknown"
    observed_result: str = "unknown"
    repro_artifacts: list[str] = field(default_factory=list)
    # CVSS
    cvss_vector: str = "unknown"
    cvss_score: str = "unknown"
    cvss_severity: str = "unknown"
    # Impact
    auth_required: str = "unknown"
    user_interaction: str = "unknown"
    scope_changed: str = "unknown"
    confidentiality: str = "unknown"
    integrity: str = "unknown"
    availability: str = "unknown"
    # Dedup
    nvd_searched: bool = False
    ghsa_searched: bool = False
    ecosystem_db_searched: bool = False
    existing_cve: str = "unknown"
    dedup_notes: str = ""
    # Disclosure
    vendor_contacted: bool = False
    contact_date: str = "unknown"
    vendor_response: str = "unknown"
    planned_disclosure_date: str = "unknown"
    # Verdict
    exploitability: str = "unknown"
    confidence: str = "unknown"
    verdict_reason: str = ""
    # Blockers
    blockers: list[str] = field(default_factory=list)
    # Provenance
    verification_date: str = ""
    researcher: str = ""
    # Scores (computed)
    evidence_score: int = 0
    submission_score: int = 0


def load_finding(path: Path) -> Finding:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))

    f = Finding()
    f.status = str(data.get("status", ""))
    f.researcher_goal = str(data.get("researcher_goal", "VulDB"))

    pkg = data.get("package") or {}
    f.ecosystem = str(pkg.get("ecosystem", ""))
    f.registry_name = str(pkg.get("registry_name", ""))
    f.repository_url = str(pkg.get("repository_url", ""))
    f.vendor = str(pkg.get("vendor", ""))
    f.product = str(pkg.get("product", ""))

    ver = data.get("versions") or {}
    f.tested = str(ver.get("tested", ""))
    f.affected_range = str(ver.get("affected_range", "unknown"))
    f.fixed = str(ver.get("fixed", "unknown"))

    vuln = data.get("vulnerability") or {}
    f.vuln_class = str(vuln.get("class", ""))
    f.cwe = str(vuln.get("cwe", ""))
    f.affected_component = str(vuln.get("affected_component", ""))
    f.affected_function = str(vuln.get("affected_function", ""))

    ev = data.get("evidence") or {}
    f.source = str(ev.get("source", "unknown"))
    f.sink = str(ev.get("sink", "unknown"))
    f.guard = str(ev.get("guard", "unknown"))
    f.reproducer = str(ev.get("reproducer", "unknown"))
    f.observed_result = str(ev.get("observed_result", "unknown"))
    f.repro_artifacts = list(ev.get("repro_artifacts") or [])

    cvss = data.get("cvss") or {}
    f.cvss_vector = str(cvss.get("vector", "unknown"))
    f.cvss_score = str(cvss.get("score", "unknown"))
    f.cvss_severity = str(cvss.get("severity", "unknown"))

    impact = data.get("impact") or {}
    f.auth_required = str(impact.get("authentication_required", "unknown"))
    f.user_interaction = str(impact.get("user_interaction_required", "unknown"))
    f.scope_changed = str(impact.get("scope_changed", "unknown"))
    f.confidentiality = str(impact.get("confidentiality", "unknown"))
    f.integrity = str(impact.get("integrity", "unknown"))
    f.availability = str(impact.get("availability", "unknown"))

    dedup = data.get("dedup") or {}
    f.nvd_searched = bool(dedup.get("nvd_searched", False))
    f.ghsa_searched = bool(dedup.get("ghsa_searched", False))
    f.ecosystem_db_searched = bool(dedup.get("ecosystem_db_searched", False))
    f.existing_cve = str(dedup.get("existing_cve", "unknown"))
    f.dedup_notes = str(dedup.get("notes", ""))

    disc = data.get("disclosure") or {}
    f.vendor_contacted = bool(disc.get("vendor_contacted", False))
    f.contact_date = str(disc.get("contact_date", "unknown"))
    f.vendor_response = str(disc.get("vendor_response", "unknown"))
    f.planned_disclosure_date = str(disc.get("planned_disclosure_date", "unknown"))

    verdict = data.get("verdict") or {}
    f.exploitability = str(verdict.get("exploitability", "unknown"))
    f.confidence = str(verdict.get("confidence", "unknown"))
    f.verdict_reason = str(verdict.get("reason", ""))

    f.blockers = list(data.get("blockers") or [])

    prov = data.get("provenance") or {}
    f.verification_date = str(prov.get("verification_date", ""))
    f.researcher = str(prov.get("researcher", ""))

    f.evidence_score, f.submission_score = _compute_scores(f)
    return f


def _compute_scores(f: Finding) -> tuple[int, int]:
    """Mirror contracts/evidence.v1.yaml scoring guide."""
    ev = 0
    if is_set(f.tested):
        ev += 20
    if is_set(f.source):
        ev += 10
    if is_set(f.sink):
        ev += 10
    if is_set(f.guard):
        ev += 10
    if is_set(f.reproducer) and f.reproducer.strip().lower() != "none":
        ev += 15
    if is_set(f.observed_result):
        ev += 10
    if is_set(f.cvss_vector):
        ev += 10
    if f.nvd_searched and f.ghsa_searched and f.ecosystem_db_searched:
        ev += 10
    if f.vendor_contacted:
        ev += 5

    sub = ev
    if f.blockers:
        sub -= min(30, len(f.blockers) * 15)
    if not is_set(f.observed_result):
        sub -= 20
    if not is_set(f.affected_range):
        sub -= 15
    if not (f.nvd_searched and f.ghsa_searched and f.ecosystem_db_searched):
        sub -= 10
    if f.exploitability in ("blocked", "disproven"):
        sub -= 30
    if not is_set(f.tested):
        sub -= 20

    return ev, max(0, min(100, sub))


def _score_line(f: Finding) -> str:
    return (
        f"Rendered by omv render_template  |  evidence: {f.evidence_score}/100"
        f"  |  submission: {f.submission_score}/100  |  status: {f.status}"
    )


def _ssg_block(f: Finding) -> list[str]:
    lines = []
    lines.append(f"- Source: {f.source if is_set(f.source) else draft('attacker-controlled input entry point')}")
    lines.append(f"- Sink:   {f.sink if is_set(f.sink) else draft('dangerous operation reached')}")
    lines.append(f"- Guard:  {f.guard if is_set(f.guard) else draft('check that is missing or bypassable')}")
    return lines


def _version_vuldb(f: Finding) -> str:
    if is_set(f.affected_range):
        return f.affected_range
    if is_set(f.tested):
        return f"up to and including {f.tested}"
    return draft("affected version range, e.g. 'up to and including X.Y.Z'")


# ── Renderers ─────────────────────────────────────────────────────────────────

def render_vuldb(f: Finding) -> str:
    comp = f"{f.affected_component} {f.affected_function}".strip()
    description_hint = (
        f"Write continuous prose: affected component ({comp or '?'}), "
        f"root cause ({f.guard if is_set(f.guard) else '?'}), "
        f"attacker action, impact ({f.cvss_severity} {f.cvss_score}), "
        f"attack requirements (Auth:{f.auth_required} UI:{f.user_interaction}), and suggested fix."
    )
    lines = [
        "## VulDB Form Fields",
        "",
        "**Vendor**",
        f.vendor or draft("project owner, GitHub org, company, or author — not the registry name"),
        "",
        "**Product**",
        f.product or draft("package or product name"),
        "",
        "**Version**",
        _version_vuldb(f),
        "",
        "**Class**",
        f.vuln_class or draft("plain English vulnerability class name, not the CWE number"),
        "",
        "**Description**",
        draft(description_hint),
        "",
    ]

    if is_set(f.source) or is_set(f.sink) or is_set(f.guard):
        lines.append("Source → Sink → Guard:")
        lines += _ssg_block(f)
        lines.append("")

    if is_set(f.observed_result):
        lines.append(f"Observed result: {f.observed_result}")
        lines.append("")

    if is_set(f.reproducer) and f.reproducer.strip().lower() != "none":
        lines.append("Reproducer:")
        for line in f.reproducer.splitlines():
            lines.append(f"  {line}")
        lines.append("")

    lines += [
        "**Advisory / Exploit**",
        f.repository_url or "not public yet",
        "",
        "**CVE checkbox**",
    ]

    if f.vendor_contacted:
        lines.append(f"[x] vendor contacted on {f.contact_date} (response: {f.vendor_response})")
    else:
        lines.append("[ ] vendor contacted — required before CVE request")

    all_dedup = f.nvd_searched and f.ghsa_searched and f.ecosystem_db_searched
    if all_dedup:
        cve_note = (
            f"existing CVE: {f.existing_cve}"
            if is_set(f.existing_cve) and f.existing_cve.lower() != "none"
            else "no existing CVE found (NVD, GHSA, and ecosystem DB searched)"
        )
        lines.append(f"[x] {cve_note}")
    else:
        lines.append("[ ] search NVD, GHSA, and ecosystem advisory DB for duplicates before submitting")

    lines += [
        "[ ] no other CNA submission in progress — confirm before submitting",
        "",
        "---",
        _score_line(f),
    ]
    return "\n".join(lines) + "\n"


def render_ghsa(f: Finding) -> str:
    ghsa_eco = GHSA_ECOSYSTEM.get(f.ecosystem.lower(), f.ecosystem)

    if is_set(f.fixed) and f.fixed.lower() != "none":
        ghsa_range = f">= 0, < {f.fixed}"
    elif is_set(f.tested):
        ghsa_range = f"<= {f.tested}"
    else:
        ghsa_range = draft("GHSA range syntax, e.g. '>= 1.0.0, < 1.2.4'")

    patched = (
        f.fixed
        if is_set(f.fixed) and f.fixed.lower() != "none"
        else draft("first fixed version, or blank if no fix")
    )

    comp = f.affected_function or f.affected_component or draft("component")
    title = f"{f.product}: {f.vuln_class} in {comp}"

    lines = [
        "## GitHub Security Advisory",
        "",
        "**Ecosystem**",
        ghsa_eco or draft("npm / pip / Go / RubyGems / Maven / NuGet / Composer / Pub / Rust"),
        "",
        "**Package name**",
        f.registry_name or draft("registry package name"),
        "",
        "**Affected versions**",
        ghsa_range,
        "",
        "**Patched versions**",
        patched,
        "",
        "**Severity**",
        f.cvss_severity if is_set(f.cvss_severity) else draft("Critical / High / Medium / Low"),
        "",
        "**CWE IDs**",
        f.cwe or draft("CWE-NNNN"),
        "",
        "**Title**",
        title,
        "",
        "**Description**",
        "### Summary",
        draft(f"One paragraph: {f.vuln_class} in {f.registry_name} {_version_vuldb(f)}."),
        "",
        "### Details",
        "",
    ]
    lines += _ssg_block(f)
    if f.affected_component:
        lines += ["", f"Affected file: `{f.affected_component}`"]
    if f.affected_function:
        lines.append(f"Affected function: `{f.affected_function}`")
    lines += [
        "",
        "### Impact",
        draft(
            f"Attacker control, required auth ({f.auth_required}), "
            f"user interaction ({f.user_interaction}), scope ({f.scope_changed}). "
            f"CVSS: {f.cvss_vector}"
        ),
        "",
        "### Proof of Concept",
    ]

    if is_set(f.reproducer) and f.reproducer.strip().lower() != "none":
        lines += ["```"]
        lines += f.reproducer.splitlines()
        lines += ["```"]
        if is_set(f.observed_result):
            lines.append(f"Expected output: {f.observed_result}")
    else:
        lines.append(draft("minimal local reproducer without live-service exploitation"))

    lines += [
        "",
        "### Recommended Fix",
        draft("Specific code fix — reject prototype-mutating keys, validate input, add output encoding, etc."),
        "",
        "---",
        _score_line(f),
    ]
    return "\n".join(lines) + "\n"


def render_osv(f: Finding) -> str:
    osv_eco = OSV_ECOSYSTEM.get(f.ecosystem.lower(), f.ecosystem)

    events: list[dict[str, str]] = [{"introduced": "0"}]
    if is_set(f.fixed) and f.fixed.lower() != "none":
        events.append({"fixed": f.fixed})

    ssg_parts = []
    if is_set(f.source):
        ssg_parts.append(f"Source: {f.source}")
    if is_set(f.sink):
        ssg_parts.append(f"Sink: {f.sink}")
    if is_set(f.guard):
        ssg_parts.append(f"Guard: {f.guard}")
    ssg = " → ".join(ssg_parts) if ssg_parts else "[DRAFT: source → sink → guard evidence]"

    details = (
        draft(
            f"Root cause, affected component ({f.affected_component} {f.affected_function}), "
            "impact, and attack requirements."
        )
        + f"  {ssg}"
    )
    if is_set(f.observed_result):
        details += f"  Observed: {f.observed_result}"

    comp = f.affected_function or f.affected_component or draft("component")
    pkg_name = f.registry_name or f.product

    pub_date = (
        isodate(f.planned_disclosure_date)
        if is_set(f.planned_disclosure_date)
        else "[DRAFT: set to publication date]"
    )

    doc: dict = {
        "schema_version": "1.6.0",
        "id": "TBD",
        "modified": isodate(f.verification_date) if f.verification_date else "[DRAFT: YYYY-MM-DDT00:00:00Z]",
        "published": pub_date,
        "summary": f"{pkg_name}: {f.vuln_class} in {comp}",
        "details": details,
        "affected": [
            {
                "package": {
                    "ecosystem": osv_eco,
                    "name": pkg_name,
                },
                "ranges": [{"type": "SEMVER", "events": events}],
                "versions": [f.tested] if is_set(f.tested) else [],
                "database_specific": {
                    "cwe_ids": [f.cwe] if f.cwe else [],
                    "source": ssg,
                },
            }
        ],
        "references": [
            {
                "type": "WEB",
                "url": f.repository_url or draft("advisory or source permalink"),
            }
        ],
    }

    if is_set(f.cvss_vector):
        doc["severity"] = [{"type": "CVSS_V3", "score": f.cvss_vector}]

    print(_score_line(f), file=sys.stderr)
    return json.dumps(doc, indent=2) + "\n"


def render_md(f: Finding) -> str:
    comp = f.affected_function or f.affected_component or draft("component")
    pkg = f.registry_name or f.product or draft("package")
    title = f"{f.product or pkg}: {f.vuln_class} in {comp}"

    lines = [
        f"# {title}",
        "",
        "## Summary",
        draft(
            f"One paragraph: {f.vuln_class} in {f.registry_name or f.product} "
            f"{_version_vuldb(f)}, classified as {f.cwe or '?'}. {f.verdict_reason}"
        ),
        "",
        "## Affected Versions",
        f"- Package: `{f.ecosystem}:{f.registry_name}`",
        f"- Tested version: `{f.tested if is_set(f.tested) else draft('exact tested version')}`",
        f"- Affected range: `{f.affected_range if is_set(f.affected_range) else draft('affected range')}`",
        f"- Fixed version: `{f.fixed if is_set(f.fixed) else 'none known'}`",
        "",
        "## Technical Details",
        "",
    ]
    lines += _ssg_block(f)
    lines.append("")
    if f.affected_component:
        lines.append(f"Affected file: `{f.affected_component}`")
    if f.affected_function:
        lines.append(f"Affected function: `{f.affected_function}`")
    lines += [
        "",
        draft("Explain the root cause and why the guard is insufficient or absent."),
        "",
        "## Impact",
        draft(
            f"Attacker control, required auth ({f.auth_required}), user interaction ({f.user_interaction}), "
            f"scope ({f.scope_changed}), security consequences "
            f"(C:{f.confidentiality} I:{f.integrity} A:{f.availability})."
        ),
        "",
    ]
    if is_set(f.cvss_vector):
        lines.append(f"CVSS v3.1: `{f.cvss_vector}` — {f.cvss_score} {f.cvss_severity}")
        lines.append("")

    lines += ["## Proof of Concept", ""]
    if is_set(f.reproducer) and f.reproducer.strip().lower() != "none":
        lines += ["```"]
        lines += f.reproducer.splitlines()
        lines += ["```"]
        if is_set(f.observed_result):
            lines.append(f"Expected output: {f.observed_result}")
    else:
        lines.append(draft("minimal local reproducer without credential theft or live-service exploitation"))

    lines += [
        "",
        "## Remediation",
        draft("Specific fix — e.g. reject prototype-mutating keys, validate input range, add output encoding."),
        "",
        "## Disclosure Timeline",
        "",
    ]
    if f.vendor_contacted and is_set(f.contact_date):
        lines.append(f"- {f.contact_date}: vendor contacted")
    if is_set(f.vendor_response):
        lines.append(f"- response: {f.vendor_response}")
    if is_set(f.planned_disclosure_date):
        lines.append(f"- {f.planned_disclosure_date}: planned public disclosure")
    if not f.vendor_contacted:
        lines += [
            draft("YYYY-MM-DD: vendor contacted"),
            draft("YYYY-MM-DD: vendor response"),
            draft("YYYY-MM-DD: planned public disclosure"),
        ]

    lines += [
        "",
        "## References",
        "",
        f"- Repository: {f.repository_url}" if f.repository_url else "- " + draft("source permalink"),
    ]
    if f.cwe:
        cwe_id = f.cwe.replace("CWE-", "")
        lines.append(f"- {f.cwe}: https://cwe.mitre.org/data/definitions/{cwe_id}.html")

    if f.repro_artifacts:
        lines += ["", "Reproduction artifacts:"]
        for art in f.repro_artifacts:
            lines.append(f"  - {art}")

    lines += [
        "",
        "---",
        _score_line(f),
    ]
    return "\n".join(lines) + "\n"


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render a deterministic report skeleton from an Evidence.v1 YAML file."
    )
    parser.add_argument("--finding", type=Path, required=True, help="Path to Evidence.v1 YAML")
    parser.add_argument(
        "--format",
        choices=["vuldb", "ghsa", "osv", "md"],
        required=True,
        help="Output format",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Bypass status and submission-score gates",
    )
    parsed = parser.parse_args()

    if not parsed.finding.exists():
        print(f"error: finding file not found: {parsed.finding}", file=sys.stderr)
        sys.exit(1)

    finding = load_finding(parsed.finding)

    if not parsed.force:
        if finding.status == "blocked":
            blockers_str = ", ".join(finding.blockers) if finding.blockers else "see finding YAML"
            print(
                f"error: status is 'blocked' — explain blockers before rendering a report skeleton.\n"
                f"Blockers: {blockers_str}\n"
                "Use --force to render anyway.",
                file=sys.stderr,
            )
            sys.exit(1)
        if finding.status == "candidate":
            print(
                "error: status is 'candidate' — promote to 'confirmed' before rendering a submission skeleton.\n"
                "Use --force to render a draft outline.",
                file=sys.stderr,
            )
            sys.exit(1)
        if finding.submission_score < 75:
            print(
                f"error: submission score {finding.submission_score}/100 is below threshold 75.\n"
                f"Evidence score: {finding.evidence_score}/100. Resolve blockers and fill missing fields.\n"
                "Use --force to render anyway.",
                file=sys.stderr,
            )
            sys.exit(1)

    renderers = {
        "vuldb": render_vuldb,
        "ghsa": render_ghsa,
        "osv": render_osv,
        "md": render_md,
    }
    sys.stdout.write(renderers[parsed.format](finding))


if __name__ == "__main__":
    main()
