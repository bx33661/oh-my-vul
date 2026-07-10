# Request Broker

`omv request` is a cache-aware request broker for passive metadata collection. It exists because `/omv-find` depends on public package registries, GitHub metadata, raw source files, and source archives; those sources can return rate limits, bot blocks, missing paths, or transient network failures.

The broker does not attack targets, submit forms, log in, or run exploit traffic. It only fetches public URLs that are already part of passive research.

## Commands

Check source health before a research run:

```sh
omv request preflight
omv request preflight --json
omv request preflight --refresh
```

Fetch one public URL through the same classification and cache path:

```sh
omv request fetch https://registry.npmjs.org/markdown-it --json
omv request fetch https://api.github.com/repos/owner/repo --accept application/json --refresh
```

## What Preflight Checks

The preflight command currently checks representative public metadata sources:

| Source | Purpose |
|---|---|
| `github-api` | GitHub API availability and rate-limit state |
| `raw-github` | raw source file availability |
| `npm-registry` | npm registry availability |
| `pypi` | PyPI JSON metadata availability |

`github-api` can return HTTP 200 while `x-ratelimit-remaining` is `0`; `omv` treats that as `warn`, because deeper GitHub metadata requests will still fail until reset or token auth is available.

## Cache

Responses are cached under:

```text
.omv/cache/http/
```

Cache keys include both URL and `Accept` header. Successful responses use response `Cache-Control: max-age` when present, otherwise a default success TTL. Failed responses are cached briefly so the finder does not repeatedly hit a source that is already blocked or rate-limited.

Use `--refresh` to bypass a fresh cache entry and fetch again.

## Destination And Resource Safety

The broker accepts only public HTTP(S) destinations. It rejects URL credentials, local hostnames, non-public literal IP addresses, and hostnames when any DNS result is private, loopback, link-local, multicast, documentation-only, or otherwise non-public.

Redirects are followed manually. Every hop is resolved and validated again, the chain is limited to five redirects, and host-specific headers are rebuilt for each hop. A GitHub API token is therefore never forwarded to another host.

Response bodies are streamed with an 8 MiB default hard limit. The broker rejects an oversized declared `Content-Length` before buffering and cancels a stream as soon as its observed bytes exceed the limit.

The request controls can be tuned with environment variables:

| Variable | Default | Purpose |
|---|---:|---|
| `OMV_HTTP_TIMEOUT_MS` | `20000` | Timeout for DNS validation and each network attempt. |
| `OMV_HTTP_RETRIES` | `1` | Retry count for timeouts, transport errors, and retryable HTTP status codes. |
| `OMV_HTTP_MAX_BODY_BYTES` | `8388608` | Maximum response bytes read into memory. |
| `OMV_USER_AGENT` | package-derived | Override the default `omv-cli/<version>` identity. |

## JSON Shape

`omv request fetch <url> --json` returns a structured result:

```json
{
  "url": "https://api.github.com/repos/owner/repo",
  "accept": "application/json",
  "ok": false,
  "status": 403,
  "cached": false,
  "cachePath": ".omv/cache/http/<hash>.json",
  "fetchedAt": "2026-07-10T05:31:38.616Z",
  "expiresAt": "2026-07-10T05:36:38.616Z",
  "headers": {
    "x-ratelimit-remaining": "0"
  },
  "bodyBytes": 120,
  "bodySha256": "...",
  "rateLimit": {
    "limit": 60,
    "remaining": 0,
    "reset": "2026-07-10T05:52:00.000Z",
    "resource": "core"
  },
  "recommendation": "Set GITHUB_TOKEN/GH_TOKEN or wait for the rate-limit reset before deep GitHub metadata checks.",
  "failure": {
    "reason": "rate_limited",
    "status": 403,
    "message": "API rate limit exceeded"
  }
}
```

Sensitive response headers such as `set-cookie`, `cookie`, and `authorization` are not stored in the cache output.

## Failure Reasons

| Reason | Meaning | Typical next step |
|---|---|---|
| `rate_limited` | The source is throttling requests. | Set `GITHUB_TOKEN`/`GH_TOKEN`, reduce request volume, or wait for reset. |
| `auth_required` | The source requires authentication. | Use only public metadata APIs that support token auth; do not automate private or login-gated pages. |
| `bot_blocked_or_forbidden` | The source denied the request without a clear rate-limit signal. | Prefer registry APIs, package archives, or other primary public sources. |
| `not_found` | The URL or path is missing. | Verify default branch, tags, registry manifests, or source archive paths. |
| `network_timeout` | The request timed out. | Retry later or use registry/archive fallback. |
| `network_error` | DNS/TLS/transport error. | Retry later and keep the field unverified. |
| `upstream_error` | 5xx response from upstream. | Retry later; do not infer candidate quality from this. |
| `invalid_url` | URL is not `http` or `https`. | Fix the URL before retrying. |
| `unsafe_destination` | URL credentials or a local/non-public destination was rejected. | Use a public primary-source endpoint. |
| `too_many_redirects` | The redirect chain exceeded five hops. | Use the final public URL directly. |
| `response_too_large` | The response exceeded the configured byte limit. | Use a smaller metadata endpoint or raise the limit only for a trusted source. |

## GitHub Token

If `GITHUB_TOKEN` or `GH_TOKEN` is present, the broker uses it for GitHub API requests. It does not send the token to raw GitHub, registries, or unrelated hosts.

```sh
export GITHUB_TOKEN=ghp_...
omv request preflight --refresh
```

## How Finder Should Use It

Recommended sequence for request-heavy `/omv-find` sessions:

1. Run `omv request preflight`.
2. If GitHub API is rate-limited, prefer registry metadata and source archive URLs before GitHub API-heavy checks.
3. Use `omv request fetch <url> --json` for one-off diagnostics when a key URL is rejected.
4. Record `failure.reason`, `recommendation`, and any unverified fields instead of fabricating metadata.

The Python helper scripts remain useful inside installed skills, but the TypeScript broker is the product surface for cache, diagnostics, and future host-aware budgets.

## Playwright

Playwright is intentionally not part of the default request broker. Browser automation is slower, heavier, and easier to confuse with crawling. It can be considered later as an optional fallback for a small number of high-value public metadata pages when stable APIs and package archives are not enough.

If browser fallback is added later, it should stay opt-in, bounded, public-only, and separate from default `/omv-find` request flow.
