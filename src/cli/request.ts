import { createHash } from "crypto";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { httpCacheDir } from "./paths.js";

export type RequestFailureReason =
  | "auth_required"
  | "rate_limited"
  | "bot_blocked_or_forbidden"
  | "not_found"
  | "upstream_error"
  | "network_timeout"
  | "network_error"
  | "invalid_url"
  | "http_error";

export interface RequestFailure {
  reason: RequestFailureReason;
  status?: number;
  message: string;
  retryAfter?: string;
}

export interface RequestRateLimit {
  limit?: number;
  remaining?: number;
  reset?: string;
  resource?: string;
}

export interface RequestFetchResult {
  url: string;
  accept: string;
  ok: boolean;
  status?: number;
  cached: boolean;
  cachePath: string;
  fetchedAt: string;
  expiresAt?: string;
  headers: Record<string, string>;
  bodyBytes: number;
  bodySha256?: string;
  bodyPreview?: string;
  rateLimit?: RequestRateLimit;
  recommendation?: string;
  failure?: RequestFailure;
}

export interface RequestFetchOptions {
  accept?: string;
  refresh?: boolean;
  projectRoot?: string;
  timeoutMs?: number;
  retries?: number;
}

export interface RequestPreflightCheck {
  name: string;
  url: string;
  status: "pass" | "warn" | "fail";
  result: RequestFetchResult;
}

export interface RequestPreflightResult {
  generatedAt: string;
  cacheDir: string;
  checks: RequestPreflightCheck[];
}

interface CacheEntry {
  version: 1;
  url: string;
  accept: string;
  ok: boolean;
  status?: number;
  fetchedAt: string;
  expiresAt?: string;
  headers: Record<string, string>;
  bodyBase64?: string;
  bodyBytes: number;
  bodySha256?: string;
  bodyPreview?: string;
  rateLimit?: RequestRateLimit;
  recommendation?: string;
  failure?: RequestFailure;
}

const DEFAULT_ACCEPT = "text/plain,text/html,*/*";
const DEFAULT_TIMEOUT_MS = Number(process.env.OMV_HTTP_TIMEOUT_MS ?? "20000");
const DEFAULT_RETRIES = Number(process.env.OMV_HTTP_RETRIES ?? "1");
const SUCCESS_TTL_MS = Number(process.env.OMV_HTTP_CACHE_SUCCESS_MS ?? String(24 * 60 * 60 * 1000));
const FAILURE_TTL_MS = Number(process.env.OMV_HTTP_CACHE_FAILURE_MS ?? String(5 * 60 * 1000));
const MAX_CACHE_BODY_BYTES = Number(process.env.OMV_HTTP_CACHE_MAX_BODY_BYTES ?? String(1024 * 1024));
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export async function requestFetch(url: string, options: RequestFetchOptions = {}): Promise<RequestFetchResult> {
  const accept = options.accept ?? DEFAULT_ACCEPT;
  const projectRoot = options.projectRoot ?? process.cwd();
  const cachePath = requestCachePath(url, accept, projectRoot);
  if (!options.refresh) {
    const cached = await readFreshCache(cachePath);
    if (cached) {
      return cacheEntryToResult(cached, cachePath, true);
    }
  }

  const result = await fetchWithRetries(url, {
    accept,
    cachePath,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: options.retries ?? DEFAULT_RETRIES,
  });
  await writeCache(cachePath, result);
  return result;
}

export async function requestPreflight(options: RequestFetchOptions = {}): Promise<RequestPreflightResult> {
  const projectRoot = options.projectRoot ?? process.cwd();
  const checks: RequestPreflightCheck[] = [];
  for (const target of preflightTargets()) {
    const result = await requestFetch(target.url, {
      ...options,
      projectRoot,
      accept: target.accept,
    });
    checks.push({
      name: target.name,
      url: target.url,
      status: preflightStatus(result),
      result,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    cacheDir: httpCacheDir(projectRoot),
    checks,
  };
}

function preflightTargets(): Array<{ name: string; url: string; accept: string }> {
  return [
    { name: "github-api", url: "https://api.github.com/rate_limit", accept: "application/json" },
    { name: "raw-github", url: "https://raw.githubusercontent.com/github/gitignore/main/README.md", accept: "text/plain,*/*" },
    { name: "npm-registry", url: "https://registry.npmjs.org/-/ping", accept: "application/json" },
    { name: "pypi", url: "https://pypi.org/pypi/pip/json", accept: "application/json" },
  ];
}

function preflightStatus(result: RequestFetchResult): RequestPreflightCheck["status"] {
  if (result.url.includes("api.github.com") && result.headers["x-ratelimit-remaining"] === "0") {
    return "warn";
  }
  if (result.ok) return "pass";
  if (result.failure?.reason === "rate_limited") return "warn";
  return "fail";
}

async function fetchWithRetries(
  url: string,
  options: { accept: string; cachePath: string; timeoutMs: number; retries: number },
): Promise<RequestFetchResult> {
  const parsed = parseHttpUrl(url);
  if (!parsed) {
    return {
      url,
      accept: options.accept,
      ok: false,
      cached: false,
      cachePath: options.cachePath,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + FAILURE_TTL_MS).toISOString(),
      headers: {},
      bodyBytes: 0,
      recommendation: "Use a valid http:// or https:// URL.",
      failure: { reason: "invalid_url", message: "URL must use http or https" },
    };
  }

  const attempts = Math.max(0, options.retries) + 1;
  let last: RequestFetchResult | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await fetchOnce(parsed.toString(), options);
    if (last.ok || !shouldRetry(last, attempt, attempts)) {
      return last;
    }
    await sleep(retryDelayMs(last, attempt));
  }
  return last as RequestFetchResult;
}

async function fetchOnce(
  url: string,
  options: { accept: string; cachePath: string; timeoutMs: number },
): Promise<RequestFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const fetchedAt = new Date().toISOString();
  try {
    const response = await fetch(url, {
      headers: requestHeaders(url, options.accept),
      signal: controller.signal,
    });
    const headers = sanitizeHeaders(headersToRecord(response.headers));
    const body = Buffer.from(await response.arrayBuffer());
    const bodySha256 = sha256(body);
    const failure = response.ok ? undefined : classifyHttpFailure(response.status, headers, body);
    const rateLimit = parseRateLimit(headers);
    const recommendation = recommendNextStep(url, response.ok, failure, rateLimit);
    return {
      url,
      accept: options.accept,
      ok: response.ok,
      status: response.status,
      cached: false,
      cachePath: options.cachePath,
      fetchedAt,
      expiresAt: expiresAt(response.ok, headers, failure),
      headers,
      bodyBytes: body.byteLength,
      bodySha256,
      bodyPreview: bodyPreview(body, headers),
      rateLimit,
      recommendation,
      failure,
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "network_timeout" : "network_error";
    const failure = { reason, message: error instanceof Error ? error.message : String(error) } as RequestFailure;
    return {
      url,
      accept: options.accept,
      ok: false,
      cached: false,
      cachePath: options.cachePath,
      fetchedAt,
      expiresAt: new Date(Date.now() + FAILURE_TTL_MS).toISOString(),
      headers: {},
      bodyBytes: 0,
      recommendation: recommendNextStep(url, false, failure),
      failure,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function requestHeaders(url: string, accept: string): Record<string, string> {
  const headers: Record<string, string> = {
    "accept": accept,
    "user-agent": process.env.OMV_USER_AGENT ?? "omv-cli/0.7 (+https://github.com/bx33661/oh-my-vul)",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token && new URL(url).hostname === "api.github.com") {
    headers.authorization = `Bearer ${token}`;
    headers["x-github-api-version"] = "2022-11-28";
  }
  return headers;
}

function classifyHttpFailure(status: number, headers: Record<string, string>, body: Buffer): RequestFailure {
  const message = responseMessage(body);
  if (status === 401) return { reason: "auth_required", status, message, retryAfter: headers["retry-after"] };
  if (status === 403) {
    const lower = message.toLowerCase();
    const reason = headers["x-ratelimit-remaining"] === "0" || lower.includes("rate limit") || lower.includes("secondary rate")
      ? "rate_limited"
      : "bot_blocked_or_forbidden";
    return { reason, status, message, retryAfter: headers["retry-after"] };
  }
  if (status === 404) return { reason: "not_found", status, message, retryAfter: headers["retry-after"] };
  if (status === 429) return { reason: "rate_limited", status, message, retryAfter: headers["retry-after"] };
  if (status >= 500) return { reason: "upstream_error", status, message, retryAfter: headers["retry-after"] };
  return { reason: "http_error", status, message, retryAfter: headers["retry-after"] };
}

function parseRateLimit(headers: Record<string, string>): RequestRateLimit | undefined {
  const limit = numberHeader(headers["x-ratelimit-limit"]);
  const remaining = numberHeader(headers["x-ratelimit-remaining"]);
  const resetEpoch = numberHeader(headers["x-ratelimit-reset"]);
  const resource = headers["x-ratelimit-resource"];
  if (limit === undefined && remaining === undefined && resetEpoch === undefined && !resource) {
    return undefined;
  }
  return {
    limit,
    remaining,
    reset: resetEpoch === undefined ? undefined : new Date(resetEpoch * 1000).toISOString(),
    resource,
  };
}

function recommendNextStep(
  url: string,
  ok: boolean,
  failure?: RequestFailure,
  rateLimit?: RequestRateLimit,
): string | undefined {
  const host = parseHttpUrl(url)?.hostname ?? "";
  if (host === "api.github.com" && rateLimit?.remaining === 0) {
    return "GitHub API quota is exhausted; set GITHUB_TOKEN/GH_TOKEN or wait until the reset time.";
  }
  if (!failure) {
    return ok ? undefined : "Inspect status and retry with --refresh if this looks stale.";
  }
  switch (failure.reason) {
    case "rate_limited":
      return host === "api.github.com"
        ? "Set GITHUB_TOKEN/GH_TOKEN or wait for the rate-limit reset before deep GitHub metadata checks."
        : "Reduce request volume, respect Retry-After when present, and retry with --refresh later.";
    case "bot_blocked_or_forbidden":
      return "Prefer registry APIs, package archives, or authenticated primary APIs instead of repeatedly retrying this URL.";
    case "not_found":
      return "Check registry metadata, default branch, tag, or source archive before treating the candidate as disproven.";
    case "auth_required":
      return "Use a token only for public metadata APIs that explicitly support it; do not automate private or login-gated sources.";
    case "network_timeout":
    case "network_error":
      return "Retry with --refresh later or use a registry/archive fallback if this blocks source inspection.";
    case "invalid_url":
      return "Use a valid http:// or https:// URL.";
    case "upstream_error":
      return "Retry later and keep the field unverified until a stable primary source responds.";
    case "http_error":
      return "Inspect the status and body preview, then choose a primary-source fallback if available.";
  }
}

function expiresAt(ok: boolean, headers: Record<string, string>, failure?: RequestFailure): string {
  const ttl = ok ? cacheTtlMs(headers) : failureTtlMs(failure);
  return new Date(Date.now() + ttl).toISOString();
}

function cacheTtlMs(headers: Record<string, string>): number {
  const maxAge = headers["cache-control"]?.match(/(?:^|,\s*)max-age=(\d+)/i)?.[1];
  if (maxAge) {
    return Math.max(0, Number(maxAge) * 1000);
  }
  return SUCCESS_TTL_MS;
}

function failureTtlMs(failure?: RequestFailure): number {
  if (failure?.retryAfter && /^\d+$/.test(failure.retryAfter)) {
    return Math.min(Number(failure.retryAfter) * 1000, FAILURE_TTL_MS);
  }
  if (failure?.reason === "not_found") {
    return Math.max(FAILURE_TTL_MS, 30 * 60 * 1000);
  }
  return FAILURE_TTL_MS;
}

function responseMessage(body: Buffer): string {
  const text = body.toString("utf-8", 0, Math.min(body.byteLength, 4096)).trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (isRecord(parsed) && typeof parsed.message === "string") {
      return oneLine(parsed.message);
    }
  } catch {
    // fall through
  }
  return oneLine(text).slice(0, 240);
}

function bodyPreview(body: Buffer, headers: Record<string, string>): string | undefined {
  if (body.byteLength === 0) return undefined;
  const contentType = headers["content-type"] ?? "";
  const textLike = contentType.startsWith("text/")
    || contentType.includes("json")
    || contentType.includes("xml")
    || contentType.includes("javascript");
  if (!textLike) return undefined;
  return body.toString("utf-8", 0, Math.min(body.byteLength, 4000));
}

function shouldRetry(result: RequestFetchResult, attempt: number, attempts: number): boolean {
  if (attempt + 1 >= attempts) return false;
  if (result.status && RETRYABLE_STATUS.has(result.status)) return true;
  return result.failure?.reason === "network_timeout" || result.failure?.reason === "network_error";
}

function retryDelayMs(result: RequestFetchResult, attempt: number): number {
  const retryAfter = result.failure?.retryAfter;
  if (retryAfter && /^\d+$/.test(retryAfter)) {
    return Math.min(Number(retryAfter) * 1000, 5000);
  }
  return Math.min(500 * (2 ** attempt), 5000);
}

function requestCachePath(url: string, accept: string, projectRoot: string): string {
  const key = sha256(Buffer.from(`${accept}\n${url}`));
  return join(httpCacheDir(projectRoot), `${key}.json`);
}

async function readFreshCache(path: string): Promise<CacheEntry | undefined> {
  if (!existsSync(path)) return undefined;
  try {
    const entry = JSON.parse(await readFile(path, "utf-8")) as CacheEntry;
    if (entry.version !== 1) return undefined;
    const expiresAt = entry.expiresAt ? Date.parse(entry.expiresAt) : Number.NaN;
    if (Number.isFinite(expiresAt)) {
      return Date.now() <= expiresAt ? entry : undefined;
    }
    const age = Date.now() - Date.parse(entry.fetchedAt);
    const fallbackTtl = entry.ok ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
    return age >= 0 && age <= fallbackTtl ? entry : undefined;
  } catch {
    return undefined;
  }
}

async function writeCache(path: string, result: RequestFetchResult): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const entry: CacheEntry = {
    version: 1,
    url: result.url,
    accept: result.accept,
    ok: result.ok,
    status: result.status,
    fetchedAt: result.fetchedAt,
    expiresAt: result.expiresAt,
    headers: result.headers,
    bodyBytes: result.bodyBytes,
    bodySha256: result.bodySha256,
    bodyPreview: result.bodyPreview,
    rateLimit: result.rateLimit,
    recommendation: result.recommendation,
    failure: result.failure,
  };
  if (result.bodyPreview && Buffer.byteLength(result.bodyPreview, "utf-8") <= MAX_CACHE_BODY_BYTES) {
    entry.bodyBase64 = Buffer.from(result.bodyPreview, "utf-8").toString("base64");
  }
  await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, "utf-8");
}

function cacheEntryToResult(entry: CacheEntry, cachePath: string, cached: boolean): RequestFetchResult {
  return {
    url: entry.url,
    accept: entry.accept,
    ok: entry.ok,
    status: entry.status,
    cached,
    cachePath,
    fetchedAt: entry.fetchedAt,
    expiresAt: entry.expiresAt,
    headers: entry.headers,
    bodyBytes: entry.bodyBytes,
    bodySha256: entry.bodySha256,
    bodyPreview: entry.bodyPreview ?? (entry.bodyBase64 ? Buffer.from(entry.bodyBase64, "base64").toString("utf-8") : undefined),
    rateLimit: entry.rateLimit,
    recommendation: entry.recommendation,
    failure: entry.failure,
  };
}

function headersToRecord(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key.toLowerCase()] = value;
  });
  return output;
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const blocked = new Set(["set-cookie", "set-cookie2", "cookie", "authorization", "proxy-authorization"]);
  return Object.fromEntries(Object.entries(headers).filter(([key]) => !blocked.has(key.toLowerCase())));
}

function parseHttpUrl(raw: string): URL | undefined {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function sha256(input: Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

function numberHeader(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
