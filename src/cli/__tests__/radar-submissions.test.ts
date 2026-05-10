import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { radarEventsPath, radarWatchlistPath, submissionPath } from "../paths.js";
import { radarBrief, refreshRadar } from "../radar.js";
import { closeSubmission, recordSubmission, trackSubmissions } from "../submissions.js";

test("radar refresh requires a watchlist", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-radar-"));
  try {
    await assert.rejects(() => refreshRadar({ projectRoot }), /watchlist\.yaml/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("radar dry run uses fixtures and does not append events", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-radar-"));
  try {
    await mkdir(join(projectRoot, ".omv", "radar"), { recursive: true });
    await writeFile(
      radarWatchlistPath(projectRoot),
      "watch:\n  - ecosystem: npm\n    package: demo-package\n    vulnerability: ssrf\n",
      "utf-8",
    );
    const result = await refreshRadar({ projectRoot, dryRun: true });
    assert.equal(result.dryRun, true);
    assert.equal(result.events.length, 4);
    assert.equal(existsSync(radarEventsPath(projectRoot)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("radar refresh appends watchlist events and brief groups them", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-radar-"));
  try {
    await mkdir(join(projectRoot, ".omv", "radar"), { recursive: true });
    await writeFile(
      radarWatchlistPath(projectRoot),
      "watch:\n  - ecosystem: npm\n    package: demo-package\n  - ecosystem: go\n    keyword: ssrf\n",
      "utf-8",
    );
    const result = await refreshRadar({ projectRoot });
    assert.equal(result.events.length, 2);
    assert.equal(existsSync(radarEventsPath(projectRoot)), true);
    assert.match(await readFile(radarEventsPath(projectRoot), "utf-8"), /Watchlist snapshot/);

    const brief = await radarBrief(projectRoot);
    assert.equal(brief.eventCount, 2);
    assert.deepEqual(brief.groups.map((group) => `${group.ecosystem}:${group.package}`), ["go:ssrf", "npm:demo-package"]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("submissions record, track, and close CVE metadata", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-submissions-"));
  try {
    const recorded = await recordSubmission(
      "demo",
      { platform: "vuldb", submissionId: "12345", url: "https://example.test/submission/12345" },
      projectRoot,
    );
    assert.equal(recorded.records.length, 1);
    assert.equal(recorded.records[0].status, "open");
    assert.equal(existsSync(submissionPath("demo", projectRoot)), true);

    const tracked = await trackSubmissions("demo", projectRoot);
    assert.equal(tracked.records[0].platform, "vuldb");

    const closed = await closeSubmission("demo", "CVE-2026-12345", projectRoot);
    assert.equal(closed.records[0].status, "closed");
    assert.equal(closed.records[0].cve, "CVE-2026-12345");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
