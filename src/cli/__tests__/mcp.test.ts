import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ensureFindingsDir } from "../findings.js";
import { handleMcpRequest } from "../mcp.js";

const FINDING = `schema_version: "1"
handoff_version: "1.0"
status: candidate
package:
  ecosystem: npm
  registry_name: demo
  repository_url: https://github.com/example/demo
vulnerability:
  class: ssrf
  cwe: CWE-918
evidence:
  source: unknown
  sink: unknown
  guard: unknown
  reproducer: none
  observed_result: unknown
cvss:
  vector: unknown
  severity: unknown
impact:
  attack_vector: unknown
  authentication_required: unknown
  user_interaction_required: unknown
  scope_changed: unknown
  confidentiality: unknown
  integrity: unknown
  availability: unknown
dedup:
  nvd_searched: false
  ghsa_searched: false
  ecosystem_db_searched: false
disclosure:
  contact_date: unknown
  planned_disclosure_date: unknown
provenance:
  verification_date: unknown
  unverified_fields: []
blockers: []
`;

test("MCP handler exposes read-only finding views and rejects writes", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-mcp-"));
  try {
    const dir = await ensureFindingsDir(projectRoot);
    await writeFile(join(dir, "demo.yaml"), FINDING, "utf-8");

    const listed = await handleMcpRequest({ method: "findings.list" }, projectRoot);
    assert.equal(listed.ok, true);
    assert.match(JSON.stringify(listed.result), /demo/);

    const rejected = await handleMcpRequest({ method: "findings.promote", params: { id: "demo" } }, projectRoot);
    assert.equal(rejected.ok, false);
    assert.match(rejected.error ?? "", /unsupported read-only method/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
