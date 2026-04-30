import test from "node:test";
import assert from "node:assert/strict";
import { readCatalog, getInstallableSkills } from "../catalog.js";

test("registry catalog exposes installable skills", async () => {
  const catalog = await readCatalog();
  assert.equal(catalog.name, "oh-my-vul");
  assert.equal(catalog.platform, "claude-code");

  const skills = getInstallableSkills(catalog);
  assert.deepEqual(skills.map((skill) => skill.name), ["omv", "omv-find", "omv-report"]);
  assert.deepEqual(skills.map((skill) => skill.category), ["manager", "research", "reporting"]);
  assert.equal(skills[1].invocation, "/omv-find");
  assert.deepEqual(skills[1].produces, ["CandidateList.v1", "Evidence.v1"]);
});
