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

test("CLI argument validation accepts UX flags and command help", () => {
  assert.equal(validateArgs(["version"]).ok, true);
  assert.equal(validateArgs(["version", "--json"]).ok, true);
  assert.equal(validateArgs(["setup", "--json", "--force"]).ok, true);
  assert.equal(validateArgs(["doctor", "--strict"]).ok, true);
  assert.equal(validateArgs(["findings", "validate", "--strict"]).ok, true);
  assert.equal(validateArgs(["setup", "--help"]).ok, true);
  assert.equal(validateArgs(["findings", "validate", "--help"]).ok, true);
  assert.equal(validateArgs(["help", "findings", "validate"]).ok, true);
});
