import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createFindingTemplate,
  ensureFindingsDir,
  listFindings,
  promoteFinding,
  validateFinding,
  validateFindings,
} from "../findings.js";

const BASE_FINDING = `schema_version: "1"
handoff_version: "1.0"
status: candidate
researcher_goal: VulDB
package:
  ecosystem: npm
  registry_name: demo-package
  repository_url: https://github.com/example/demo-package
  vendor: example
  product: demo-package
versions:
  tested: "1.2.3"
  affected_range: unknown
  fixed: unknown
vulnerability:
  class: path traversal
  cwe: CWE-22
  affected_component: lib/index.js
  affected_function: loadFile
evidence:
  source: options.filename
  sink: fs.readFileSync
  guard: missing path normalization
  reproducer: node repro.js
  observed_result: reads outside base directory
cvss:
  vector: unknown
  score: unknown
  severity: unknown
impact:
  attack_vector: Local
  authentication_required: unknown
  user_interaction_required: unknown
  scope_changed: unknown
  confidentiality: High
  integrity: unknown
  availability: unknown
dedup:
  nvd_searched: false
  ghsa_searched: false
  ecosystem_db_searched: false
  existing_cve: unknown
  notes: ""
disclosure:
  vendor_contacted: false
  contact_date: unknown
  vendor_response: unknown
  planned_disclosure_date: unknown
blockers: []
provenance:
  verification_date: "2026-04-29"
  researcher: tester
  unverified_fields: []
  tool_versions: {}
`;

test("findings ledger lists and validates Evidence.v1 files", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");

    const findings = await listFindings(projectRoot);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].id, "demo");
    assert.equal(findings[0].status, "candidate");
    assert.equal(findings[0].ecosystem, "npm");
    assert.equal(findings[0].package, "demo-package");
    assert.equal(findings[0].readiness, 75);

    const validation = await validateFinding("demo", projectRoot);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.errors, []);
    assert.match(validation.warnings.join("\n"), /dedup search is incomplete/);

    const all = await validateFindings(projectRoot);
    assert.equal(all.length, 1);
    assert.equal(all[0].id, "demo");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("createFindingTemplate writes canonical Evidence.v1 templates and protects existing files", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const result = await createFindingTemplate("demo.yaml", { projectRoot, status: "candidate" });
    assert.equal(result.id, "demo");
    assert.equal(result.status, "candidate");
    assert.match(await readFile(result.path, "utf-8"), /schema_version: "1"/);
    assert.match(await readFile(result.path, "utf-8"), /status: candidate/);

    await assert.rejects(() => createFindingTemplate("demo", { projectRoot }), /already exists/);
    await assert.rejects(() => createFindingTemplate("../demo", { projectRoot }), /finding id must start/);

    const overwritten = await createFindingTemplate("demo", { projectRoot, status: "blocked", force: true });
    assert.equal(overwritten.path, result.path);
    assert.match(await readFile(result.path, "utf-8"), /status: blocked/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("blocked findings require blockers and multiline blockers are accepted", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "blocked.yaml"), BASE_FINDING.replace("status: candidate", "status: blocked"), "utf-8");

    let validation = await validateFinding("blocked", projectRoot);
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /blocked findings must include at least one blocker/);

    await writeFile(
      join(dir, "blocked.yaml"),
      BASE_FINDING.replace("status: candidate", "status: blocked").replace(
        "blockers: []",
        "blockers:\n  - no local reproducer",
      ),
      "utf-8",
    );
    validation = await validateFinding("blocked", projectRoot);
    assert.equal(validation.ok, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("promoteFinding updates status and confirmed findings reject missing reproducibility", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");

    const promoted = await promoteFinding("demo", "confirmed", projectRoot);
    assert.equal(promoted.ok, true);
    assert.equal(promoted.status, "confirmed");
    assert.match(await readFile(join(dir, "demo.yaml"), "utf-8"), /status: confirmed/);

    await writeFile(
      join(dir, "missing-repro.yaml"),
      BASE_FINDING.replace("status: candidate", "status: confirmed").replace("reproducer: node repro.js", "reproducer: none"),
      "utf-8",
    );
    const validation = await validateFinding("missing-repro", projectRoot);
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /evidence\.reproducer is required/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
