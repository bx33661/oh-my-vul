import test from "node:test";
import assert from "node:assert/strict";
import { readCatalog, getInstallableSkills } from "../catalog.js";

test("registry catalog exposes installable skills", async () => {
  const catalog = await readCatalog();
  assert.equal(catalog.name, "oh-my-vul");
  assert.equal(catalog.platform, "claude-code");

  const skills = getInstallableSkills(catalog);
  assert.deepEqual(skills.map((skill) => skill.name), [
    "using-omv",
    "omv",
    "omv-find",
    "omv-audit",
    "omv-repro",
    "omv-report",
    "omv-radar",
    "omv-dedup",
    "omv-disclose",
    "omv-critic",
  ]);
  assert.deepEqual(skills.map((skill) => skill.category), [
    "manager",
    "manager",
    "research",
    "audit",
    "audit",
    "reporting",
    "intelligence",
    "intelligence",
    "disclosure",
    "reporting",
  ]);
  assert.equal(skills[0].invocation, "/using-omv");
  assert.equal(skills[2].invocation, "/omv-find");
  assert.deepEqual(skills[2].produces, ["CandidateList.v1", "Evidence.v1"]);
});
