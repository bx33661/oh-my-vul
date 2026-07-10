import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { requestFetch } from "../request.js";

type TestResolver = (hostname: string) => Promise<Array<{ address: string; family: 4 | 6 }>>;

const publicResolver: TestResolver = async () => [{ address: "93.184.216.34", family: 4 }];

test("request broker rejects credentials and non-public literal destinations before fetch", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("unexpected");
    };

    const urls = [
      "https://user:secret@example.test/metadata",
      "http://localhost/metadata",
      "http://127.0.0.1/metadata",
      "http://10.0.0.5/metadata",
      "http://169.254.10.20/metadata",
      "http://[::1]/metadata",
      "http://[fc00::1]/metadata",
      "http://[fe80::1]/metadata",
      "http://[fec0::1]/metadata",
      "http://[2001:20::1]/metadata",
      "http://[3fff::1]/metadata",
    ];
    for (const url of urls) {
      const options = {
        projectRoot,
        refresh: true,
        retries: 0,
        resolver: publicResolver,
      };
      const result = await requestFetch(url, options);
      assert.equal(result.ok, false, url);
      assert.equal(result.failure?.reason, "unsafe_destination", url);
    }
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker rejects a hostname when any resolved address is non-public", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  const resolver: TestResolver = async (hostname) => {
    assert.equal(hostname, "metadata.example.test");
    return [
      { address: "93.184.216.34", family: 4 },
      { address: "192.168.1.25", family: 4 },
    ];
  };
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("unexpected");
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver };
    const result = await requestFetch("https://metadata.example.test/package", options);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "unsafe_destination");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker fetches a public destination after resolving all addresses", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  const resolved: string[] = [];
  let calls = 0;
  const resolver: TestResolver = async (hostname) => {
    resolved.push(hostname);
    return [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ];
  };
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("public", { status: 200, headers: { "content-type": "text/plain" } });
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver };
    const result = await requestFetch("https://metadata.example.test/package", options);

    assert.equal(result.ok, true);
    assert.deepEqual(resolved, ["metadata.example.test"]);
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker follows relative redirects manually", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  const calls: string[] = [];
  try {
    globalThis.fetch = async (input, init) => {
      calls.push(String(input));
      assert.equal(init?.redirect, "manual");
      if (String(input) === "https://metadata.example.test/start") {
        return new Response(null, { status: 302, headers: { location: "/final" } });
      }
      return new Response("done", { status: 200, headers: { "content-type": "text/plain" } });
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/start", options);

    assert.equal(result.ok, true);
    assert.equal(result.bodyPreview, "done");
    assert.deepEqual(calls, [
      "https://metadata.example.test/start",
      "https://metadata.example.test/final",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker rejects a redirect to a private destination", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  const calls: string[] = [];
  try {
    globalThis.fetch = async (input) => {
      calls.push(String(input));
      return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/private" } });
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/start", options);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "unsafe_destination");
    assert.deepEqual(calls, ["https://metadata.example.test/start"]);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker stops after five redirect hops", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(null, { status: 302, headers: { location: `/hop-${calls}` } });
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/start", options);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "too_many_redirects");
    assert.equal(calls, 6);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker drops GitHub credentials on a cross-host redirect", async () => {
  const originalFetch = globalThis.fetch;
  const originalToken = process.env.GITHUB_TOKEN;
  const originalGhToken = process.env.GH_TOKEN;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  const sentHeaders: Headers[] = [];
  try {
    process.env.GITHUB_TOKEN = "test-token";
    delete process.env.GH_TOKEN;
    globalThis.fetch = async (input, init) => {
      sentHeaders.push(new Headers(init?.headers));
      if (String(input).startsWith("https://api.github.com/")) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://downloads.example.test/archive.tgz" },
        });
      }
      return new Response("archive", { status: 200, headers: { "content-type": "application/octet-stream" } });
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://api.github.com/repos/example/demo/tarball", options);

    assert.equal(result.ok, true);
    assert.equal(sentHeaders.length, 2);
    assert.equal(sentHeaders[0]?.get("authorization"), "Bearer test-token");
    assert.equal(sentHeaders[1]?.get("authorization"), null);
    assert.equal(sentHeaders[1]?.get("x-github-api-version"), null);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = originalToken;
    if (originalGhToken === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = originalGhToken;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker rejects a declared response length above the configured limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalLimit = process.env.OMV_HTTP_MAX_BODY_BYTES;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  try {
    process.env.OMV_HTTP_MAX_BODY_BYTES = "4";
    globalThis.fetch = async () => new Response("tiny", {
      status: 200,
      headers: { "content-length": "100", "content-type": "text/plain" },
    });
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/large", options);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "response_too_large");
    assert.equal(result.bodyBytes, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLimit === undefined) delete process.env.OMV_HTTP_MAX_BODY_BYTES;
    else process.env.OMV_HTTP_MAX_BODY_BYTES = originalLimit;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker cancels a streamed response after it exceeds the configured limit", async () => {
  const originalFetch = globalThis.fetch;
  const originalLimit = process.env.OMV_HTTP_MAX_BODY_BYTES;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let cancelled = false;
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    process.env.OMV_HTTP_MAX_BODY_BYTES = "4";
    globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("abc"));
        controller.enqueue(new TextEncoder().encode("abc"));
        closeTimer = setTimeout(() => controller.close(), 50);
      },
      cancel() {
        if (closeTimer) clearTimeout(closeTimer);
        cancelled = true;
      },
    }), { status: 200, headers: { "content-type": "text/plain" } });
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/stream", options);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "response_too_large");
    assert.equal(cancelled, true);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLimit === undefined) delete process.env.OMV_HTTP_MAX_BODY_BYTES;
    else process.env.OMV_HTTP_MAX_BODY_BYTES = originalLimit;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker preserves the size failure when stream cancellation rejects", async () => {
  const originalFetch = globalThis.fetch;
  const originalLimit = process.env.OMV_HTTP_MAX_BODY_BYTES;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let closeTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    process.env.OMV_HTTP_MAX_BODY_BYTES = "4";
    globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("abc"));
        controller.enqueue(new TextEncoder().encode("abc"));
        closeTimer = setTimeout(() => controller.close(), 50);
      },
      cancel() {
        if (closeTimer) clearTimeout(closeTimer);
        return Promise.reject(new Error("cancel failed"));
      },
    }), { status: 200, headers: { "content-type": "text/plain" } });
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/stream", options);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "response_too_large");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalLimit === undefined) delete process.env.OMV_HTTP_MAX_BODY_BYTES;
    else process.env.OMV_HTTP_MAX_BODY_BYTES = originalLimit;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("bounded responses retain metadata and use the package version in the default User-Agent", async () => {
  const originalFetch = globalThis.fetch;
  const originalUserAgent = process.env.OMV_USER_AGENT;
  const originalLimit = process.env.OMV_HTTP_MAX_BODY_BYTES;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let sentUserAgent = "";
  try {
    delete process.env.OMV_USER_AGENT;
    process.env.OMV_HTTP_MAX_BODY_BYTES = "64";
    globalThis.fetch = async (_input, init) => {
      sentUserAgent = new Headers(init?.headers).get("user-agent") ?? "";
      return new Response("hello", {
        status: 200,
        headers: { "content-type": "text/plain", "set-cookie": "secret=value" },
      });
    };
    const options = { projectRoot, refresh: true, retries: 0, resolver: publicResolver };
    const result = await requestFetch("https://metadata.example.test/small", options);
    const pkg = JSON.parse(await readFile(join(process.cwd(), "package.json"), "utf-8")) as { version: string };

    assert.equal(result.ok, true);
    assert.equal(result.bodyBytes, 5);
    assert.equal(result.bodySha256, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
    assert.equal(result.bodyPreview, "hello");
    assert.equal(result.headers["set-cookie"], undefined);
    assert.match(sentUserAgent, new RegExp(`/${pkg.version.replaceAll(".", "\\.")}(?:\\s|$)`));
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUserAgent === undefined) delete process.env.OMV_USER_AGENT;
    else process.env.OMV_USER_AGENT = originalUserAgent;
    if (originalLimit === undefined) delete process.env.OMV_HTTP_MAX_BODY_BYTES;
    else process.env.OMV_HTTP_MAX_BODY_BYTES = originalLimit;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker treats invalid retry counts as zero retries", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("retryable", { status: 503, headers: { "content-type": "text/plain" } });
    };
    for (const retries of [Number.NaN, Number.POSITIVE_INFINITY, -1, 1.5]) {
      const options = { projectRoot, refresh: true, retries, resolver: publicResolver };
      const result = await requestFetch(`https://metadata.example.test/retries-${calls}`, options);
      assert.equal(result.status, 503);
      assert.equal(result.failure?.reason, "upstream_error");
    }
    assert.equal(calls, 4);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker times out a stalled initial DNS resolver", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  const resolver: TestResolver = async () => new Promise(() => undefined);
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response("unexpected");
    };
    const options = { projectRoot, refresh: true, retries: 0, timeoutMs: 10, resolver };
    const result = await Promise.race([
      requestFetch("https://metadata.example.test/stalled", options),
      rejectAfter(150, "initial resolver did not honor timeout"),
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "network_timeout");
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker times out a stalled redirect DNS resolver", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  const resolver: TestResolver = async (hostname) => hostname === "metadata.example.test"
    ? [{ address: "93.184.216.34", family: 4 }]
    : new Promise(() => undefined);
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(null, {
        status: 302,
        headers: { location: "https://stalled.example.test/final" },
      });
    };
    const options = { projectRoot, refresh: true, retries: 0, timeoutMs: 10, resolver };
    const result = await Promise.race([
      requestFetch("https://metadata.example.test/start", options),
      rejectAfter(150, "redirect resolver did not honor timeout"),
    ]);

    assert.equal(result.ok, false);
    assert.equal(result.failure?.reason, "network_timeout");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker retries an initial DNS timeout before fetching", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let resolverCalls = 0;
  let fetchCalls = 0;
  const resolver: TestResolver = async () => {
    resolverCalls += 1;
    if (resolverCalls === 1) {
      return new Promise((resolve) => {
        const timer = setTimeout(() => resolve([{ address: "93.184.216.34", family: 4 }]), 50);
        timer.unref();
      });
    }
    return [{ address: "93.184.216.34", family: 4 }];
  };
  try {
    globalThis.fetch = async () => {
      fetchCalls += 1;
      return new Response("recovered", { status: 200, headers: { "content-type": "text/plain" } });
    };
    const options = { projectRoot, refresh: true, retries: 1, timeoutMs: 10, resolver };
    const result = await requestFetch("https://metadata.example.test/recovered", options);

    assert.equal(result.ok, true);
    assert.equal(result.bodyPreview, "recovered");
    assert.equal(resolverCalls, 2);
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("request broker classifies GitHub API rate limits", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  try {
    globalThis.fetch = async () => new Response(
      JSON.stringify({ message: "API rate limit exceeded for test" }),
      {
        status: 403,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-limit": "60",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "1778262720",
        },
      },
    );

    const options = {
      projectRoot,
      refresh: true,
      retries: 0,
      resolver: publicResolver,
    };
    const result = await requestFetch("https://api.github.com/repos/example/demo", options);

    assert.equal(result.ok, false);
    assert.equal(result.status, 403);
    assert.equal(result.failure?.reason, "rate_limited");
    assert.match(result.failure?.message ?? "", /rate limit/i);
    assert.equal(result.rateLimit?.remaining, 0);
    assert.match(result.recommendation ?? "", /GITHUB_TOKEN/);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});

function rejectAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    timer.unref();
  });
}

test("request broker reuses fresh cached responses", async () => {
  const originalFetch = globalThis.fetch;
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-request-"));
  let calls = 0;
  try {
    globalThis.fetch = async () => {
      calls += 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "set-cookie": "session=secret",
        },
      });
    };

    const options = {
      projectRoot,
      accept: "application/json",
      retries: 0,
      resolver: publicResolver,
    };
    const first = await requestFetch("https://registry.npmjs.org/-/ping", options);
    const second = await requestFetch("https://registry.npmjs.org/-/ping", options);

    assert.equal(first.ok, true);
    assert.equal(first.cached, false);
    assert.equal(second.ok, true);
    assert.equal(second.cached, true);
    assert.equal(calls, 1);
    assert.equal(second.headers["set-cookie"], undefined);
    assert.ok(second.expiresAt);
  } finally {
    globalThis.fetch = originalFetch;
    await rm(projectRoot, { recursive: true, force: true });
  }
});
