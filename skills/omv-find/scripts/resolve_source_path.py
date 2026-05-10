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
from urllib.parse import urlparse

from http_client import fetch_json


def normalise_github_url(raw: str) -> str | None:
    """Extract owner/repo from various git URL formats."""
    raw = raw.strip()
    raw = re.sub(r"^git\+", "", raw)
    raw = re.sub(r"\.git$", "", raw)
    raw = re.sub(r"^git://", "https://", raw)
    ssh_match = re.search(r"github\.com:([^/]+)/([^/#?]+)", raw)
    if ssh_match:
        owner, repo = ssh_match.group(1), ssh_match.group(2)
        return f"https://github.com/{owner}/{repo.removesuffix('.git')}"

    parsed = urlparse(raw)
    if parsed.hostname != "github.com":
        return None
    parts = [part for part in parsed.path.split("/") if part]
    if len(parts) < 2:
        return None
    owner, repo = parts[0], parts[1].removesuffix(".git")
    return f"https://github.com/{owner}/{repo}"


def is_dist_path(path: str) -> bool:
    """Return True if path looks like a compiled/bundled output."""
    lower = path.lower()
    return any(seg in lower.split("/") for seg in ("dist", "build", "out", "bundle")) or lower.endswith(".min.js")


def source_fallbacks(main_file: str) -> list[str]:
    """Return fallback source paths when main points to dist."""
    return ["src/index.ts", "src/index.js", "index.ts", "index.js"]


def owner_repo_from_github(github_url: str) -> str:
    parsed = urlparse(github_url)
    parts = [part for part in parsed.path.split("/") if part]
    return "/".join(parts[:2])


def github_default_branch(github_url: str) -> tuple[str, str | None]:
    owner_repo = owner_repo_from_github(github_url)
    data, err = fetch_json(f"https://api.github.com/repos/{owner_repo}")
    if isinstance(data, dict) and data.get("default_branch"):
        return str(data["default_branch"]), None
    return "main", err or "default branch not found"


def raw_github_url(github_url: str, branch: str, path: str) -> str:
    return f"https://raw.githubusercontent.com/{owner_repo_from_github(github_url)}/{branch}/{path.lstrip('./')}"


def alternate_branches(default_branch: str) -> list[str]:
    branches = []
    for branch in ("main", "master"):
        if branch != default_branch:
            branches.append(branch)
    return branches


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

    default_branch, branch_error = github_default_branch(github_url)

    if is_dist_path(main_file):
        fallbacks = source_fallbacks(main_file)
        raw_url = raw_github_url(github_url, default_branch, fallbacks[0])
        fallback_urls = [raw_github_url(github_url, default_branch, f) for f in fallbacks[1:]]
        for branch in alternate_branches(default_branch):
            fallback_urls.extend(raw_github_url(github_url, branch, f) for f in fallbacks)
        fallback_urls.append(f"https://unpkg.com/{pkg}/{main_file}")
    else:
        raw_url = raw_github_url(github_url, default_branch, main_file)
        fallback_urls = [
            raw_github_url(github_url, branch, main_file)
            for branch in alternate_branches(default_branch)
        ] + [f"https://unpkg.com/{pkg}/{main_file}"]

    result = {
        "package": pkg,
        "ecosystem": "npm",
        "main_file": main_file,
        "raw_url": raw_url,
        "fallback_urls": fallback_urls,
        "github_url": github_url,
        "default_branch": default_branch,
        "registry_url": registry_url,
        "latest_version": latest_version,
        "dist_path_detected": is_dist_path(main_file),
    }
    if branch_error:
        result["default_branch_error"] = branch_error
    dist = version_data.get("dist") or {}
    if isinstance(dist, dict) and dist.get("tarball"):
        result["source_archive_url"] = dist["tarball"]
    return result


def resolve_pypi(pkg: str) -> dict:
    registry_url = f"https://pypi.org/pypi/{pkg}/json"
    data, err = fetch_json(registry_url)
    if err:
        return {"error": f"registry fetch failed: {err}", "package": pkg}
    if not data:
        return {"error": "empty registry response", "package": pkg}

    info = data.get("info") or {}
    project_urls = info.get("project_urls") or {}

    source_url = ""
    for key in ("Source Code", "Source code", "Source", "Repository", "Code", "GitHub", "Homepage", "Home"):
        value = project_urls.get(key)
        if value:
            source_url = value
            break
    if not source_url:
        for value in project_urls.values():
            if "github.com" in str(value):
                source_url = str(value)
                break
    if not source_url:
        source_url = info.get("home_page") or ""

    github_url = normalise_github_url(source_url) if source_url else None
    if not github_url:
        return {
            "error": "could not determine repository URL",
            "package": pkg,
            "registry_url": registry_url,
        }

    default_branch, branch_error = github_default_branch(github_url)
    pkg_dir = pkg.replace("-", "_")
    raw_url = raw_github_url(github_url, default_branch, f"src/{pkg_dir}/__init__.py")
    fallback_urls = [
        raw_github_url(github_url, default_branch, f"{pkg_dir}/__init__.py"),
    ]
    for branch in alternate_branches(default_branch):
        fallback_urls.extend(
            [
                raw_github_url(github_url, branch, f"src/{pkg_dir}/__init__.py"),
                raw_github_url(github_url, branch, f"{pkg_dir}/__init__.py"),
            ]
        )

    result = {
        "package": pkg,
        "ecosystem": "pypi",
        "main_file": f"src/{pkg_dir}/__init__.py",
        "raw_url": raw_url,
        "fallback_urls": fallback_urls,
        "github_url": github_url,
        "default_branch": default_branch,
        "registry_url": registry_url,
    }
    if branch_error:
        result["default_branch_error"] = branch_error

    for file_info in data.get("urls") or []:
        if file_info.get("packagetype") == "sdist" and file_info.get("url"):
            result["source_archive_url"] = file_info["url"]
            break
    return result


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
