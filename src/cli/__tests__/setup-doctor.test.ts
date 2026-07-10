import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup } from "../setup.js";
import { doctor } from "../doctor.js";
import { installManifestPath } from "../install-manifest.js";

test("setup installs self-contained Claude Code skills and doctor checks runtime assets", async () => {
  const previousClaudeHome = process.env.CLAUDE_HOME;
  const claudeHome = await mkdtemp(join(tmpdir(), "omv-claude-home-"));
  process.env.CLAUDE_HOME = claudeHome;

  try {
    const result = await setup();
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.installed.sort(), [
      "omv",
      "omv-audit",
      "omv-critic",
      "omv-dedup",
      "omv-disclose",
      "omv-find",
      "omv-radar",
      "omv-report",
      "omv-repro",
      "using-omv",
    ]);

    assert.equal(existsSync(join(claudeHome, "skills", "omv-find", "references", "shared", "ecosystems.md")), true);
    assert.equal(existsSync(join(claudeHome, "skills", "omv-find", "contracts", "evidence.v1.yaml")), true);
    assert.equal(existsSync(join(claudeHome, "skills", "omv-audit", "contracts", "evidence.v1.yaml")), true);
    assert.equal(existsSync(join(claudeHome, "skills", "omv-repro", "contracts", "evidence.v1.yaml")), true);
    assert.equal(existsSync(join(claudeHome, "skills", "omv-report", "references", "shared", "cvss-builder.md")), true);
    assert.equal(existsSync(join(claudeHome, "skills", "omv", "references", "registry.yaml")), true);
    assert.equal(existsSync(installManifestPath("user")), true);

    // Bundled subagents should be installed into ~/.claude/agents/.
    assert.equal(existsSync(join(claudeHome, "agents", "dataflow-tracer.md")), true);
    assert.equal(existsSync(join(claudeHome, "agents", "verifier.md")), true);
    assert.equal(existsSync(join(claudeHome, "agents", "guard-checker.md")), true);
    assert.deepEqual(result.installedAgents.sort(), [
      "cvss-analyst",
      "dataflow-tracer",
      "dedup-analyst",
      "guard-checker",
      "report-writer",
      "verifier",
      "vuln-scanner",
    ]);

    let check = await doctor({ scope: "user" });
    assert.equal(check.ok, true);
    assert.equal(check.checks.find((item) => item.name === "install manifest")?.status, "pass");
    assert.equal(check.checks.find((item) => item.name === "agents")?.status, "pass");

    await writeFile(
      join(claudeHome, "skills", "omv-find", "SKILL.md"),
      `${await readFile(join(claudeHome, "skills", "omv-find", "SKILL.md"), "utf-8")}\n# local edit\n`,
      "utf-8",
    );
    check = await doctor({ scope: "user" });
    assert.equal(check.ok, true);
    assert.match(
      check.checks.find((item) => item.name === "modified installed files")?.message ?? "",
      /omv-find[/\\]SKILL\.md/,
    );

    await rm(join(claudeHome, "skills", "omv-find", "contracts", "evidence.v1.yaml"));
    check = await doctor({ scope: "user" });
    assert.equal(check.ok, false);
    assert.match(
      check.checks.find((item) => item.name === "skill: omv-find")?.message ?? "",
      /contracts[/\\]evidence\.v1\.yaml/,
    );

    await setup({ force: true });
    const manifestPath = installManifestPath("user");
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as { package_version: string };
    manifest.package_version = "0.0.0";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");
    check = await doctor({ scope: "user" });
    assert.match(
      check.checks.find((item) => item.name === "install manifest")?.message ?? "",
      /stale version/,
    );

    await setup({ force: true });
    const installedOmv = join(claudeHome, "skills", "omv", "SKILL.md");
    const original = await readFile(installedOmv, "utf-8");
    await writeFile(installedOmv, `${original}\nBroken reference: \`../../registry.yaml\`\n`, "utf-8");
    check = await doctor({ scope: "user" });
    assert.equal(check.ok, false);
    assert.match(
      check.checks.find((item) => item.name === "skill: omv")?.message ?? "",
      /package-external reference/,
    );
  } finally {
    if (previousClaudeHome === undefined) {
      delete process.env.CLAUDE_HOME;
    } else {
      process.env.CLAUDE_HOME = previousClaudeHome;
    }
    await rm(claudeHome, { recursive: true, force: true });
  }
});

test("project setup installs into .claude and persists doctor scope", async () => {
  const previousClaudeHome = process.env.CLAUDE_HOME;
  const claudeHome = await mkdtemp(join(tmpdir(), "omv-user-claude-home-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-project-"));
  process.env.CLAUDE_HOME = claudeHome;

  try {
    const result = await setup({ scope: "project", projectRoot });
    assert.equal(result.scope, "project");
    assert.equal(result.destination, join(projectRoot, ".claude", "skills"));
    assert.deepEqual(result.errors, []);
    assert.equal(existsSync(join(projectRoot, ".omv", "setup-scope.json")), true);
    assert.equal(existsSync(installManifestPath("project", projectRoot)), true);
    assert.equal(existsSync(join(projectRoot, ".claude", "skills", "omv-report", "contracts", "evidence.v1.yaml")), true);

    const check = await doctor({ projectRoot });
    assert.equal(check.scope, "project");
    assert.equal(check.ok, true);
    assert.equal(check.skillsDir, join(projectRoot, ".claude", "skills"));
  } finally {
    if (previousClaudeHome === undefined) {
      delete process.env.CLAUDE_HOME;
    } else {
      process.env.CLAUDE_HOME = previousClaudeHome;
    }
    await rm(claudeHome, { recursive: true, force: true });
    await rm(projectRoot, { recursive: true, force: true });
  }
});
