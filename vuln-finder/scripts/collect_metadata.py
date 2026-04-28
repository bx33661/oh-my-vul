#!/usr/bin/env python3
"""Collect GitHub and selected package-registry metadata as JSON."""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen


USER_AGENT = "vuln-finder-skill/1.0"


def fetch_text(url: str, accept: str = "text/plain,text/html,*/*") -> tuple[str | None, str | None]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    try:
        with urlopen(request, timeout=20) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace"), None
    except HTTPError as exc:
        return None, f"HTTP {exc.code}: {url}"
    except (URLError, TimeoutError, UnicodeDecodeError) as exc:
        return None, f"{type(exc).__name__}: {exc}"


def fetch_json(url: str) -> tuple[dict[str, Any] | list[Any] | None, str | None]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urlopen(request, timeout=20) as response:
            return json.loads(response.read().decode("utf-8")), None
    except HTTPError as exc:
        return None, f"HTTP {exc.code}: {url}"
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        return None, f"{type(exc).__name__}: {exc}"


def github_slug(repo_url: str) -> tuple[str, str] | None:
    patterns = [
        r"^https://github\.com/([^/]+)/([^/#?]+?)(?:\.git)?/?(?:[#?].*)?$",
        r"^git@github\.com:([^/]+)/([^/#?]+?)(?:\.git)?$",
    ]
    for pattern in patterns:
        match = re.match(pattern, repo_url)
        if match:
            return match.group(1), match.group(2)
    return None


def collect_github(repo_url: str) -> dict[str, Any]:
    slug = github_slug(repo_url)
    if not slug:
        return {"url": repo_url, "error": "unsupported GitHub URL"}

    owner, repo = slug
    api = f"https://api.github.com/repos/{owner}/{repo}"
    data, error = fetch_json(api)
    if error or not isinstance(data, dict):
        return {"url": repo_url, "api": api, "error": error or "unexpected response"}

    return {
        "url": data.get("html_url"),
        "api": api,
        "full_name": data.get("full_name"),
        "default_branch": data.get("default_branch"),
        "archived": data.get("archived"),
        "fork": data.get("fork"),
        "stars": data.get("stargazers_count"),
        "pushed_at": data.get("pushed_at"),
        "updated_at": data.get("updated_at"),
        "size_kb": data.get("size"),
        "language": data.get("language"),
        "license": (data.get("license") or {}).get("spdx_id"),
        "open_issues": data.get("open_issues_count"),
    }


def parse_description(text: str) -> dict[str, str]:
    """Parse Debian/R DESCRIPTION-style key-value metadata."""
    data: dict[str, str] = {}
    current_key: str | None = None
    for line in text.splitlines():
        if not line.strip():
            continue
        if line[0].isspace() and current_key:
            data[current_key] = f"{data[current_key]}\n{line.strip()}"
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        current_key = key.strip()
        data[current_key] = value.strip()
    return data


def clean_html(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", value))).strip()


def parse_swift_search(html_text: str, package_name: str) -> dict[str, Any] | None:
    result_pattern = re.compile(
        r'<li><a href="(?P<href>/[^"]+)"><h4>(?P<title>.*?)</h4><p>(?P<description>.*?)</p>'
        r'<ul class="metadata">(?P<metadata>.*?)</ul></a></li>',
        re.DOTALL,
    )
    candidates: list[dict[str, Any]] = []
    for match in result_pattern.finditer(html_text):
        metadata = match.group("metadata")
        identifier_match = re.search(r'class="identifier"><small>(.*?)</small>', metadata, re.DOTALL)
        activity_match = re.search(r'class="activity"><small>(.*?)</small>', metadata, re.DOTALL)
        stars_match = re.search(r'class="stars"><small>(.*?)</small>', metadata, re.DOTALL)
        href = html.unescape(match.group("href"))
        candidate = {
            "url": f"https://swiftpackageindex.com{href}",
            "identifier": clean_html(identifier_match.group(1)) if identifier_match else href.strip("/"),
            "title": clean_html(match.group("title")),
            "description": clean_html(match.group("description")),
            "activity": clean_html(activity_match.group(1)) if activity_match else None,
            "stars": clean_html(stars_match.group(1)) if stars_match else None,
        }
        candidates.append(candidate)

    if not candidates:
        return None

    wanted = package_name.strip().lower()
    wanted_leaf = wanted.rsplit("/", 1)[-1]
    for candidate in candidates:
        identifier = str(candidate["identifier"]).lower()
        title = str(candidate["title"]).lower()
        if identifier == wanted or title == wanted or title == wanted_leaf:
            return candidate
    return candidates[0]


def parse_luarocks_search(html_text: str, rock_name: str) -> dict[str, Any] | None:
    result_pattern = re.compile(
        r'<li class="module_row">.*?<a href="(?P<href>/modules/[^"]+)" class="title">(?P<title>.*?)</a>'
        r'.*?<span class="author"> by <a href="[^"]+">(?P<author>.*?)</a></span>'
        r'(?:.*?<span title="(?P<downloads>[\d,]+)" class="value">.*?</span>)?'
        r'.*?<div class="summary">(?P<summary>.*?)</div>.*?</li>',
        re.DOTALL,
    )
    candidates: list[dict[str, Any]] = []
    for match in result_pattern.finditer(html_text):
        href = html.unescape(match.group("href"))
        candidate = {
            "url": f"https://luarocks.org{href}",
            "title": clean_html(match.group("title")),
            "author": clean_html(match.group("author")),
            "downloads": clean_html(match.group("downloads") or ""),
            "summary": clean_html(match.group("summary")),
        }
        candidates.append(candidate)

    if not candidates:
        return None

    wanted = rock_name.strip().lower()
    for candidate in candidates:
        if str(candidate["title"]).lower() == wanted:
            return candidate
    return candidates[0]


def lua_manifest_versions(manifest: str, rock_name: str) -> list[str]:
    quoted = rf'\["{re.escape(rock_name)}"\]'
    bare = rf"(?<![\w.-]){re.escape(rock_name)}"
    match = re.search(rf"(?:{quoted}|{bare})\s*=\s*\{{", manifest, re.IGNORECASE)
    if not match:
        return []

    start = match.end() - 1
    depth = 0
    end = start
    for index, char in enumerate(manifest[start:], start=start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index
                break

    block = manifest[start:end]
    return re.findall(r'\["([^"]+)"\]\s*=', block)


def version_key(version: str) -> list[tuple[int, int | str]]:
    parts: list[tuple[int, int | str]] = []
    for part in re.split(r"(\d+)", version):
        if not part:
            continue
        parts.append((0, int(part)) if part.isdigit() else (1, part.lower()))
    return parts


@dataclass(frozen=True)
class RegistrySpec:
    kind: str
    name: str


def parse_registry(value: str) -> RegistrySpec:
    if ":" not in value:
        raise argparse.ArgumentTypeError("registry must use KIND:NAME, for example npm:marked")
    kind, name = value.split(":", 1)
    return RegistrySpec(kind.strip().lower(), name.strip())


def collect_registry(spec: RegistrySpec) -> dict[str, Any]:
    kind = spec.kind
    name = spec.name
    result: dict[str, Any] = {"kind": kind, "name": name}

    if kind == "npm":
        url = f"https://registry.npmjs.org/{quote(name, safe='@/')}"
        data, error = fetch_json(url)
        result["url"] = f"https://www.npmjs.com/package/{name}"
        if isinstance(data, dict):
            latest = data.get("dist-tags", {}).get("latest")
            result.update(
                {
                    "latest": latest,
                    "description": data.get("description"),
                    "repository": data.get("repository"),
                    "modified": data.get("time", {}).get("modified"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind == "pypi":
        url = f"https://pypi.org/pypi/{quote(name)}/json"
        data, error = fetch_json(url)
        result["url"] = f"https://pypi.org/project/{name}/"
        if isinstance(data, dict):
            info = data.get("info", {})
            result.update(
                {
                    "latest": info.get("version"),
                    "summary": info.get("summary"),
                    "project_urls": info.get("project_urls"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind == "crates":
        url = f"https://crates.io/api/v1/crates/{quote(name)}"
        data, error = fetch_json(url)
        result["url"] = f"https://crates.io/crates/{name}"
        if isinstance(data, dict):
            crate = data.get("crate", {})
            result.update(
                {
                    "latest": crate.get("newest_version"),
                    "downloads": crate.get("downloads"),
                    "recent_downloads": crate.get("recent_downloads"),
                    "repository": crate.get("repository"),
                    "updated_at": crate.get("updated_at"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind == "rubygems":
        url = f"https://rubygems.org/api/v1/gems/{quote(name)}.json"
        data, error = fetch_json(url)
        result["url"] = f"https://rubygems.org/gems/{name}"
        if isinstance(data, dict):
            result.update(
                {
                    "latest": data.get("version"),
                    "downloads": data.get("downloads"),
                    "version_downloads": data.get("version_downloads"),
                    "source_code_uri": data.get("source_code_uri"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind == "packagist":
        url = f"https://repo.packagist.org/p2/{quote(name, safe='/')}.json"
        data, error = fetch_json(url)
        result["url"] = f"https://packagist.org/packages/{name}"
        if isinstance(data, dict):
            packages = data.get("packages", {}).get(name, [])
            latest = packages[0] if packages else {}
            result.update(
                {
                    "latest": latest.get("version"),
                    "time": latest.get("time"),
                    "source": latest.get("source"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind == "nuget":
        lowered = name.lower()
        url = f"https://api.nuget.org/v3/registration5-semver1/{quote(lowered)}/index.json"
        data, error = fetch_json(url)
        result["url"] = f"https://www.nuget.org/packages/{name}"
        if isinstance(data, dict):
            result.update({"count": data.get("count")})
        else:
            result["error"] = error
        return result

    if kind == "hex":
        url = f"https://hex.pm/api/packages/{quote(name)}"
        data, error = fetch_json(url)
        result["url"] = f"https://hex.pm/packages/{name}"
        if isinstance(data, dict):
            result.update(
                {
                    "latest": data.get("latest_version"),
                    "downloads": data.get("downloads", {}).get("all"),
                    "repository": data.get("meta", {}).get("links", {}).get("GitHub"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind == "pub":
        url = f"https://pub.dev/api/packages/{quote(name)}"
        data, error = fetch_json(url)
        result["url"] = f"https://pub.dev/packages/{name}"
        if isinstance(data, dict):
            latest = data.get("latest", {})
            result.update({"latest": latest.get("version"), "pubspec": latest.get("pubspec")})
        else:
            result["error"] = error
        return result

    if kind == "maven":
        if ":" not in name:
            result["error"] = "maven registry name must be groupId:artifactId"
            return result
        group_id, artifact_id = name.split(":", 1)
        query = quote(f'g:"{group_id}" AND a:"{artifact_id}"')
        url = f"https://search.maven.org/solrsearch/select?q={query}&rows=1&wt=json"
        data, error = fetch_json(url)
        result["url"] = f"https://search.maven.org/artifact/{group_id}/{artifact_id}"
        if isinstance(data, dict):
            docs = data.get("response", {}).get("docs", [])
            result.update(docs[0] if docs else {"error": "not found"})
        else:
            result["error"] = error
        return result

    if kind == "swift":
        query = urlencode({"query": name})
        url = f"https://swiftpackageindex.com/search?{query}"
        text, error = fetch_text(url, accept="text/html,*/*")
        result["url"] = f"https://swiftpackageindex.com/search?{query}"
        if text is None:
            result["error"] = error
            return result
        package = parse_swift_search(text, name)
        if package:
            result.update(package)
        else:
            result["error"] = "not found in Swift Package Index search results"
        return result

    if kind in {"perl", "cpan", "metacpan"}:
        url = f"https://fastapi.metacpan.org/v1/release/{quote(name)}"
        data, error = fetch_json(url)
        if not isinstance(data, dict):
            module_url = f"https://fastapi.metacpan.org/v1/module/{quote(name)}"
            data, error = fetch_json(module_url)
            url = module_url
        result["api"] = url
        if isinstance(data, dict):
            distribution = data.get("distribution") or name
            resources = data.get("resources") or {}
            repository = resources.get("repository") or {}
            result.update(
                {
                    "url": f"https://metacpan.org/dist/{distribution}",
                    "latest": data.get("version"),
                    "date": data.get("date"),
                    "abstract": data.get("abstract"),
                    "author": data.get("author"),
                    "download_url": data.get("download_url"),
                    "repository": repository.get("web") or repository.get("url"),
                }
            )
        else:
            result["url"] = f"https://metacpan.org/dist/{name}"
            result["error"] = error
        return result

    if kind in {"r", "cran"}:
        package_url = f"https://cran.r-project.org/web/packages/{quote(name)}/DESCRIPTION"
        text, error = fetch_text(package_url)
        result["url"] = f"https://cran.r-project.org/package={name}"
        if text is not None:
            data = parse_description(text)
            result.update(
                {
                    "latest": data.get("Version"),
                    "title": data.get("Title"),
                    "description": data.get("Description"),
                    "published": data.get("Date/Publication") or data.get("Date"),
                    "project_urls": data.get("URL"),
                    "bug_reports": data.get("BugReports"),
                }
            )
        else:
            result["error"] = error
        return result

    if kind in {"lua", "luarocks"}:
        search_url = f"https://luarocks.org/search?{urlencode({'q': name})}"
        text, error = fetch_text(search_url, accept="text/html,*/*")
        result["url"] = search_url
        if text is None:
            result["error"] = error
            return result
        package = parse_luarocks_search(text, name)
        if package:
            result.update(package)
        else:
            result["error"] = "not found in LuaRocks search results"

        author = result.get("author")
        manifest_url = f"https://luarocks.org/manifests/{quote(str(author))}/manifest" if author else "https://luarocks.org/manifest"
        manifest, manifest_error = fetch_text(manifest_url)
        if manifest is None and author:
            manifest_url = "https://luarocks.org/manifest"
            manifest, manifest_error = fetch_text(manifest_url)
        if manifest is not None:
            versions = sorted(lua_manifest_versions(manifest, name), key=version_key)
            stable_versions = [version for version in versions if re.match(r"\d", version)]
            result["manifest"] = manifest_url
            result["versions"] = versions[-10:]
            result["latest"] = stable_versions[-1] if stable_versions else (versions[-1] if versions else None)
        elif "error" not in result:
            result["error"] = manifest_error
        return result

    result["error"] = f"unsupported registry kind: {kind}"
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", action="append", default=[], help="GitHub repository URL")
    parser.add_argument(
        "--registry",
        action="append",
        type=parse_registry,
        default=[],
        help="Registry spec KIND:NAME, e.g. npm:marked, pypi:pyyaml, maven:group:artifact",
    )
    args = parser.parse_args()

    output = {
        "github": [collect_github(repo) for repo in args.repo],
        "registry": [collect_registry(spec) for spec in args.registry],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
