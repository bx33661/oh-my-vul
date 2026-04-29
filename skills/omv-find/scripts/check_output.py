#!/usr/bin/env python3
"""Heuristic checker for omv-find eval outputs."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SKILL_DIR = Path(__file__).resolve().parents[1]

FILE_PATH_RE = re.compile(
    r"(?<![\w.-])[\w./-]+\."
    r"(?:js|mjs|cjs|ts|tsx|py|go|rs|java|rb|php|cs|swift|dart|ex|exs|pl|pm|r|lua)"
    r"(?=$|[^\w])",
    re.IGNORECASE,
)

REGISTRY_SIGNALS = [
    "registry",
    "npmjs.com",
    "pypi.org",
    "crates.io",
    "pkg.go.dev",
    "rubygems.org",
    "packagist.org",
    "nuget.org",
    "search.maven.org",
    "repo1.maven.org",
    "mvnrepository.com",
    "swiftpackageindex.com",
    "pub.dev",
    "hex.pm",
    "metacpan.org",
    "cpan.org",
    "cran.r-project.org",
    "cloud.r-project.org",
    "luarocks.org",
]

FORBIDDEN_PROJECTS = [
    "django",
    "flask",
    "express",
    "fastify",
    "react",
    "vue",
    "angular",
    "vite",
    "next.js",
    "nuxt",
    "webpack",
    "babel",
    "typescript core",
    "urllib3",
    "requests",
    "axios",
    "tokio",
    "actix",
    "gin",
    "echo",
    "beego",
    "fiber",
    "spring framework",
    "spring boot",
    "rails",
    "devise",
    "nokogiri",
    "laravel",
    "symfony",
    "wordpress core",
    ".net core",
    "asp.net core",
    "entity framework",
    "swashbuckle",
    "newtonsoft.json",
    "alamofire",
    "kingfisher",
    "snapkit",
    "lottie-ios",
    "flutter/engine",
    "provider",
    "dio",
    "getx",
    "phoenix framework",
    "ecto",
    "moose",
    "dbi",
    "ggplot2",
    "dplyr",
    "tidyverse",
    "penlight",
    "luajit",
]

ECOSYSTEM_PATTERNS = {
    "npm": [
        r"\bnpm\b",
        r"node\.?js",
        r"javascript",
        r"typescript",
        r"npmjs\.com",
        r"\.(?:mjs|cjs|js|ts|tsx)(?=$|[^\w])",
    ],
    "python": [r"\bpython\b", r"\bpypi\b", r"pypi\.org", r"\.py(?=$|[^\w])"],
    "go": [r"\bgo\b", r"\bgolang\b", r"pkg\.go\.dev", r"\.go(?=$|[^\w])"],
    "rust": [r"\brust\b", r"crates\.io", r"\bcargo\b", r"\.rs(?=$|[^\w])"],
    "java": [r"\bjava\b", r"\bjvm\b", r"\bmaven\b", r"search\.maven\.org", r"\.java(?=$|[^\w])"],
    "ruby": [r"\bruby\b", r"rubygems\.org", r"\brubygems\b", r"\.rb(?=$|[^\w])"],
    "php": [r"\bphp\b", r"packagist\.org", r"\bcomposer\b", r"\.php(?=$|[^\w])"],
    "csharp": [r"(?<!\w)c#(?!\w)", r"\bcsharp\b", r"(?<!\w)\.net(?!\w)", r"\bdotnet\b", r"nuget\.org", r"\.cs(?=$|[^\w])"],
    "swift": [r"\bswift\b", r"swiftpackageindex\.com", r"swift package index", r"\.swift(?=$|[^\w])"],
    "dart": [r"\bdart\b", r"\bflutter\b", r"pub\.dev", r"\.dart(?=$|[^\w])"],
    "elixir": [r"\belixir\b", r"\berlang\b", r"hex\.pm", r"\.exs?(?=$|[^\w])"],
    "perl": [r"\bperl\b", r"\bcpan\b", r"metacpan\.org", r"\.(?:pl|pm)(?=$|[^\w])"],
    "r": [r"\bcran\b", r"cran\.r-project\.org", r"\br\s+(?:生态|package|project|github|项目)\b", r"\.r(?=$|[^\w])"],
    "lua": [r"\blua\b", r"luarocks\.org", r"\.lua(?=$|[^\w])"],
}

LANG_ALIASES = {
    "node": "npm",
    "nodejs": "npm",
    "javascript": "npm",
    "typescript": "npm",
    "py": "python",
    "golang": "go",
    "cargo": "rust",
    "jvm": "java",
    "dotnet": "csharp",
    ".net": "csharp",
    "c#": "csharp",
    "cpan": "perl",
    "cran": "r",
    "luarocks": "lua",
}

RISK_TERMS = {
    "parser_risk_and_guard_named": ["yaml.load", "pickle", "xml entity", "safe loader", "schema", "jsondecode"],
    "rust_unsafe_signals": ["unsafe", "from_utf8_unchecked", "unwrap", "expect", "checked length"],
    "go_path_risk_named": ["filepath.join", "path.clean", "archive", "os.open", "write", "base-dir"],
    "deser_risk_and_guard_named": ["objectinputstream", "readobject", "resolveclass", "ysoserial", "unserialize", "rds"],
    "injection_risk_and_guard_named": ["system", "exec", "backtick", "open3", "erb", "liquid", "shell escape"],
    "race_risk_and_guard_named": ["toctou", "check-then-act", "mutex", "lock", "atomic", "concurrent", "race"],
    "overflow_risk_and_guard_named": ["as ", "checked_add", "checked_mul", "wrapping_", "saturating_", "ffi", "from_raw_parts"],
    "traversal_risk_and_guard_named": ["file_get_contents", "move_uploaded_file", "realpath", "dirname", "basename", "path traversal"],
    "xxe_risk_and_guard_named": ["xmlreader", "xmldocument", "documentbuilder", "saxparser", "dtd", "entity"],
    "upload_risk_and_guard_named": ["urlsession", "iformfile", "mime", "extension", "file magic", "content validation"],
    "infoleak_risk_and_guard_named": ["debug.getinfo", "verbose error", "stack trace", "panic", "path disclosure", "pii"],
    "auth_risk_and_guard_named": ["jwt", "verify", "none algorithm", "session", "role check", "access control"],
    "csrf_risk_and_guard_named": ["csrf", "samesite", "double-submit", "origin", "state-changing", "form"],
    "sql_risk_and_guard_named": ["raw sql", "string concatenation", "parameterized", "$where", "pymongo", "sqlalchemy"],
    "ssti_risk_and_guard_named": ["erb", "liquid", "tilt", "slim", "haml", "template", "sandbox"],
    "sandbox_risk_and_guard_named": ["vm.runincontext", "eval", "iframe", "postmessage", "worker", "sandbox"],
    "redirect_risk_and_guard_named": ["http.redirect", "location", "url.parse", "protocol-relative", "javascript:", "allowlist"],
    "crypto_risk_and_guard_named": ["ecb", "hardcoded", "math.random", "securerandom", "static iv", "aes-gcm", "argon2"],
}


def table_row_lines(text: str) -> list[str]:
    rows = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|") or not stripped.endswith("|"):
            continue
        if re.match(r"^\|\s*-+", stripped):
            continue
        if "排名" in stripped and "项目" in stripped:
            continue
        rows.append(stripped)
    return rows


def table_rows(text: str) -> int:
    return len(table_row_lines(text))


def count_from_prompt(prompt: str) -> int | None:
    match = re.search(r"--count\s+(\d+)", prompt)
    return int(match.group(1)) if match else None


def expected_range(prompt: str) -> tuple[int, int] | None:
    count = count_from_prompt(prompt)
    if count is None:
        return None
    return max(0, count - 2), count + 2


def contains_any(text: str, terms: list[str]) -> bool:
    lowered = text.lower()
    return any(term.lower() in lowered for term in terms)


def contains_forbidden_project(text: str) -> bool:
    for term in FORBIDDEN_PROJECTS:
        pattern = r"(?<![\w.-])" + re.escape(term).replace(r"\ ", r"\s+") + r"(?![\w.-])"
        if re.search(pattern, text, re.IGNORECASE):
            return True
    return False


def normalize_lang(value: str) -> str | None:
    normalized = value.strip().lower()
    normalized = LANG_ALIASES.get(normalized, normalized)
    return normalized if normalized in ECOSYSTEM_PATTERNS else None


def expected_ecosystem(prompt: str, assertion_text: str) -> str | None:
    lang_match = re.search(r"--lang\s+([a-zA-Z0-9#_.-]+)", prompt)
    if lang_match:
        return normalize_lang(lang_match.group(1))

    assertion_match = re.search(r"所有项目都是\s*([^，,。]+?)\s*生态", assertion_text)
    haystacks = []
    if assertion_match:
        haystacks.append(assertion_match.group(1))
    haystacks.append(prompt)

    for haystack in haystacks:
        lowered = haystack.lower()
        for name, patterns in ECOSYSTEM_PATTERNS.items():
            if any(re.search(pattern, lowered, re.IGNORECASE) for pattern in patterns):
                return name
    return None


def ecosystems_for_text(text: str) -> set[str]:
    lowered = text.lower()
    found: set[str] = set()
    for name, patterns in ECOSYSTEM_PATTERNS.items():
        if any(re.search(pattern, lowered, re.IGNORECASE) for pattern in patterns):
            found.add(name)
    return found


def check_ecosystem_correct(text: str, prompt: str, assertion_text: str) -> bool:
    expected = expected_ecosystem(prompt, assertion_text)
    if expected is None:
        return False

    rows = table_row_lines(text)
    if not rows:
        return expected in ecosystems_for_text(text)

    expected_hits = 0
    for row in rows:
        ecosystems = ecosystems_for_text(row)
        if expected in ecosystems:
            expected_hits += 1
        if ecosystems and expected not in ecosystems:
            return False
        if ecosystems - {expected}:
            return False

    return expected_hits >= max(1, int(len(rows) * 0.7))


def check(assertion_type: str, text: str, prompt: str, assertion_text: str = "") -> bool:
    lowered = text.lower()
    rows = table_rows(text)

    if assertion_type in {"table_row_count", "audit_tips_present"}:
        return rows >= 1 and ("审计建议" in text or "audit" in lowered)
    if assertion_type == "count_matches_flag":
        limits = expected_range(prompt)
        return limits is None or limits[0] <= rows <= limits[1]
    if assertion_type == "few_or_zero_results":
        return rows <= 3 or "不足" in text or "无合适" in text
    if assertion_type == "no_padded_results":
        return "硬凑" in text or rows <= 3
    if assertion_type == "no_table_or_empty":
        return rows == 0
    if assertion_type == "source_sink_guard_present":
        return ("source" in lowered or "输入" in text) and ("sink" in lowered or "->" in text) and ("guard" in lowered or "防护" in text or "未确认" in text)
    if assertion_type in {"suspicious_code_present", "metadata_source_present", "size_estimate_method_present"}:
        return bool(FILE_PATH_RE.search(text)) or "cloc" in lowered or "tokei" in lowered or "github estimate" in lowered
    if assertion_type in {"verified_links_present", "repo_and_registry_links_present", "registry_links_present"}:
        return "https://github.com/" in lowered and (contains_any(lowered, REGISTRY_SIGNALS) or "未确认" in text)
    if assertion_type in {"metadata_and_score_present", "score_explainability_present"}:
        return bool(re.search(r"\d{1,3}/100", text)) and ("stars" in lowered or "最近维护" in text)
    if assertion_type in {"freshness_and_uncertainty_present"}:
        return "数据新鲜度" in text or "验证日期" in text or "未确认" in text
    if assertion_type in {"non_exploitative_guidance", "no_fabricated_data"}:
        return not contains_any(lowered, ["attack live", "攻击线上", "真实线上服务", "批量利用"])
    if assertion_type == "no_flagship_projects":
        candidate_text = "\n".join(table_row_lines(text)) or text
        return not contains_forbidden_project(candidate_text)
    if assertion_type == "ecosystem_diversity_present":
        ecosystems = ["npm", "python", "go", "rust", "java", "ruby", "php", "c#", ".net", "swift", "dart", "elixir", "perl", "lua"]
        return sum(1 for term in ecosystems if term in lowered) >= 2
    if assertion_type == "both_ecosystems_present":
        return "rust" in lowered and ("go" in lowered or "pkg.go.dev" in lowered)
    if assertion_type == "ecosystem_correct":
        return check_ecosystem_correct(text, prompt, assertion_text)
    if assertion_type == "vuln_focus_relevant":
        return rows == 0 or contains_any(lowered, ["path traversal", "zip slip", "yaml", "xml", "json", "unsafe", "panic", "deser", "race", "toctou", "overflow", "xxe", "csrf", "auth", "sql", "ssti", "sandbox", "redirect", "upload", "crypto", "infoleak", "信息泄露", "认证", "鉴权", "路径"])
    if assertion_type == "topic_relevance_and_diversity":
        return contains_any(lowered, ["markdown", "parser", "render", "sanitize"])
    if assertion_type == "lang_help_shown":
        return "--lang" in text and "npm" in lowered and "python" in lowered and "all" in lowered
    if assertion_type == "vuln_help_shown":
        return "--vuln" in text and "proto" in lowered and "infoleak" in lowered
    if assertion_type == "count_help_shown":
        return "--count" in text and "20" in text
    if assertion_type in RISK_TERMS:
        return contains_any(lowered, RISK_TERMS[assertion_type])

    print(f"WARN: unsupported assertion type {assertion_type}", file=sys.stderr)
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-id", type=int, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--evals", type=Path, default=SKILL_DIR / "evals" / "evals.json")
    args = parser.parse_args()

    data = json.loads(args.evals.read_text(encoding="utf-8"))
    eval_item = next((item for item in data["evals"] if item["id"] == args.eval_id), None)
    if eval_item is None:
        raise SystemExit(f"unknown eval id: {args.eval_id}")

    output = args.output.read_text(encoding="utf-8")
    failures = []
    for assertion in eval_item["assertions"]:
        assertion_type = assertion["type"]
        if not check(assertion_type, output, eval_item["prompt"], assertion.get("text", "")):
            failures.append(assertion_type)

    if failures:
        print("FAIL:", ", ".join(failures), file=sys.stderr)
        raise SystemExit(1)

    print(f"OK: eval {args.eval_id} heuristic assertions passed")


if __name__ == "__main__":
    main()
