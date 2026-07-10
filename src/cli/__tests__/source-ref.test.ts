import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { createFindingTemplate } from "../findings.js";
import { sha256File } from "../install-manifest.js";
import { sourceRefPath } from "../paths.js";
import {
  initSourceRef,
  parseSourceRefYaml,
  showSourceRef,
  validateSourceRef,
} from "../source-ref.js";

async function createFinding(projectRoot: string, id: string, withSources = true): Promise<string> {
  const result = await createFindingTemplate(id, { projectRoot });
  const doc = parseDocument(await readFile(result.path, "utf-8"));
  doc.setIn(["package", "ecosystem"], "npm");
  doc.setIn(["package", "registry_name"], withSources ? "demo-package" : "");
  doc.setIn(
    ["package", "repository_url"],
    withSources ? "https://github.com/example/demo-package" : "",
  );
  await writeFile(result.path, String(doc), "utf-8");
  return result.path;
}

test("SourceRef init records only known Evidence source facts and the current finding hash", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-source-ref-"));
  try {
    const findingPath = await createFinding(projectRoot, "demo");
    const result = await initSourceRef("demo", projectRoot, {
      now: () => new Date("2026-07-10T01:02:03.000Z"),
    });

    assert.equal(result.path, sourceRefPath("demo", projectRoot));
    assert.equal(result.overwritten, false);
    assert.equal(result.sourceRef.finding_id, "demo");
    assert.equal(result.sourceRef.finding_sha256, await sha256File(findingPath));
    assert.equal(result.sourceRef.captured_at, "2026-07-10T01:02:03.000Z");
    assert.deepEqual(result.sourceRef.sources, [
      {
        kind: "repository",
        locator: "https://github.com/example/demo-package",
        revision: "unknown",
        path: "unknown",
        sha256: "unknown",
      },
      {
        kind: "registry",
        locator: "npm:demo-package",
        revision: "unknown",
        path: "unknown",
        sha256: "unknown",
      },
    ]);
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(
      parseSourceRefYaml(await readFile(result.path, "utf-8"), result.path),
      result.sourceRef,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("SourceRef init preserves unknown source identity without inventing a locator", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-source-ref-"));
  try {
    await createFinding(projectRoot, "unknown-source", false);
    const result = await initSourceRef("unknown-source", projectRoot);

    assert.deepEqual(result.sourceRef.sources, []);
    assert.match(result.warnings.join("\n"), /no known source/i);
    assert.doesNotMatch(await readFile(result.path, "utf-8"), /github\.com|npm:/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("SourceRef validation is closed-schema and enforces filename identity, timestamps, and hashes", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-source-ref-"));
  try {
    await createFinding(projectRoot, "demo");
    const valid = await initSourceRef("demo", projectRoot);
    const base = await readFile(valid.path, "utf-8");

    assert.throws(
      () => parseSourceRefYaml(`${base}invented: true\n`, valid.path),
      /unknown field.*invented/i,
    );
    assert.throws(
      () => parseSourceRefYaml(base.replace("finding_id: demo", "finding_id: other"), valid.path),
      /id must match filename/i,
    );
    assert.throws(
      () => parseSourceRefYaml(base.replace(/captured_at: .+/, "captured_at: 2026-02-30T00:00:00Z"), valid.path),
      /captured_at/i,
    );
    assert.throws(
      () => parseSourceRefYaml(base.replace(/[a-f0-9]{64}/, "not-a-hash"), valid.path),
      /finding_sha256/i,
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("SourceRef init protects existing bytes and force replaces the sidecar", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-source-ref-"));
  try {
    await createFinding(projectRoot, "demo");
    const first = await initSourceRef("demo", projectRoot);
    const original = Buffer.from("preserve source bytes\r\n");
    await writeFile(first.path, original);

    await assert.rejects(() => initSourceRef("demo", projectRoot), /already exists.*--force/i);
    assert.deepEqual(await readFile(first.path), original);

    const replaced = await initSourceRef("demo", projectRoot, { force: true });
    assert.equal(replaced.overwritten, true);
    assert.equal(parseSourceRefYaml(await readFile(first.path, "utf-8"), first.path).finding_id, "demo");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("SourceRef validation reports staleness after Evidence bytes change", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-source-ref-"));
  try {
    const findingPath = await createFinding(projectRoot, "demo");
    await initSourceRef("demo", projectRoot);

    const fresh = await validateSourceRef("demo", projectRoot);
    assert.equal(fresh.ok, true);
    assert.equal(fresh.stale, false);
    assert.deepEqual((await showSourceRef("demo", projectRoot)).sourceRef, fresh.sourceRef);

    await writeFile(findingPath, `${await readFile(findingPath, "utf-8")}# changed\n`, "utf-8");
    const stale = await validateSourceRef("demo", projectRoot);
    assert.equal(stale.ok, true);
    assert.equal(stale.stale, true);
    assert.match(stale.warnings.join("\n"), /Evidence.*changed|stale/i);

    await assert.rejects(() => validateSourceRef("missing", projectRoot), /does not exist/i);
    await assert.rejects(() => validateSourceRef("../unsafe", projectRoot), /source id must start/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
