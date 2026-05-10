#!/usr/bin/env python3
"""Small stdlib-only HTTP helper for omv research scripts."""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from http.client import HTTPResponse
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


USER_AGENT = os.environ.get(
    "OMV_USER_AGENT",
    "omv-find-skill/1.0 (+https://github.com/bx33661/ohmyvul)",
)
TIMEOUT = float(os.environ.get("OMV_HTTP_TIMEOUT", "20"))
RETRIES = int(os.environ.get("OMV_HTTP_RETRIES", "1"))
MAX_RETRY_AFTER = float(os.environ.get("OMV_HTTP_MAX_RETRY_AFTER", "5"))
RETRYABLE_STATUS = {408, 425, 429, 500, 502, 503, 504}


@dataclass(frozen=True)
class HttpFailure:
    reason: str
    url: str
    status: int | None = None
    message: str = ""
    retry_after: str | None = None

    def brief(self) -> str:
        parts = [self.reason]
        if self.status is not None:
            parts.append(f"HTTP {self.status}")
        if self.retry_after:
            parts.append(f"retry-after={self.retry_after}")
        if self.message:
            parts.append(self.message)
        parts.append(self.url)
        return " | ".join(parts)


@dataclass(frozen=True)
class HttpResult:
    url: str
    status: int | None
    headers: dict[str, str]
    body: bytes | None = None
    failure: HttpFailure | None = None

    @property
    def ok(self) -> bool:
        return self.failure is None and self.status is not None and 200 <= self.status < 300

    def text(self) -> str:
        charset = _content_charset(self.headers) or "utf-8"
        return (self.body or b"").decode(charset, errors="replace")


def _github_token() -> str:
    return os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or ""


def _headers(url: str, accept: str) -> dict[str, str]:
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": accept,
    }
    token = _github_token()
    if token and urlparse(url).hostname == "api.github.com":
        headers["Authorization"] = f"Bearer {token}"
        headers["X-GitHub-Api-Version"] = "2022-11-28"
    return headers


def _content_charset(headers: dict[str, str]) -> str | None:
    content_type = headers.get("content-type") or headers.get("Content-Type") or ""
    for part in content_type.split(";"):
        part = part.strip()
        if part.lower().startswith("charset="):
            return part.split("=", 1)[1].strip() or None
    return None


def _response_headers(response: HTTPResponse | HTTPError) -> dict[str, str]:
    return {key.lower(): value for key, value in response.headers.items()}


def _retry_after(headers: dict[str, str]) -> str | None:
    return headers.get("retry-after")


def _classify_status(status: int, headers: dict[str, str], body: bytes) -> str:
    body_text = body[:4096].decode("utf-8", errors="replace").lower()
    remaining = headers.get("x-ratelimit-remaining")
    if status == 401:
        return "auth_required"
    if status == 403:
        if remaining == "0" or "rate limit" in body_text or "secondary rate" in body_text:
            return "rate_limited"
        return "bot_blocked_or_forbidden"
    if status == 404:
        return "not_found"
    if status == 429:
        return "rate_limited"
    if 500 <= status <= 599:
        return "upstream_error"
    return "http_error"


def _body_message(body: bytes) -> str:
    text = body[:4096].decode("utf-8", errors="replace").strip()
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return re.sub(r"\s+", " ", text)[:240]
    if isinstance(parsed, dict) and parsed.get("message"):
        return re.sub(r"\s+", " ", str(parsed["message"]))[:240]
    return re.sub(r"\s+", " ", text)[:240]


def _classify_url_error(exc: URLError) -> str:
    reason = str(getattr(exc, "reason", exc)).lower()
    if "timed out" in reason or "timeout" in reason:
        return "network_timeout"
    if "ssl" in reason or "certificate" in reason:
        return "tls_error"
    return "network_error"


def _sleep_before_retry(headers: dict[str, str], attempt: int) -> None:
    retry_after = _retry_after(headers)
    if retry_after and retry_after.isdigit():
        delay = min(float(retry_after), MAX_RETRY_AFTER)
    else:
        delay = min(0.5 * (2 ** attempt), MAX_RETRY_AFTER)
    if delay > 0:
        time.sleep(delay)


def fetch(url: str, accept: str = "text/plain,text/html,*/*", timeout: float = TIMEOUT, retries: int = RETRIES) -> HttpResult:
    last_result: HttpResult | None = None
    attempts = max(0, retries) + 1
    for attempt in range(attempts):
        request = Request(url, headers=_headers(url, accept))
        try:
            with urlopen(request, timeout=timeout) as response:
                headers = _response_headers(response)
                return HttpResult(url=url, status=response.status, headers=headers, body=response.read())
        except HTTPError as exc:
            headers = _response_headers(exc)
            body = exc.read()
            failure = HttpFailure(
                reason=_classify_status(exc.code, headers, body),
                status=exc.code,
                retry_after=_retry_after(headers),
                message=_body_message(body),
                url=url,
            )
            last_result = HttpResult(url=url, status=exc.code, headers=headers, body=body, failure=failure)
            if exc.code in RETRYABLE_STATUS and attempt + 1 < attempts:
                _sleep_before_retry(headers, attempt)
                continue
            return last_result
        except TimeoutError:
            failure = HttpFailure(reason="network_timeout", url=url, message="request timed out")
            last_result = HttpResult(url=url, status=None, headers={}, failure=failure)
            if attempt + 1 < attempts:
                _sleep_before_retry({}, attempt)
                continue
            return last_result
        except URLError as exc:
            failure = HttpFailure(reason=_classify_url_error(exc), url=url, message=str(getattr(exc, "reason", exc)))
            last_result = HttpResult(url=url, status=None, headers={}, failure=failure)
            if attempt + 1 < attempts:
                _sleep_before_retry({}, attempt)
                continue
            return last_result
    return last_result or HttpResult(
        url=url,
        status=None,
        headers={},
        failure=HttpFailure(reason="request_not_attempted", url=url),
    )


def fetch_text(url: str, accept: str = "text/plain,text/html,*/*") -> tuple[str | None, str | None]:
    result = fetch(url, accept=accept)
    if not result.ok:
        return None, result.failure.brief() if result.failure else f"http_error: {url}"
    try:
        return result.text(), None
    except UnicodeDecodeError as exc:
        return None, f"decode_error: {exc}: {url}"


def fetch_json(url: str) -> tuple[dict[str, Any] | list[Any] | None, str | None]:
    result = fetch(url, accept="application/json")
    if not result.ok:
        return None, result.failure.brief() if result.failure else f"http_error: {url}"
    try:
        return json.loads(result.text()), None
    except json.JSONDecodeError as exc:
        return None, f"invalid_json: {exc}: {url}"
