import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { requestFetch } from "../request.js";

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

    const result = await requestFetch("https://api.github.com/repos/example/demo", {
      projectRoot,
      refresh: true,
      retries: 0,
    });

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

    const first = await requestFetch("https://registry.npmjs.org/-/ping", {
      projectRoot,
      accept: "application/json",
      retries: 0,
    });
    const second = await requestFetch("https://registry.npmjs.org/-/ping", {
      projectRoot,
      accept: "application/json",
      retries: 0,
    });

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
