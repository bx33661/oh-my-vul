import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  archiveFinding,
  checkReportArtifacts,
  createFindingTemplate,
  doctorFinding,
  ensureFindingsDir,
  initReproArtifacts,
  listArchivedFindings,
  listFindings,
  listFindingWorkflow,
  promoteFinding,
  restoreFinding,
  showFinding,
  validateFinding,
  validateFindings,
  writeThreatMap,
} from "../findings.js";
import { archiveMetadataPath, archivedFindingsDir, findingReportsDir, findingReproDir, findingsDir, threatMapPath, verificationPath, workspaceIndexPath } from "../paths.js";
import { recordSubmission } from "../submissions.js";
import { validateThreatMap } from "../threatmap.js";
import { initVerification, validateVerification } from "../verification.js";
import { reviewFinding } from "../review.js";
import {
  isReportReady,
  isSubmissionScoreReady,
  resolveDoctorNextAction,
  SUBMISSION_READY_THRESHOLD,
} from "../workflow.js";
import { readWorkspaceActivity } from "../workspace.js";

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
  source: lib/index.js:12 options.filename
  sink: lib/index.js:44 fs.readFileSync
  guard: missing path normalization
  reproducer: node repro.js
  observed_result: reads outside base directory
cvss:
  vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N
  score: 5.5
  severity: Medium
impact:
  attack_vector: Local
  authentication_required: unknown
  user_interaction_required: unknown
  scope_changed: unknown
  confidentiality: High
  integrity: unknown
  availability: unknown
dedup:
  nvd_searched: true
  ghsa_searched: true
  ecosystem_db_searched: true
  existing_cve: none
  notes: "searched #security advisory"
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
    assert.equal(findings[0].readiness, 95);
    assert.equal(findings[0].evidenceScore, 95);
    assert.equal(findings[0].submissionScore, 85);

    const validation = await validateFinding("demo", projectRoot);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.errors, []);
    assert.equal(validation.evidenceScore, 95);
    assert.equal(validation.submissionScore, 85);

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

test("structured YAML parsing preserves quoted hashes, multiline strings, and inline lists", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "yaml.yaml"),
      BASE_FINDING.replace(
        "observed_result: reads outside base directory",
        "observed_result: |\n    reads outside base directory\n    includes marker #not-a-comment",
      ).replace(
        "unverified_fields: []",
        "unverified_fields: [versions.fixed, disclosure.contact_date]",
      ),
      "utf-8",
    );

    const validation = await validateFinding("yaml", projectRoot);
    assert.equal(validation.ok, true);
    assert.equal(validation.readiness, 95);
    assert.doesNotMatch(validation.errors.join("\n"), /parse/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("validateFinding rejects invalid contract fields and untracked confirmed unknowns", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "invalid.yaml"),
      BASE_FINDING.replace("status: candidate", "status: confirmed")
        .replace("ecosystem: npm", "ecosystem: unknown-ecosystem")
        .replace("cwe: CWE-22", "cwe: 22")
        .replace("vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N", "vector: invalid")
        .replace("observed_result: reads outside base directory", "observed_result: unknown"),
      "utf-8",
    );

    const validation = await validateFinding("invalid", projectRoot);
    assert.equal(validation.ok, false);
    assert.match(validation.errors.join("\n"), /package\.ecosystem/);
    assert.match(validation.errors.join("\n"), /vulnerability\.cwe/);
    assert.match(validation.errors.join("\n"), /cvss\.vector/);
    assert.match(validation.errors.join("\n"), /evidence\.observed_result/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("promoteFinding rejects invalid confirmed promotion without rewriting status", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "candidate.yaml"),
      BASE_FINDING.replace("vector: CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N", "vector: unknown"),
      "utf-8",
    );

    const result = await promoteFinding("candidate", "confirmed", projectRoot);
    assert.equal(result.ok, false);
    assert.equal(result.status, "candidate");
    assert.match(await readFile(join(dir, "candidate.yaml"), "utf-8"), /status: candidate/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("finding workflow recommends audit, repro, report, and archive next actions", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "needs-audit.yaml"),
      BASE_FINDING.replace("source: lib/index.js:12 options.filename", "source: unknown"),
      "utf-8",
    );
    await writeFile(
      join(dir, "needs-repro.yaml"),
      BASE_FINDING.replace("observed_result: reads outside base directory", "observed_result: unknown"),
      "utf-8",
    );
    await writeFile(join(dir, "ready-report.yaml"), BASE_FINDING.replace("status: candidate", "status: confirmed"), "utf-8");
    await writeFile(
      join(dir, "blocked.yaml"),
      BASE_FINDING.replace("status: candidate", "status: blocked").replace("blockers: []", "blockers:\n  - duplicate CVE"),
      "utf-8",
    );

    const workflow = await listFindingWorkflow(projectRoot);
    assert.deepEqual(
      workflow.map((finding) => finding.id),
      ["ready-report", "needs-repro", "needs-audit", "blocked"],
    );
    assert.equal(workflow.find((finding) => finding.id === "needs-audit")?.nextAction, "/omv-audit needs-audit");
    assert.deepEqual(workflow.find((finding) => finding.id === "needs-audit")?.action, {
      surface: "claude",
      command: "/omv-audit needs-audit",
      reason: "audit evidence still missing",
    });
    assert.equal(workflow.find((finding) => finding.id === "needs-repro")?.nextAction, "/omv-repro needs-repro");
    assert.equal(workflow.find((finding) => finding.id === "ready-report")?.nextAction, "/omv-report ready-report");
    assert.equal(workflow.find((finding) => finding.id === "ready-report")?.priorityReason, "confirmed finding ready for report");
    assert.equal(
      workflow.find((finding) => finding.id === "blocked")?.nextAction,
      "omv findings archive blocked --reason blocked",
    );
    assert.equal(workflow.find((finding) => finding.id === "blocked")?.action.surface, "cli");
    for (const finding of workflow) {
      assert.equal(finding.nextAction, finding.action.command);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("confirmed findings below the submission threshold stay out of the report queue", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    const lowConfidence = `${BASE_FINDING.replace("status: candidate", "status: confirmed")}
verdict:
  exploitability: plausible
  confidence: low
  reason: incomplete confidence
`;
    await writeFile(join(dir, "low-confidence.yaml"), lowConfidence, "utf-8");

    const validation = await validateFinding("low-confidence", projectRoot);
    assert.equal(validation.ok, true);
    assert.ok(validation.submissionScore < 75);

    const [finding] = await listFindingWorkflow(projectRoot);
    assert.notEqual(finding.nextAction, "/omv-report low-confidence");
    assert.match(finding.nextAction, /^\/omv-(?:audit|repro) /);
    assert.ok(finding.priority < 100);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workflow separates evidence completeness from submission readiness", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "blocked-candidate.yaml"),
      BASE_FINDING
        .replace("observed_result: reads outside base directory", "observed_result: unknown")
        .replace("blockers: []", "blockers:\n  - local PoC not executed")
        .replace("unverified_fields: []", "unverified_fields: [evidence.observed_result]"),
      "utf-8",
    );

    const validation = await validateFinding("blocked-candidate", projectRoot);
    assert.equal(validation.ok, true);
    assert.equal(validation.evidenceScore, 85);
    assert.equal(validation.submissionScore, 17);
    assert.match(validation.warnings.join("\n"), /blockers remain unresolved/);

    const workflow = await listFindingWorkflow(projectRoot);
    assert.equal(workflow[0].nextAction, "/omv-audit blocked-candidate");
    assert.equal(workflow[0].priorityReason, "audit evidence still missing");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("showFinding renders optional ThreatMap.v1 sidecars", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");
    await mkdir(join(projectRoot, ".omv", "threatmaps"), { recursive: true });
    await writeFile(
      threatMapPath("demo", projectRoot),
      `schema_version: "1"
finding_id: demo
paths:
  - id: 1
    source:
      type: user_input
      location: src/server.js:10
      description: HTTP body
    sink:
      type: network_req
      location: src/fetch.js:22
      description: http.Get()
    guard:
      present: false
      description: no-allowlist
summary:
  path_count: 1
`,
      "utf-8",
    );

    const detail = await showFinding("demo", projectRoot);
    assert.equal(detail.threatMap?.path, threatMapPath("demo", projectRoot));
    assert.deepEqual(detail.threatMap?.rendered, [
      "path 1",
      "  source: HTTP body — src/server.js:10",
      "  sink: http.Get() — src/fetch.js:22",
      "  guard missing: no-allowlist",
      "summary: 1 paths",
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("showFinding renders transforms, confidence, and bypassable guards", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");
    await mkdir(join(projectRoot, ".omv", "threatmaps"), { recursive: true });
    await writeFile(
      threatMapPath("demo", projectRoot),
      `schema_version: "1"
finding_id: demo
paths:
  - id: 1
    source:
      type: file
      location: lib/extract.js:42
      description: zip entry name
    transforms:
      - type: normalize
        location: lib/extract.js:60
        description: entry joined without canonicalization
      - type: parse
        location: lib/extract.js:64
    sink:
      type: fs_write
      location: lib/extract.js:88
      description: createWriteStream outside base dir
    guard:
      present: true
      description: path prefix check
      bypassable: true
    confidence: high
summary:
  path_count: 1
  confirmed_paths: 1
  highest_confidence: high
`,
      "utf-8",
    );

    const detail = await showFinding("demo", projectRoot);
    assert.deepEqual(detail.threatMap?.rendered, [
      "path 1 (high confidence)",
      "  source: zip entry name — lib/extract.js:42",
      "  transform: entry joined without canonicalization — lib/extract.js:60",
      "  transform: parse — lib/extract.js:64",
      "  sink: createWriteStream outside base dir — lib/extract.js:88",
      "  guard: path prefix check (bypassable)",
      "summary: 1 paths, 1 confirmed, highest: high",
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("writeThreatMap scaffolds an idempotent ThreatMap.v1 sidecar", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");

    const path = threatMapPath("demo", projectRoot);

    const first = await writeThreatMap("demo", projectRoot);
    assert.equal(first.written, true);
    assert.equal(first.skipped, false);
    assert.equal(first.path, path);
    assert.ok(existsSync(path));

    const body = await readFile(path, "utf-8");
    assert.match(body, /schema_version: "1"/);
    assert.match(body, /finding_id: "demo"/);
    assert.match(body, /paths: \[\]/);

    // showFinding picks up the scaffolded sidecar
    const detail = await showFinding("demo", projectRoot);
    assert.equal(detail.threatMap?.path, path);

    // non-empty sidecar is skipped without --force
    const second = await writeThreatMap("demo", projectRoot);
    assert.equal(second.written, false);
    assert.equal(second.skipped, true);

    // --force overwrites
    const third = await writeThreatMap("demo", projectRoot, { force: true });
    assert.equal(third.written, true);
    assert.equal(third.skipped, false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("validateThreatMap checks graph shape and Evidence summary consistency", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");
    await mkdir(join(projectRoot, ".omv", "threatmaps"), { recursive: true });
    await writeFile(
      threatMapPath("demo", projectRoot),
      `schema_version: "1"
finding_id: demo
package:
  ecosystem: npm
  registry_name: demo-package
paths:
  - source:
      type: user_input
      location: lib/index.js:12
      description: options.filename
    sink:
      type: fs_read
      location: lib/index.js:44
      description: fs.readFileSync
    guard:
      present: false
      description: missing path normalization
      bypassable: true
    confidence: high
summary:
  path_count: 1
`,
      "utf-8",
    );

    let validation = await validateThreatMap("demo", projectRoot);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.warnings, []);

    await writeFile(
      threatMapPath("demo", projectRoot),
      `schema_version: "1"
finding_id: demo
paths:
  - source:
      type: user_input
      location: lib/other.js:1
    sink:
      type: fs_read
      location: lib/other.js:2
    guard:
      present: true
      description: prefix check
`,
      "utf-8",
    );

    validation = await validateThreatMap("demo", projectRoot);
    assert.equal(validation.ok, true);
    assert.match(validation.warnings.join("\n"), /lib\/index\.js:12/);
    assert.match(validation.warnings.join("\n"), /lib\/index\.js:44/);
    assert.match(validation.warnings.join("\n"), /guard summary says missing/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Verification.v1 sidecars validate hashes and strict doctor gates report readiness", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "confirmed.yaml"), BASE_FINDING.replace("status: candidate", "status: confirmed"), "utf-8");

    let doctor = await doctorFinding("confirmed", projectRoot, { strictVerification: true });
    assert.equal(doctor.reportReady, false);
    assert.equal(doctor.nextAction, "omv verification init confirmed");
    assert.match(doctor.issues.map((issue) => issue.message).join("\n"), /does not exist/);

    const init = await initVerification("confirmed", projectRoot);
    assert.equal(init.written, true);
    assert.equal(init.path, verificationPath("confirmed", projectRoot));
    await writeFile(
      verificationPath("confirmed", projectRoot),
      `schema_version: "1"
finding_id: "confirmed"
finding_sha256: "${init.findingSha256}"
reviews:
  - reviewer: verifier
    target: threatmap.paths[0]
    agrees: true
    disagreements: []
    required_changes: []
    confidence: high
    reviewed_at: "2026-04-29"
decision:
  status: pass
  reason: independent verifier found no refutation
  required_for_confirmed: true
provenance:
  generated_at: "2026-04-29"
  tool: omv
  tool_version: test
`,
      "utf-8",
    );

    let validation = await validateVerification("confirmed", projectRoot);
    assert.equal(validation.ok, true);
    assert.equal(validation.status, "pass");
    assert.equal(validation.stale, false);
    doctor = await doctorFinding("confirmed", projectRoot, { strictVerification: true });
    assert.equal(doctor.reportReady, true);
    assert.equal(doctor.nextAction, "/omv-report confirmed");

    await writeFile(join(dir, "confirmed.yaml"), `${BASE_FINDING.replace("status: candidate", "status: confirmed")}\n# changed\n`, "utf-8");
    validation = await validateVerification("confirmed", projectRoot);
    assert.equal(validation.ok, true);
    assert.equal(validation.stale, true);
    doctor = await doctorFinding("confirmed", projectRoot, { strictVerification: true });
    assert.equal(doctor.reportReady, false);
    assert.equal(doctor.nextAction, "omv verification validate confirmed");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("readiness helpers share one report-ready policy", () => {
  assert.equal(SUBMISSION_READY_THRESHOLD, 75);
  assert.equal(isSubmissionScoreReady("confirmed", true, 75), true);
  assert.equal(isSubmissionScoreReady("confirmed", true, 74), false);
  assert.equal(isSubmissionScoreReady("candidate", true, 90), false);

  assert.equal(
    isReportReady({ status: "confirmed", validationOk: true, submissionScore: 80 }),
    true,
  );
  assert.equal(
    isReportReady({
      status: "confirmed",
      validationOk: true,
      submissionScore: 80,
      threatMapOk: false,
    }),
    false,
  );
  assert.equal(
    isReportReady({
      status: "confirmed",
      validationOk: true,
      submissionScore: 80,
      verificationOk: false,
    }),
    false,
  );

  assert.equal(
    resolveDoctorNextAction("demo", true, "/omv-audit demo"),
    "/omv-report demo",
  );
  assert.equal(
    resolveDoctorNextAction("demo", false, "/omv-audit demo", {
      strictVerification: true,
      verificationReady: false,
      verificationExists: false,
    }),
    "omv verification init demo",
  );
  assert.equal(
    resolveDoctorNextAction("demo", false, "/omv-audit demo", {
      strictVerification: true,
      verificationReady: false,
      verificationExists: true,
    }),
    "omv verification validate demo",
  );
  assert.equal(
    resolveDoctorNextAction("demo", false, "/omv-repro demo"),
    "/omv-repro demo",
  );
});

test("reviewFinding classifies report readiness verdicts", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-review-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "ready.yaml"), BASE_FINDING.replace("status: candidate", "status: confirmed"), "utf-8");
    await writeFile(
      join(dir, "needs-repro.yaml"),
      BASE_FINDING
        .replace("status: candidate", "status: confirmed")
        .replace("observed_result: reads outside base directory", "observed_result: unknown"),
      "utf-8",
    );
    await writeFile(
      join(dir, "needs-audit.yaml"),
      BASE_FINDING.replace("source: lib/index.js:12 options.filename", "source: unknown"),
      "utf-8",
    );
    await writeFile(
      join(dir, "blocked.yaml"),
      BASE_FINDING.replace("status: candidate", "status: blocked").replace("blockers: []", "blockers:\n  - duplicate CVE"),
      "utf-8",
    );

    const missingVerification = await reviewFinding("ready", projectRoot, { strict: true });
    assert.equal(missingVerification.verdict, "needs-verification");
    assert.equal(missingVerification.nextAction, "omv verification init ready");

    const init = await initVerification("ready", projectRoot);
    await writeFile(
      verificationPath("ready", projectRoot),
      `schema_version: "1"
finding_id: "ready"
finding_sha256: "${init.findingSha256}"
reviews:
  - reviewer: verifier
    target: evidence
    agrees: true
    disagreements: []
    required_changes: []
    confidence: high
    reviewed_at: "2026-04-29"
decision:
  status: pass
  reason: independent verifier found no refutation
  required_for_confirmed: true
provenance:
  generated_at: "2026-04-29"
  tool: omv
  tool_version: test
`,
      "utf-8",
    );

    const ready = await reviewFinding("ready", projectRoot, { strict: true });
    assert.equal(ready.verdict, "ready");
    assert.equal(ready.reportReady, true);
    assert.equal(ready.nextAction, "/omv-report ready");
    assert.equal(ready.blockers.length, 0);
    assert.match(ready.warnings.join("\n"), /report artifacts/);

    const needsRepro = await reviewFinding("needs-repro", projectRoot);
    assert.equal(needsRepro.verdict, "needs-repro");
    assert.equal(needsRepro.nextAction, "/omv-repro needs-repro");

    const needsAudit = await reviewFinding("needs-audit", projectRoot);
    assert.equal(needsAudit.verdict, "needs-audit");

    const blocked = await reviewFinding("blocked", projectRoot);
    assert.equal(blocked.verdict, "blocked");
    assert.equal(blocked.nextAction, "omv findings archive blocked --reason blocked");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("submission score is confidence weighted", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "low-confidence.yaml"),
      `${BASE_FINDING}
verdict:
  exploitability: plausible
  confidence: low
  reason: source-to-sink evidence is incomplete
`,
      "utf-8",
    );
    const validation = await validateFinding("low-confidence", projectRoot);
    assert.equal(validation.ok, true);
    assert.equal(validation.submissionScore, 60);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("archive and restore move findings while preserving Evidence.v1 content", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");

    const archived = await archiveFinding("demo", "reported", projectRoot);
    assert.equal(archived.id, "demo");
    assert.equal(archived.archiveReason, "reported");
    assert.equal(archived.warnings.length, 0);
    assert.equal(existsSync(join(findingsDir(projectRoot), "demo.yaml")), false);
    assert.equal(existsSync(join(archivedFindingsDir(projectRoot), "demo.yaml")), true);
    assert.equal(existsSync(archiveMetadataPath("demo", projectRoot)), true);

    const archivedList = await listArchivedFindings(projectRoot);
    assert.equal(archivedList.length, 1);
    assert.equal(archivedList[0].archiveReason, "reported");
    assert.equal(archivedList[0].package, "demo-package");
    await rm(workspaceIndexPath(projectRoot), { force: true });
    const rebuiltArchiveList = await listArchivedFindings(projectRoot);
    assert.equal(rebuiltArchiveList[0].archiveReason, "reported");

    const archivedDetail = await showFinding("demo", projectRoot, { archived: true });
    assert.equal(archivedDetail.archived, true);
    assert.equal(archivedDetail.archiveReason, "reported");
    assert.equal(archivedDetail.nextAction, "omv findings restore demo");

    await writeFile(join(dir, "conflict.yaml"), BASE_FINDING, "utf-8");
    await archiveFinding("conflict", "reported", projectRoot);
    await writeFile(join(dir, "conflict.yaml"), BASE_FINDING, "utf-8");
    await assert.rejects(() => archiveFinding("conflict", "reported", projectRoot), /already exists/);

    const restored = await restoreFinding("demo", projectRoot);
    assert.equal(restored.id, "demo");
    assert.equal(existsSync(join(findingsDir(projectRoot), "demo.yaml")), true);
    assert.equal(existsSync(join(archivedFindingsDir(projectRoot), "demo.yaml")), false);
    assert.match(await readFile(join(findingsDir(projectRoot), "demo.yaml"), "utf-8"), /schema_version: "1"/);
    const activeDetail = await showFinding("demo", projectRoot);
    assert.equal(activeDetail.archived, false);
    assert.equal(activeDetail.nextAction, "omv findings promote demo --status confirmed");

    const activity = await readWorkspaceActivity(projectRoot);
    assert.deepEqual(
      activity.map((entry) => entry.action).filter((action) => action !== "workspace.init"),
      ["finding.archive", "finding.archive", "finding.restore"],
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("archive reported warns or blocks confirmed findings without report artifacts", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "confirmed.yaml"), BASE_FINDING.replace("status: candidate", "status: confirmed"), "utf-8");

    await assert.rejects(
      () => archiveFinding("confirmed", "reported", projectRoot, { strict: true }),
      /no report artifacts/,
    );
    assert.equal(existsSync(join(findingsDir(projectRoot), "confirmed.yaml")), true);

    const warned = await archiveFinding("confirmed", "reported", projectRoot);
    assert.match(warned.warnings.join("\n"), /no report artifacts/);

    const restored = await restoreFinding("confirmed", projectRoot);
    assert.equal(restored.id, "confirmed");
    await mkdir(findingReportsDir("confirmed", projectRoot), { recursive: true });
    const reportPath = join(findingReportsDir("confirmed", projectRoot), "vuldb.md");
    await writeFile(reportPath, "# report\n", "utf-8");

    await recordSubmission(
      "confirmed",
      { platform: "vuldb", submissionId: "12345", url: "https://example.test/submission/12345" },
      projectRoot,
    );
    const archived = await archiveFinding("confirmed", "reported", projectRoot, { strict: true });
    assert.deepEqual(archived.warnings, []);
    assert.deepEqual(archived.reportArtifactPaths, [reportPath]);
    assert.equal(archived.submissionRecords.length, 1);
    const metadata = JSON.parse(await readFile(archiveMetadataPath("confirmed", projectRoot), "utf-8")) as {
      reportArtifactPaths?: string[];
    };
    assert.deepEqual(metadata.reportArtifactPaths, [reportPath]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("initReproArtifacts creates standard files and records Evidence.v1 artifact paths", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), BASE_FINDING, "utf-8");

    const result = await initReproArtifacts("demo", projectRoot);
    assert.equal(result.id, "demo");
    assert.equal(result.updatedFinding, true);
    assert.equal(existsSync(join(findingReproDir("demo", projectRoot), "README.md")), true);
    assert.equal(existsSync(join(findingReproDir("demo", projectRoot), "commands.sh")), true);
    assert.equal(existsSync(join(findingReproDir("demo", projectRoot), "observed.txt")), true);
    assert.equal(existsSync(join(findingReproDir("demo", projectRoot), "docker-compose.yml")), true);
    assert.equal(existsSync(join(findingReproDir("demo", projectRoot), "screenshots")), true);

    const text = await readFile(join(dir, "demo.yaml"), "utf-8");
    assert.match(text, /\.omv\/repro\/demo\/commands\.sh/);
    assert.match(text, /\.omv\/repro\/demo\/observed\.txt/);

    const again = await initReproArtifacts("demo", projectRoot);
    assert.equal(again.updatedFinding, false);
    assert.ok(again.skipped.length >= 4);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("doctorFinding explains submission blockers without suggesting reports prematurely", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "needs-work.yaml"),
      BASE_FINDING
        .replace("observed_result: reads outside base directory", "observed_result: unknown")
        .replace("affected_range: unknown", "affected_range: unknown")
        .replace("unverified_fields: []", "unverified_fields: [evidence.observed_result, versions.affected_range]"),
      "utf-8",
    );

    const result = await doctorFinding("needs-work", projectRoot);
    assert.equal(result.reportReady, false);
    assert.notEqual(result.nextAction, "/omv-report needs-work");
    assert.match(result.issues.map((issue) => issue.message).join("\n"), /local observed result is missing/);
    assert.match(result.issues.map((issue) => issue.message).join("\n"), /affected version range is unknown/);
    assert.equal(result.submissionThreshold, 75);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("checkReportArtifacts validates report files and referenced reproduction artifacts", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(
      join(dir, "confirmed.yaml"),
      BASE_FINDING.replace("status: candidate", "status: confirmed").replace(
        "observed_result: reads outside base directory",
        "observed_result: reads outside base directory\n  repro_artifacts:\n    - .omv/repro/confirmed/observed.txt",
      ),
      "utf-8",
    );

    let result = await checkReportArtifacts("confirmed", projectRoot);
    assert.match(result.errors.join("\n"), /no report artifacts/);
    assert.match(result.errors.join("\n"), /missing reproduction artifact/);

    await initReproArtifacts("confirmed", projectRoot);
    await mkdir(findingReportsDir("confirmed", projectRoot), { recursive: true });
    await writeFile(join(findingReportsDir("confirmed", projectRoot), "empty.md"), "", "utf-8");
    result = await checkReportArtifacts("confirmed", projectRoot);
    assert.match(result.errors.join("\n"), /no non-empty report artifacts/);
    assert.match(result.errors.join("\n"), /report artifact is empty/);

    await writeFile(join(findingReportsDir("confirmed", projectRoot), "vuldb.md"), "# report\n", "utf-8");
    result = await checkReportArtifacts("confirmed", projectRoot);
    assert.deepEqual(result.reportArtifactPaths, [join(findingReportsDir("confirmed", projectRoot), "vuldb.md")]);
    assert.match(result.errors.join("\n"), /report artifact is empty/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("end-to-end finding flow validates, promotes, checks artifacts, and archives reported work", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-findings-"));

  try {
    const template = await createFindingTemplate("e2e", { projectRoot });
    await writeFile(template.path, BASE_FINDING, "utf-8");

    const candidate = await validateFinding("e2e", projectRoot);
    assert.equal(candidate.ok, true);
    assert.equal(candidate.status, "candidate");

    const promoted = await promoteFinding("e2e", "confirmed", projectRoot);
    assert.equal(promoted.ok, true);
    assert.equal(promoted.status, "confirmed");

    await initReproArtifacts("e2e", projectRoot);
    await mkdir(findingReportsDir("e2e", projectRoot), { recursive: true });
    const reportPath = join(findingReportsDir("e2e", projectRoot), "vuldb.md");
    await writeFile(reportPath, "# Demo report\n", "utf-8");

    const artifacts = await checkReportArtifacts("e2e", projectRoot);
    assert.deepEqual(artifacts.errors, []);
    assert.deepEqual(artifacts.reportArtifactPaths, [reportPath]);

    const archived = await archiveFinding("e2e", "reported", projectRoot, { strict: true });
    assert.equal(archived.archiveReason, "reported");
    assert.deepEqual(archived.reportArtifactPaths, [reportPath]);
    assert.equal(existsSync(join(findingsDir(projectRoot), "e2e.yaml")), false);
    assert.equal(existsSync(join(archivedFindingsDir(projectRoot), "e2e.yaml")), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
