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
});

test("CLI argument validation covers workspace and archive workflow commands", () => {
  assert.equal(validateArgs(["workspace", "init"]).ok, true);
  assert.equal(validateArgs(["workspace", "status", "--json"]).ok, true);
  assert.equal(validateArgs(["workspace", "log", "--json"]).ok, true);
  assert.equal(validateArgs(["workspace", "bogus"]).ok, false);
  assert.match(validateArgs(["workspace", "bogus"]).error ?? "", /Unknown workspace command/);

  assert.equal(validateArgs(["findings", "workflow"]).ok, true);
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

test("CLI argument validation accepts UX flags and command help", () => {
  assert.equal(validateArgs(["version"]).ok, true);
  assert.equal(validateArgs(["version", "--json"]).ok, true);
  assert.equal(validateArgs(["setup", "--json", "--force"]).ok, true);
  assert.equal(validateArgs(["doctor", "--strict"]).ok, true);
  assert.equal(validateArgs(["dashboard"]).ok, true);
  assert.equal(validateArgs(["dashboard", "--json"]).ok, true);
  assert.equal(validateArgs(["repro", "init", "demo"]).ok, true);
  assert.equal(validateArgs(["repro", "init", "demo", "--force", "--json"]).ok, true);
  assert.equal(validateArgs(["report", "artifacts", "demo"]).ok, true);
  assert.equal(validateArgs(["report", "artifacts", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["findings", "doctor", "demo"]).ok, true);
  assert.equal(validateArgs(["findings", "doctor", "demo", "--json"]).ok, true);
  assert.equal(validateArgs(["findings", "validate", "--strict"]).ok, true);
  assert.equal(validateArgs(["setup", "--help"]).ok, true);
  assert.equal(validateArgs(["findings", "validate", "--help"]).ok, true);
  assert.equal(validateArgs(["help", "findings", "validate"]).ok, true);
});
