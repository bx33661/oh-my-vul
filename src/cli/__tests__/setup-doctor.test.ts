import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup } from "../setup.js";
import { doctor } from "../doctor.js";

test("setup installs self-contained Codex skills and doctor checks runtime assets", async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = await mkdtemp(join(tmpdir(), "omv-codex-home-"));
  process.env.CODEX_HOME = codexHome;

  try {
    const result = await setup();
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.installed.sort(), ["omv", "omv-find", "omv-report"]);

    assert.equal(existsSync(join(codexHome, "skills", "omv-find", "references", "shared", "ecosystems.md")), true);
    assert.equal(existsSync(join(codexHome, "skills", "omv-find", "contracts", "evidence.v1.yaml")), true);
    assert.equal(existsSync(join(codexHome, "skills", "omv-report", "references", "shared", "cvss-builder.md")), true);
    assert.equal(existsSync(join(codexHome, "skills", "omv", "references", "registry.yaml")), true);

    let check = await doctor();
    assert.equal(check.ok, true);

    await rm(join(codexHome, "skills", "omv-find", "contracts", "evidence.v1.yaml"));
    check = await doctor();
    assert.equal(check.ok, false);
    assert.match(
      check.checks.find((item) => item.name === "skill: omv-find")?.message ?? "",
      /contracts[/\\]evidence\.v1\.yaml/,
    );

    await setup({ force: true });
    const installedOmv = join(codexHome, "skills", "omv", "SKILL.md");
    const original = await readFile(installedOmv, "utf-8");
    await writeFile(installedOmv, `${original}\nBroken reference: \`../../registry.yaml\`\n`, "utf-8");
    check = await doctor();
    assert.equal(check.ok, false);
    assert.match(
      check.checks.find((item) => item.name === "skill: omv")?.message ?? "",
      /package-external reference/,
    );
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    await rm(codexHome, { recursive: true, force: true });
  }
});

test("project setup installs into .codex and persists doctor scope", async () => {
  const previousCodexHome = process.env.CODEX_HOME;
  const codexHome = await mkdtemp(join(tmpdir(), "omv-user-codex-home-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-project-"));
  process.env.CODEX_HOME = codexHome;

  try {
    const result = await setup({ scope: "project", projectRoot });
    assert.equal(result.scope, "project");
    assert.equal(result.destination, join(projectRoot, ".codex", "skills"));
    assert.deepEqual(result.errors, []);
    assert.equal(existsSync(join(projectRoot, ".omv", "setup-scope.json")), true);
    assert.equal(existsSync(join(projectRoot, ".codex", "skills", "omv-report", "contracts", "evidence.v1.yaml")), true);

    const check = await doctor({ projectRoot });
    assert.equal(check.scope, "project");
    assert.equal(check.ok, true);
    assert.equal(check.skillsDir, join(projectRoot, ".codex", "skills"));
  } finally {
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    await rm(codexHome, { recursive: true, force: true });
    await rm(projectRoot, { recursive: true, force: true });
  }
});
