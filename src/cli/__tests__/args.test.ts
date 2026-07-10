import test from "node:test";
import assert from "node:assert/strict";
import { validateArgs } from "../args.js";

test("CLI argument validation rejects unknown commands and flags", () => {
  assert.equal(validateArgs(["unknown"]).ok, false);

  const unknownFlag = validateArgs(["findings", "validate", "--bogus"]);
  assert.equal(unknownFlag.ok, false);
  assert.match(unknownFlag.error ?? "", /Unknown flag/);
});

test("CLI argument validation rejects missing and invalid option values", () => {
  const missingScope = validateArgs(["setup", "--scope"]);
  assert.equal(missingScope.ok, false);
  assert.match(missingScope.error ?? "", /--scope requires/);

  const missingStatus = validateArgs(["findings", "promote", "demo", "--status"]);
  assert.equal(missingStatus.ok, false);
  assert.match(missingStatus.error ?? "", /--status requires/);

  const invalidStatus = validateArgs(["findings", "init", "demo", "--status", "done"]);
  assert.equal(invalidStatus.ok, false);
  assert.match(invalidStatus.error ?? "", /--status must be/);
});

test("CLI argument validation enforces command positional arity", () => {
  const missingId = validateArgs(["findings", "init"]);
  assert.equal(missingId.ok, false);
  assert.match(missingId.error ?? "", /requires 1 positional/);

  const extraDoctorArg = validateArgs(["doctor", "extra"]);
  assert.equal(extraDoctorArg.ok, false);
  assert.match(extraDoctorArg.error ?? "", /accepts at most 0 positional/);

  assert.equal(validateArgs(["findings", "validate", "demo", "--json"]).ok, true);

  const missingReviewId = validateArgs(["review"]);
  assert.equal(missingReviewId.ok, false);
  assert.match(missingReviewId.error ?? "", /requires 1 positional/);
});

test("CLI argument validation covers workspace and archive workflow commands", () => {
  assert.equal(validateArgs(["workspace", "init"]).ok, true);
  assert.equal(validateArgs(["workspace", "status", "--json"]).ok, true);
  assert.equal(validateArgs(["workspace", "log", "--json"]).ok, true);
  assert.equal(validateArgs(["workspace", "bogus"]).ok, false);
  assert.match(validateArgs(["workspace", "bogus"]).error ?? "", /Unknown workspace command/);

  assert.equal(validateArgs(["findings", "workflow"]).ok, true);
  assert.equal(validateArgs(["findings", "doctor", "demo", "--strict-verification"]).ok, true);
  assert.equal(validateArgs(["findings", "show", "demo", "--archived"]).ok, true);
  assert.equal(validateArgs(["findings", "open", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["findings", "archive", "demo", "--reason", "reported", "--strict"]).ok, true);
  assert.equal(validateArgs(["findings", "archive", "demo", "--reason", "reported"]).ok, true);
  assert.equal(validateArgs(["findings", "archive", "list", "--json"]).ok, true);
  assert.equal(validateArgs(["findings", "restore", "demo", "--force"]).ok, true);

  const missingReason = validateArgs(["findings", "archive", "demo"]);
  assert.equal(missingReason.ok, false);
  assert.match(missingReason.error ?? "", /--reason requires/);

  const extraWorkflowArg = validateArgs(["findings", "workflow", "extra"]);
  assert.equal(extraWorkflowArg.ok, false);
  assert.match(extraWorkflowArg.error ?? "", /accepts at most 0 positional/);
});

test("CLI argument validation covers intelligence and disclosure commands", () => {
  assert.equal(validateArgs(["radar", "refresh", "--dry-run"]).ok, true);
  assert.equal(validateArgs(["radar", "brief", "--json"]).ok, true);
  assert.equal(validateArgs(["request", "preflight", "--refresh"]).ok, true);
  assert.equal(validateArgs(["request", "fetch", "https://example.test", "--accept", "application/json", "--json"]).ok, true);
  assert.equal(validateArgs(["dedup", "demo", "--confirm", "--existing-cve", "none", "--notes", "searched"]).ok, true);
  assert.equal(validateArgs(["disclose", "timeline", "demo", "--days", "45"]).ok, true);
  assert.equal(validateArgs(["submissions", "record", "demo", "--platform", "vuldb", "--submission-id", "123", "--url", "https://example.test"]).ok, true);
  assert.equal(validateArgs(["submissions", "track", "demo"]).ok, true);
  assert.equal(validateArgs(["submissions", "close", "demo", "--cve", "CVE-2026-12345"]).ok, true);
  assert.equal(validateArgs(["threat-map", "validate", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["verification", "init", "demo", "--force"]).ok, true);
  assert.equal(validateArgs(["verification", "show", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["verification", "validate", "demo"]).ok, true);

  assert.equal(validateArgs(["radar", "refresh", "extra"]).ok, false);
  assert.equal(validateArgs(["request", "fetch"]).ok, false);
  assert.equal(validateArgs(["request", "fetch", "https://example.test", "extra"]).ok, false);
  assert.equal(validateArgs(["submissions", "record", "demo", "--platform", "vuldb"]).ok, false);
  assert.equal(validateArgs(["verification", "validate"]).ok, false);
});

test("CLI argument validation accepts UX flags and command help", () => {
  assert.equal(validateArgs(["version"]).ok, true);
  assert.equal(validateArgs(["version", "--json"]).ok, true);
  assert.equal(validateArgs(["setup", "--json", "--force"]).ok, true);
  assert.equal(validateArgs(["doctor", "--strict"]).ok, true);
  assert.equal(validateArgs(["dashboard"]).ok, true);
  assert.equal(validateArgs(["dashboard", "--json"]).ok, true);
  assert.equal(validateArgs(["eval"]).ok, true);
  assert.equal(validateArgs(["eval", "--json"]).ok, true);
  assert.equal(validateArgs(["eval", "--junit"]).ok, true);
  assert.equal(validateArgs(["eval", "--skill", "omv-find", "--eval-id", "26", "--output", "result.md", "--json"]).ok, true);
  assert.equal(validateArgs(["review", "demo", "--strict", "--json"]).ok, true);
  assert.equal(validateArgs(["repro", "init", "demo"]).ok, true);
  assert.equal(validateArgs(["repro", "init", "demo", "--force", "--json"]).ok, true);
  assert.equal(validateArgs(["report", "artifacts", "demo"]).ok, true);
  assert.equal(validateArgs(["report", "artifacts", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["report", "provenance", "demo", "--force", "--json"]).ok, true);
  assert.equal(validateArgs(["sources", "init", "demo", "--force", "--json"]).ok, true);
  assert.equal(validateArgs(["sources", "show", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["sources", "validate", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["findings", "doctor", "demo"]).ok, true);
  assert.equal(validateArgs(["findings", "doctor", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["findings", "validate", "--strict"]).ok, true);
  assert.equal(validateArgs(["setup", "--help"]).ok, true);
  assert.equal(validateArgs(["findings", "validate", "--help"]).ok, true);
  assert.equal(validateArgs(["help", "findings", "validate"]).ok, true);
});

test("CLI argument validation enforces eval target and output format rules", () => {
  for (const command of [
    ["eval", "extra"],
    ["eval", "--json", "--junit"],
    ["eval", "--skill", "omv-find"],
    ["eval", "--skill", "omv-find", "--eval-id", "26"],
    ["eval", "--eval-id", "26", "--output", "result.md"],
    ["eval", "--skill", "../find", "--eval-id", "26", "--output", "result.md"],
    ["eval", "--skill", "omv-find", "--eval-id", "-1", "--output", "result.md"],
    ["eval", "--skill", "omv-find", "--eval-id", "x", "--output", "result.md"],
  ]) {
    assert.equal(validateArgs(command).ok, false, command.join(" "));
  }
});

test("CLI argument validation enforces SourceRef and report provenance grammar", () => {
  for (const command of [
    ["sources", "init"],
    ["sources", "init", "demo", "extra"],
    ["sources", "show"],
    ["sources", "show", "demo", "--force"],
    ["sources", "validate", "demo", "extra"],
    ["sources", "unknown", "demo"],
    ["report", "provenance"],
    ["report", "provenance", "demo", "extra"],
  ]) {
    assert.equal(validateArgs(command).ok, false, command.join(" "));
  }
});

test("CLI argument validation covers Campaign commands and first aliases", () => {
  const initFlags = [
    "--target", "acme", "--version", "1.2", "--source", "/tmp/acme",
    "--ecosystem", "npm", "--mode", "passive", "--goal", "research-notes",
    "--budget", "standard", "--vuln", "xss,auth", "--local-lab", "unknown",
    "--id", "demo", "--force", "--no-interactive", "--json",
  ];
  assert.equal(validateArgs(["campaign"]).ok, true);
  assert.equal(validateArgs(["campaign", "init", ...initFlags]).ok, true);
  assert.equal(validateArgs(["first", ...initFlags]).ok, true);
  assert.equal(validateArgs(["first", "init", ...initFlags]).ok, true);
  assert.equal(validateArgs(["campaign", "list", "--json"]).ok, true);
  assert.equal(validateArgs(["first", "list", "--json"]).ok, true);
  assert.equal(validateArgs(["campaign", "show", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["first", "show", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["campaign", "seed", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["first", "seed", "demo", "--json"]).ok, true);

  for (const command of [
    ["campaign", "seed", "demo", "--force"],
    ["first", "seed", "demo", "--force"],
    ["campaign", "show"],
    ["campaign", "show", "demo", "extra"],
    ["campaign", "seed"],
    ["campaign", "list", "extra"],
    ["campaign", "init", "extra"],
    ["campaign", "init", "--mode", "live"],
    ["campaign", "init", "--goal", "pdf"],
    ["campaign", "init", "--budget", "forever"],
    ["campaign", "init", "--local-lab", "maybe"],
    ["campaign", "init", "--ecosystem", "other"],
  ]) {
    assert.equal(validateArgs(command).ok, false, command.join(" "));
  }
});
