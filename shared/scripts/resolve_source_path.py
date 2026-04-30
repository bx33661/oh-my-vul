#!/usr/bin/env python3
"""Resolve the authoritative source file URL for a package before fetching.

Usage:
  python3 resolve_source_path.py --ecosystem npm --pkg <name>
  python3 resolve_source_path.py --ecosystem pypi --pkg <name>

Output: JSON with package, main_file, raw_url, fallback_urls, registry_url.
Exit 0 on success, 1 on error.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


USER_AGENT = "omv-find-skill/1.0"
TIMEOUT = 20


def fetch_json(url: str) -> tuple[dict | None, str | None]:
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(req, timeout=TIMEOUT) as resp:
            charset = resp.headers.get_content_charset() or "utf-8"
            return json.loads(resp.read().decode(charset, errors="replace")), None
    except HTTPError as exc:
        return None, f"HTTP {exc.code}"
    except (URLError, TimeoutError, json.JSONDecodeError, UnicodeDecodeError) as exc:
        return None, str(exc)


def normalise_github_url(raw: str) -> str | None:
    """Extract owner/repo from various git URL formats."""
    raw = raw.strip()
    raw = re.sub(r"^git\+", "", raw)
    raw = re.sub(r"\.git$", "", raw)
    raw = re.sub(r"^git://", "https://", raw)
    match = re.search(r"github\.com[/:]([^/]+/[^/]+)", raw)
    return f"https://github.com/{match.group(1)}" if match else None


def is_dist_path(path: str) -> bool:
    """Return True if path looks like a compiled/bundled output."""
    lower = path.lower()
    return any(seg in lower.split("/") for seg in ("dist", "build", "out", "bundle")) or lower.endswith(".min.js")


def source_fallbacks(main_file: str) -> list[str]:
    """Return fallback source paths when main points to dist."""
    return ["src/index.ts", "src/index.js", "index.ts", "index.js"]


def resolve_npm(pkg: str) -> dict:
    registry_url = f"https://registry.npmjs.org/{pkg}"
    data, err = fetch_json(registry_url)
    if err:
        return {"error": f"registry fetch failed: {err}", "package": pkg}
    if not data:
        return {"error": "empty registry response", "package": pkg}

    latest_version = (data.get("dist-tags") or {}).get("latest", "")
    version_data = (data.get("versions") or {}).get(latest_version, data)

    main_file: str = version_data.get("main") or data.get("main") or "index.js"
    main_file = main_file.lstrip("./")

    repo_raw = ""
    repo_field = version_data.get("repository") or data.get("repository") or {}
    if isinstance(repo_field, dict):
        repo_raw = repo_field.get("url", "")
    elif isinstance(repo_field, str):
        repo_raw = repo_field

    if not repo_raw:
        for field in ("homepage", "bugs"):
            candidate = (version_data.get(field) or data.get(field) or "")
            if isinstance(candidate, dict):
                candidate = candidate.get("url", "")
            if "github.com" in str(candidate):
                repo_raw = candidate
                break

    github_url = normalise_github_url(repo_raw) if repo_raw else None
    if not github_url:
        return {
            "error": "could not determine repository URL",
            "package": pkg,
            "main_file": main_file,
            "registry_url": registry_url,
        }

    owner_repo = re.search(r"github\.com/(.+)", github_url).group(1)  # type: ignore[union-attr]
    default_branch = "main"

    if is_dist_path(main_file):
        fallbacks = source_fallbacks(main_file)
        raw_url = f"https://raw.githubusercontent.com/{owner_repo}/{default_branch}/{fallbacks[0]}"
        fallback_urls = [
            f"https://raw.githubusercontent.com/{owner_repo}/{default_branch}/{f}"
            for f in fallbacks[1:]
        ] + [f"https://unpkg.com/{pkg}/{main_file}"]
    else:
        raw_url = f"https://raw.githubusercontent.com/{owner_repo}/{default_branch}/{main_file}"
        fallback_urls = [f"https://unpkg.com/{pkg}/{main_file}"]

    return {
        "package": pkg,
        "ecosystem": "npm",
        "main_file": main_file,
        "raw_url": raw_url,
        "fallback_urls": fallback_urls,
        "github_url": github_url,
        "registry_url": registry_url,
        "latest_version": latest_version,
        "dist_path_detected": is_dist_path(main_file),
    }


def resolve_pypi(pkg: str) -> dict:
    registry_url = f"https://pypi.org/pypi/{pkg}/json"
    data, err = fetch_json(registry_url)
    if err:
        return {"error": f"registry fetch failed: {err}", "package": pkg}
    if not data:
        return {"error": "empty registry response", "package": pkg}

    info = data.get("info") or {}
    project_urls = info.get("project_urls") or {}

    source_url = (
        project_urls.get("Source Code")
        or project_urls.get("Source")
        or project_urls.get("Repository")
        or project_urls.get("Homepage")
        or info.get("home_page")
        or ""
    )

    github_url = normalise_github_url(source_url) if source_url else None
    if not github_url:
        return {
            "error": "could not determine repository URL",
            "package": pkg,
            "registry_url": registry_url,
        }

    owner_repo = re.search(r"github\.com/(.+)", github_url).group(1)  # type: ignore[union-attr]
    pkg_dir = pkg.replace("-", "_")
    raw_url = f"https://raw.githubusercontent.com/{owner_repo}/main/src/{pkg_dir}/__init__.py"
    fallback_urls = [
        f"https://raw.githubusercontent.com/{owner_repo}/main/{pkg_dir}/__init__.py",
        f"https://raw.githubusercontent.com/{owner_repo}/master/src/{pkg_dir}/__init__.py",
    ]

    return {
        "package": pkg,
        "ecosystem": "pypi",
        "main_file": f"src/{pkg_dir}/__init__.py",
        "raw_url": raw_url,
        "fallback_urls": fallback_urls,
        "github_url": github_url,
        "registry_url": registry_url,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Resolve authoritative source file URL for a package.")
    parser.add_argument("--ecosystem", required=True, choices=["npm", "pypi"], help="Package ecosystem")
    parser.add_argument("--pkg", required=True, help="Package name")
    args = parser.parse_args()

    if args.ecosystem == "npm":
        result = resolve_npm(args.pkg)
    else:
        result = resolve_pypi(args.pkg)

    print(json.dumps(result, indent=2))
    if "error" in result:
        sys.exit(1)


if __name__ == "__main__":
    main()
