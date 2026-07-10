import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { existsSync, readFileSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import { BlockList, isIP } from "net";
import { dirname, join } from "path";
import { httpCacheDir, packageRoot } from "./paths.js";

export type RequestFailureReason =
  | "auth_required"
  | "rate_limited"
  | "bot_blocked_or_forbidden"
  | "not_found"
  | "upstream_error"
  | "network_timeout"
  | "network_error"
  | "invalid_url"
  | "unsafe_destination"
  | "too_many_redirects"
  | "response_too_large"
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
  resolver?: RequestResolver;
}

export type RequestResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

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
const FALLBACK_TIMEOUT_MS = 20_000;
const FALLBACK_RETRIES = 1;
const SUCCESS_TTL_MS = Number(process.env.OMV_HTTP_CACHE_SUCCESS_MS ?? String(24 * 60 * 60 * 1000));
const FAILURE_TTL_MS = Number(process.env.OMV_HTTP_CACHE_FAILURE_MS ?? String(5 * 60 * 1000));
const MAX_CACHE_BODY_BYTES = Number(process.env.OMV_HTTP_CACHE_MAX_BODY_BYTES ?? String(1024 * 1024));
const DEFAULT_MAX_BODY_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const LOCAL_HOST_SUFFIXES = [".localhost", ".local", ".localdomain", ".internal", ".home", ".lan"];
const NON_PUBLIC_IPV4 = createNonPublicIpv4BlockList();
const NON_PUBLIC_IPV6 = createNonPublicIpv6BlockList();
const defaultResolver: RequestResolver = async (hostname) => lookup(hostname, { all: true, verbatim: true });
const DEFAULT_USER_AGENT = `omv-cli/${installedPackageVersion()} (+https://github.com/bx33661/oh-my-vul)`;

export async function requestFetch(url: string, options: RequestFetchOptions = {}): Promise<RequestFetchResult> {
  const accept = options.accept ?? DEFAULT_ACCEPT;
  const projectRoot = options.projectRoot ?? process.cwd();
  const timeoutMs = configuredTimeoutMs(options.timeoutMs);
  const retries = configuredRetries(options.retries);
  const cachePath = requestCachePath(url, accept, projectRoot);
  const destination = await validateInitialDestinationWithRetries(
    url,
    options.resolver ?? defaultResolver,
    timeoutMs,
    retries,
  );
  if (!destination.ok) {
    return failedRequestResult(url, accept, cachePath, destination.failure);
  }
  if (!options.refresh) {
    const cached = await readFreshCache(cachePath);
    if (cached) {
      return cacheEntryToResult(cached, cachePath, true);
    }
  }

  const result = await fetchWithRetries(destination.url.toString(), {
    accept,
    cachePath,
    timeoutMs,
    retries,
    resolver: options.resolver ?? defaultResolver,
    maxBodyBytes: configuredMaxBodyBytes(),
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
  options: {
    accept: string;
    cachePath: string;
    timeoutMs: number;
    retries: number;
    resolver: RequestResolver;
    maxBodyBytes: number;
  },
): Promise<RequestFetchResult> {
  const attempts = Math.max(0, options.retries) + 1;
  let last: RequestFetchResult | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    last = await fetchOnce(url, options);
    if (last.ok || !shouldRetry(last, attempt, attempts)) {
      return last;
    }
    await sleep(retryDelayMs(last, attempt));
  }
  return last as RequestFetchResult;
}

async function fetchOnce(
  url: string,
  options: {
    accept: string;
    cachePath: string;
    timeoutMs: number;
    resolver: RequestResolver;
    maxBodyBytes: number;
  },
): Promise<RequestFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const fetchedAt = new Date().toISOString();
  try {
    let currentUrl = url;
    for (let redirectCount = 0; ; redirectCount += 1) {
      const response = await fetch(currentUrl, {
        headers: requestHeaders(currentUrl, options.accept),
        redirect: "manual",
        signal: controller.signal,
      });
      const location = response.headers.get("location");
      if (REDIRECT_STATUS.has(response.status) && location) {
        if (redirectCount >= MAX_REDIRECTS) {
          await cancelBody(response);
          return failedRequestResult(url, options.accept, options.cachePath, {
            reason: "too_many_redirects",
            status: response.status,
            message: `redirect limit of ${MAX_REDIRECTS} exceeded`,
          });
        }
        const nextUrl = resolveRedirect(location, currentUrl);
        const destination = await validateDestination(nextUrl, options.resolver, controller.signal);
        if (!destination.ok) {
          await cancelBody(response);
          return failedRequestResult(url, options.accept, options.cachePath, destination.failure);
        }
        await cancelBody(response);
        currentUrl = destination.url.toString();
        continue;
      }

      const headers = sanitizeHeaders(headersToRecord(response.headers));
      const bodyRead = await readBoundedBody(response, options.maxBodyBytes);
      if (!bodyRead.ok) {
        const result = failedRequestResult(url, options.accept, options.cachePath, {
          reason: "response_too_large",
          status: response.status,
          message: `response exceeded the ${options.maxBodyBytes} byte limit`,
        });
        return {
          ...result,
          status: response.status,
          headers,
          bodyBytes: bodyRead.bodyBytes,
        };
      }
      const body = bodyRead.body;
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
    }
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
    "user-agent": process.env.OMV_USER_AGENT ?? DEFAULT_USER_AGENT,
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
    case "unsafe_destination":
      return "Use a public HTTP(S) endpoint without URL credentials; local and non-public network destinations are blocked.";
    case "too_many_redirects":
      return "Use the final public source URL directly or choose a primary-source endpoint with a bounded redirect chain.";
    case "response_too_large":
      return "Use a smaller public metadata endpoint or raise OMV_HTTP_MAX_BODY_BYTES only for a trusted source.";
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
  return retryBackoffMs(attempt);
}

function retryBackoffMs(attempt: number): number {
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

type DestinationValidation =
  | { ok: true; url: URL }
  | { ok: false; failure: RequestFailure };

async function validateInitialDestination(
  raw: string,
  resolver: RequestResolver,
  timeoutMs: number,
): Promise<DestinationValidation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await validateDestination(raw, resolver, controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function validateInitialDestinationWithRetries(
  raw: string,
  resolver: RequestResolver,
  timeoutMs: number,
  retries: number,
): Promise<DestinationValidation> {
  const attempts = retries + 1;
  let result: DestinationValidation | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    result = await validateInitialDestination(raw, resolver, timeoutMs);
    if (result.ok || result.failure.reason !== "network_timeout" || attempt + 1 >= attempts) {
      return result;
    }
    await sleep(retryBackoffMs(attempt));
  }
  return result as DestinationValidation;
}

async function validateDestination(
  raw: string,
  resolver: RequestResolver,
  signal?: AbortSignal,
): Promise<DestinationValidation> {
  const parsed = parseHttpUrl(raw);
  if (!parsed) {
    return {
      ok: false,
      failure: { reason: "invalid_url", message: "URL must use http or https" },
    };
  }
  if (parsed.username || parsed.password) {
    return unsafeDestination("URL credentials are not allowed");
  }

  const hostname = stripIpv6Brackets(parsed.hostname).toLowerCase();
  if (isLocalHostname(hostname)) {
    return unsafeDestination(`local hostname is not allowed: ${hostname}`);
  }
  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    return isPublicAddress(hostname, literalFamily)
      ? { ok: true, url: parsed }
      : unsafeDestination(`non-public IP address is not allowed: ${hostname}`);
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolveWithAbort(resolver, hostname, signal);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        failure: { reason: "network_timeout", message: "request timed out during DNS resolution" },
      };
    }
    const detail = error instanceof Error ? error.message : String(error);
    return unsafeDestination(`hostname could not be resolved safely: ${detail}`);
  }
  if (addresses.length === 0) {
    return unsafeDestination("hostname resolved to no addresses");
  }
  for (const resolved of addresses) {
    const family = isIP(resolved.address);
    if (family === 0 || family !== resolved.family || !isPublicAddress(resolved.address, family)) {
      return unsafeDestination(`hostname resolved to a non-public address: ${resolved.address}`);
    }
  }
  return { ok: true, url: parsed };
}

function unsafeDestination(message: string): DestinationValidation {
  return { ok: false, failure: { reason: "unsafe_destination", message } };
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || LOCAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

function isPublicAddress(address: string, family: number): boolean {
  if (family === 4) return !NON_PUBLIC_IPV4.check(address, "ipv4");
  if (family === 6) return !NON_PUBLIC_IPV6.check(address, "ipv6");
  return false;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
}

function createNonPublicIpv4BlockList(): BlockList {
  const blocked = new BlockList();
  for (const [network, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4],
  ] as Array<[string, number]>) {
    blocked.addSubnet(network, prefix, "ipv4");
  }
  return blocked;
}

function createNonPublicIpv6BlockList(): BlockList {
  const blocked = new BlockList();
  for (const [network, prefix] of [
    ["::", 3],
    ["4000::", 2],
    ["8000::", 1],
    ["::", 128],
    ["::1", 128],
    ["::ffff:0:0", 96],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001::", 23],
    ["2001:2::", 48],
    ["2001:db8::", 32],
    ["2001:10::", 28],
    ["2002::", 16],
    ["3fff::", 20],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8],
  ] as Array<[string, number]>) {
    blocked.addSubnet(network, prefix, "ipv6");
  }
  return blocked;
}

function failedRequestResult(
  url: string,
  accept: string,
  cachePath: string,
  failure: RequestFailure,
): RequestFetchResult {
  return {
    url,
    accept,
    ok: false,
    cached: false,
    cachePath,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FAILURE_TTL_MS).toISOString(),
    headers: {},
    bodyBytes: 0,
    recommendation: recommendNextStep(url, false, failure),
    failure,
  };
}

function resolveRedirect(location: string, currentUrl: string): string {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return location;
  }
}

async function cancelBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The destination is already rejected; cancellation is best effort.
  }
}

type BodyReadResult =
  | { ok: true; body: Buffer }
  | { ok: false; bodyBytes: number };

async function readBoundedBody(response: Response, maxBodyBytes: number): Promise<BodyReadResult> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBodyBytes) {
    await cancelBody(response);
    return { ok: false, bodyBytes: 0 };
  }
  if (!response.body) {
    return { ok: true, body: Buffer.alloc(0) };
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let bodyBytes = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const chunk = Buffer.from(next.value);
      bodyBytes += chunk.byteLength;
      if (bodyBytes > maxBodyBytes) {
        try {
          await reader.cancel("response body limit exceeded");
        } catch {
          // The size failure remains authoritative when cancellation itself fails.
        }
        return { ok: false, bodyBytes };
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  return { ok: true, body: Buffer.concat(chunks, bodyBytes) };
}

function configuredMaxBodyBytes(): number {
  const configured = Number(process.env.OMV_HTTP_MAX_BODY_BYTES ?? DEFAULT_MAX_BODY_BYTES);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : DEFAULT_MAX_BODY_BYTES;
}

function configuredTimeoutMs(value: number | undefined): number {
  const configured = value ?? Number(process.env.OMV_HTTP_TIMEOUT_MS ?? FALLBACK_TIMEOUT_MS);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : FALLBACK_TIMEOUT_MS;
}

function configuredRetries(value: number | undefined): number {
  if (value !== undefined) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }
  const configured = Number(process.env.OMV_HTTP_RETRIES ?? FALLBACK_RETRIES);
  return Number.isSafeInteger(configured) && configured >= 0 ? configured : FALLBACK_RETRIES;
}

function resolveWithAbort(
  resolver: RequestResolver,
  hostname: string,
  signal: AbortSignal | undefined,
): Promise<Array<{ address: string; family: number }>> {
  if (!signal) return resolver(hostname);
  if (signal.aborted) return Promise.reject(abortError());

  return new Promise((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal.addEventListener("abort", onAbort, { once: true });
    resolver(hostname).then(
      (addresses) => {
        signal.removeEventListener("abort", onAbort);
        resolve(addresses);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function abortError(): Error {
  const error = new Error("request timed out during DNS resolution");
  error.name = "AbortError";
  return error;
}

function installedPackageVersion(): string {
  try {
    const parsed = JSON.parse(readFileSync(join(packageRoot(), "package.json"), "utf-8")) as { version?: unknown };
    return typeof parsed.version === "string" && parsed.version ? parsed.version : "unknown";
  } catch {
    return "unknown";
  }
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
