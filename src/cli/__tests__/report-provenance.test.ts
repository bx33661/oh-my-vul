import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { checkReportArtifacts, createFindingTemplate } from "../findings.js";
import { sha256File } from "../install-manifest.js";
import {
  findingReportsDir,
  findingReproDir,
  reportProvenancePath,
  threatMapPath,
  verificationPath,
} from "../paths.js";
import { initSourceRef } from "../source-ref.js";
import {
  createReportProvenance,
  validateReportProvenance,
} from "../report-provenance.js";

async function createFinding(projectRoot: string, id: string, status = "candidate"): Promise<string> {
  const result = await createFindingTemplate(id, { projectRoot });
  const doc = parseDocument(await readFile(result.path, "utf-8"));
  doc.set("status", status);
  doc.setIn(["package", "ecosystem"], "npm");
  doc.setIn(["package", "registry_name"], "demo-package");
  doc.setIn(["package", "repository_url"], "https://github.com/example/demo-package");
  await writeFile(result.path, String(doc), "utf-8");
  return result.path;
}

test("report provenance hashes Evidence, reports, and available optional dependencies", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-report-provenance-"));
  try {
    const findingPath = await createFinding(projectRoot, "demo");
    const reportDir = findingReportsDir("demo", projectRoot);
    const reproDir = findingReproDir("demo", projectRoot);
    await mkdir(reportDir, { recursive: true });
    await mkdir(reproDir, { recursive: true });
    const reportPath = join(reportDir, "advisory.md");
    const reproPath = join(reproDir, "observed.txt");
    await writeFile(reportPath, "# Advisory\n", "utf-8");
    await writeFile(reproPath, "observed locally\n", "utf-8");
    await writeFile(threatMapPath("demo", projectRoot), "threat map bytes\n", "utf-8");
    await mkdir(join(projectRoot, ".omv", "verifications"), { recursive: true });
    await writeFile(verificationPath("demo", projectRoot), "verification bytes\n", "utf-8");
    await initSourceRef("demo", projectRoot);

    const doc = parseDocument(await readFile(findingPath, "utf-8"));
    doc.setIn(["evidence", "repro_artifacts"], [".omv/repro/demo/observed.txt"]);
    await writeFile(findingPath, String(doc), "utf-8");
    await initSourceRef("demo", projectRoot, { force: true });

    const result = await createReportProvenance("demo", projectRoot, {
      now: () => new Date("2026-07-10T02:03:04.000Z"),
    });
    assert.equal(result.path, reportProvenancePath("demo", projectRoot));
    assert.equal(result.manifest.generated_at, "2026-07-10T02:03:04.000Z");
    assert.deepEqual(
      result.manifest.inputs.map((input) => input.role),
      ["evidence", "report", "source-ref", "threat-map", "verification", "reproduction"],
    );
    for (const input of result.manifest.inputs) {
      assert.match(input.sha256, /^[a-f0-9]{64}$/);
      assert.equal(input.path.startsWith(projectRoot), false);
    }
    assert.equal(
      result.manifest.inputs.find((input) => input.role === "evidence")?.sha256,
      await sha256File(findingPath),
    );
    assert.equal(
      result.manifest.inputs.find((input) => input.role === "report")?.sha256,
      await sha256File(reportPath),
    );

    const validation = await validateReportProvenance("demo", projectRoot);
    assert.equal(validation.ok, true);
    assert.equal(validation.fresh, true);
    assert.deepEqual(validation.staleInputs, []);
    assert.deepEqual(validation.missingInputs, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("report provenance protects an existing manifest and rejects manifest-only report directories", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-report-provenance-"));
  try {
    await createFinding(projectRoot, "demo");
    const reportDir = findingReportsDir("demo", projectRoot);
    await mkdir(reportDir, { recursive: true });
    const manifestPath = reportProvenancePath("demo", projectRoot);
    await writeFile(manifestPath, "{}\n", "utf-8");

    await assert.rejects(
      () => createReportProvenance("demo", projectRoot),
      /no non-empty report artifacts/i,
    );

    await writeFile(join(reportDir, "report.md"), "report\n", "utf-8");
    const original = Buffer.from("preserve manifest bytes\r\n");
    await writeFile(manifestPath, original);
    await assert.rejects(
      () => createReportProvenance("demo", projectRoot),
      /already exists.*--force/i,
    );
    assert.deepEqual(await readFile(manifestPath), original);

    const replaced = await createReportProvenance("demo", projectRoot, { force: true });
    assert.equal(replaced.overwritten, true);
    assert.equal(JSON.parse(await readFile(manifestPath, "utf-8")).finding_id, "demo");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("report artifact checks keep legacy manifests optional and exclude provenance from report counts", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-report-provenance-"));
  try {
    await createFinding(projectRoot, "legacy");
    const reportDir = findingReportsDir("legacy", projectRoot);
    await mkdir(reportDir, { recursive: true });
    await writeFile(join(reportDir, "report.md"), "report\n", "utf-8");

    const legacy = await checkReportArtifacts("legacy", projectRoot);
    assert.equal(legacy.errors.length, 0);
    assert.match(legacy.warnings.join("\n"), /provenance.*missing/i);
    assert.equal(legacy.provenanceManifestExists, false);

    await createReportProvenance("legacy", projectRoot);
    const checked = await checkReportArtifacts("legacy", projectRoot);
    assert.equal(checked.reportArtifactPaths.length, 1);
    assert.equal(checked.reportArtifactPaths[0].endsWith("report.md"), true);
    assert.equal(checked.provenanceManifestExists, true);
    assert.equal(checked.provenanceFresh, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("stale report manifests warn for candidates and error for confirmed findings", async () => {
  for (const status of ["candidate", "confirmed"]) {
    const projectRoot = await mkdtemp(join(tmpdir(), "omv-report-provenance-"));
    try {
      const findingPath = await createFinding(projectRoot, "demo", status);
      const reportDir = findingReportsDir("demo", projectRoot);
      await mkdir(reportDir, { recursive: true });
      await writeFile(join(reportDir, "report.md"), "report\n", "utf-8");
      await createReportProvenance("demo", projectRoot);
      await writeFile(findingPath, `${await readFile(findingPath, "utf-8")}# changed\n`, "utf-8");

      const validation = await validateReportProvenance("demo", projectRoot);
      assert.equal(validation.ok, true);
      assert.equal(validation.fresh, false);
      assert.deepEqual(validation.staleInputs, [".omv/findings/demo.yaml"]);

      const artifacts = await checkReportArtifacts("demo", projectRoot);
      assert.equal(artifacts.provenanceFresh, false);
      if (status === "confirmed") {
        assert.match(artifacts.errors.join("\n"), /provenance.*stale/i);
      } else {
        assert.equal(artifacts.errors.length, 0);
        assert.match(artifacts.warnings.join("\n"), /provenance.*stale/i);
      }
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  }
});
