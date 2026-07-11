import test from "node:test";
import assert from "node:assert/strict";
import { interactiveTuiAllowed, plainPresenterRequested, shouldLaunchBareTui } from "../presenter.js";

test("interactive presenter requires both TTY streams", () => {
  assert.equal(shouldLaunchBareTui({ stdinIsTTY: true, stdoutIsTTY: true }), true);
  assert.equal(shouldLaunchBareTui({ stdinIsTTY: false, stdoutIsTTY: true }), false);
  assert.equal(shouldLaunchBareTui({ stdinIsTTY: true, stdoutIsTTY: false }), false);
});

test("interactive presenter respects plain-mode and CI controls", () => {
  const base = { stdinIsTTY: true, stdoutIsTTY: true };
  assert.equal(interactiveTuiAllowed({ ...base, noTuiFlag: true }), false);
  assert.equal(interactiveTuiAllowed({ ...base, noTuiEnvironment: "1" }), false);
  assert.equal(interactiveTuiAllowed({ ...base, noTuiEnvironment: "TRUE" }), false);
  assert.equal(interactiveTuiAllowed({ ...base, ci: true }), false);
  assert.equal(interactiveTuiAllowed({ ...base, noTuiEnvironment: "0" }), true);
  assert.equal(plainPresenterRequested({ noTuiFlag: true }), true);
  assert.equal(plainPresenterRequested({ noTuiEnvironment: "TRUE" }), true);
  assert.equal(plainPresenterRequested({ ci: true }), true);
  assert.equal(plainPresenterRequested({ ci: false, noTuiEnvironment: "false" }), false);
});
