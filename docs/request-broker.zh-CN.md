# 请求代理 Request Broker

`omv request` 是面向被动元数据收集的缓存型请求代理。`/omv-find` 依赖公开 package registry、GitHub 元数据、raw 源码文件和源码归档；这些来源经常会出现限流、拒绝、路径不存在或网络超时。

请求代理不攻击目标、不提交表单、不登录、不发送 exploit 流量。它只拉取被动研究需要的公开 URL。

## 命令

研究前检查主要来源健康状态：

```sh
omv request preflight
omv request preflight --json
omv request preflight --refresh
```

用同一套分类和缓存逻辑拉取单个公开 URL：

```sh
omv request fetch https://registry.npmjs.org/markdown-it --json
omv request fetch https://api.github.com/repos/owner/repo --accept application/json --refresh
```

## Preflight 检查什么

`preflight` 当前检查几个代表性公开元数据来源：

| 来源 | 用途 |
|---|---|
| `github-api` | GitHub API 可用性和限流状态 |
| `raw-github` | raw 源码文件可用性 |
| `npm-registry` | npm registry 可用性 |
| `pypi` | PyPI JSON 元数据可用性 |

GitHub 的 `/rate_limit` 可能返回 HTTP 200，但 `x-ratelimit-remaining` 已经是 `0`。这种情况下 `omv` 会标为 `warn`，因为继续做 GitHub metadata 深查仍然会失败，除非等待 reset 或配置 token。

## 缓存

响应缓存放在：

```text
.omv/cache/http/
```

缓存 key 包含 URL 和 `Accept` header。成功响应优先尊重 `Cache-Control: max-age`，否则使用默认成功 TTL；失败响应只短暂缓存，避免 finder 对已经被拒绝或限流的来源反复请求。

使用 `--refresh` 可以绕过新鲜缓存并重新请求。

## JSON 字段

`omv request fetch <url> --json` 会返回结构化结果：

```json
{
  "url": "https://api.github.com/repos/owner/repo",
  "accept": "application/json",
  "ok": false,
  "status": 403,
  "cached": false,
  "cachePath": ".omv/cache/http/<hash>.json",
  "fetchedAt": "2026-05-08T17:31:38.616Z",
  "expiresAt": "2026-05-08T17:36:38.616Z",
  "headers": {
    "x-ratelimit-remaining": "0"
  },
  "bodyBytes": 120,
  "bodySha256": "...",
  "rateLimit": {
    "limit": 60,
    "remaining": 0,
    "reset": "2026-05-08T17:52:00.000Z",
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

`set-cookie`、`cookie`、`authorization` 等敏感响应头不会写入缓存输出。

## 失败分类

| 分类 | 含义 | 常见下一步 |
|---|---|---|
| `rate_limited` | 来源正在限流。 | 设置 `GITHUB_TOKEN`/`GH_TOKEN`、降低请求量或等待 reset。 |
| `auth_required` | 来源要求认证。 | 只对支持 token 的公开元数据 API 使用 token；不要自动化私有或登录页。 |
| `bot_blocked_or_forbidden` | 来源拒绝请求，但没有明确限流信号。 | 优先改用 registry API、package archive 或其它公开主来源。 |
| `not_found` | URL 或路径不存在。 | 检查 default branch、tag、registry manifest 或 source archive。 |
| `network_timeout` | 请求超时。 | 稍后重试，或使用 registry/archive fallback。 |
| `network_error` | DNS/TLS/传输错误。 | 稍后重试，并把字段保持为未确认。 |
| `upstream_error` | 上游返回 5xx。 | 稍后重试；不要据此判断候选项目质量。 |
| `invalid_url` | URL 不是 `http` 或 `https`。 | 修正 URL 后重试。 |

## GitHub Token

如果环境变量里有 `GITHUB_TOKEN` 或 `GH_TOKEN`，broker 会只在 GitHub API 请求上使用它。token 不会发送给 raw GitHub、registry 或其它 host。

```sh
export GITHUB_TOKEN=ghp_...
omv request preflight --refresh
```

## Finder 如何使用

请求密集型 `/omv-find` 推荐流程：

1. 先运行 `omv request preflight`。
2. 如果 GitHub API 已限流，优先使用 registry 元数据和 source archive URL，减少 GitHub API 深查。
3. 对关键 URL 的拒绝或异常，使用 `omv request fetch <url> --json` 做单点诊断。
4. 在输出里记录 `failure.reason`、`recommendation` 和未确认字段，不要编造 metadata。

Python helper 仍然适合安装后的 skill 自包含运行；TypeScript broker 是面向用户的产品层，用来承载缓存、诊断和后续 host-aware budget。

## Playwright

Playwright 不进入默认请求链。浏览器自动化更重、更慢，也更容易被误认为爬虫。它可以作为未来的可选 fallback，只用于少量高价值公开元数据页面，并且必须在稳定 API 和 package archive 都不够用时才启用。

如果后续加入 browser fallback，应保持 opt-in、强预算、只读公开页面，并和默认 `/omv-find` 请求流程隔离。
