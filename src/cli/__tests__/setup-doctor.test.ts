import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setup, uninstall } from "../setup.js";
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
    const warningsBeforeUnrelatedSkill = check.checks.filter((item) => item.status === "warn").length;

    const unrelatedSkill = join(claudeHome, "skills", "personal-helper");
    await mkdir(unrelatedSkill, { recursive: true });
    await writeFile(join(unrelatedSkill, "SKILL.md"), "# Personal helper\n", "utf-8");
    check = await doctor({ scope: "user" });
    assert.equal(check.checks.filter((item) => item.status === "warn").length, warningsBeforeUnrelatedSkill);
    assert.equal(check.checks.some((item) => item.name === "unexpected skills"), false);

    await writeFile(
      join(claudeHome, "skills", "omv-find", "SKILL.md"),
      `${await readFile(join(claudeHome, "skills", "omv-find", "SKILL.md"), "utf-8")}\n# local edit\n`,
      "utf-8",
    );
    check = await doctor({ scope: "user" });
    assert.equal(check.ok, false);
    assert.match(
      check.checks.find((item) => item.name === "skill: omv-find")?.message ?? "",
      /outdated SKILL\.md/,
    );
    assert.equal(
      check.checks.find((item) => item.name === "skill: omv-find")?.remediation,
      "omv setup --scope user --platform claude-code --force",
    );
    assert.equal(
      check.checks.find((item) => item.name === "modified installed files")?.remediation,
      "omv setup --scope user --platform claude-code --force",
    );
    assert.match(
      check.checks.find((item) => item.name === "modified installed files")?.message ?? "",
      /omv-find[/\\]SKILL\.md/,
    );

    await rm(installManifestPath("user"));
    check = await doctor({ scope: "user" });
    assert.equal(check.ok, false);
    assert.match(check.checks.find((item) => item.name === "skill: omv-find")?.message ?? "", /outdated SKILL\.md/);
    assert.match(check.checks.find((item) => item.name === "install manifest")?.message ?? "", /not found/);

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

test("explicit user doctor ignores project-scoped platform state", async () => {
  const previousClaudeHome = process.env.CLAUDE_HOME;
  const claudeHome = await mkdtemp(join(tmpdir(), "omv-user-doctor-home-"));
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-user-doctor-project-"));
  process.env.CLAUDE_HOME = claudeHome;

  try {
    await setup({ scope: "user", platform: "claude-code" });
    await mkdir(join(projectRoot, ".omv"), { recursive: true });
    await writeFile(
      join(projectRoot, ".omv", "setup-scope.json"),
      JSON.stringify({ scope: "project", platform: "codex" }) + "\n",
      "utf-8",
    );

    const check = await doctor({ scope: "user", projectRoot });
    assert.equal(check.platform, "claude-code");
    assert.equal(check.ok, true);
  } finally {
    if (previousClaudeHome === undefined) delete process.env.CLAUDE_HOME;
    else process.env.CLAUDE_HOME = previousClaudeHome;
    await rm(claudeHome, { recursive: true, force: true });
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Codex user setup installs skills into ~/.agents without Claude subagents", async () => {
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const previousCodexHome = process.env.CODEX_HOME;
  const home = await mkdtemp(join(tmpdir(), "omv-codex-user-"));
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.CODEX_HOME = join(home, ".codex");

  try {
    await mkdir(process.env.CODEX_HOME, { recursive: true });
    const result = await setup({ platform: "codex" });
    const skillsDir = join(home, ".agents", "skills");

    assert.equal(result.platform, "codex");
    assert.equal(result.destination, skillsDir);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(result.installedAgents, []);
    assert.equal(existsSync(join(skillsDir, "omv", "SKILL.md")), true);
    assert.equal(existsSync(join(home, ".claude", "agents")), false);
    assert.equal(existsSync(installManifestPath("user", process.cwd(), "codex")), true);

    const check = await doctor({ scope: "user", platform: "codex" });
    assert.equal(check.ok, true);
    assert.equal(check.platform, "codex");
    assert.equal(check.skillsDir, skillsDir);
    assert.match(check.checks.find((item) => item.name === "agents")?.message ?? "", /no Claude agent files required/);

    const installedOmv = join(skillsDir, "omv", "SKILL.md");
    await writeFile(installedOmv, `${await readFile(installedOmv, "utf-8")}\n# stale same-version copy\n`, "utf-8");
    let drift = await doctor({ scope: "user", platform: "codex" });
    assert.equal(drift.ok, false);
    assert.match(drift.checks.find((item) => item.name === "skill: omv")?.message ?? "", /outdated SKILL\.md/);
    assert.equal(
      drift.checks.find((item) => item.name === "skill: omv")?.remediation,
      "omv setup --scope user --platform codex --force",
    );

    await setup({ platform: "codex", force: true });
    const legacyFile = join(skillsDir, "omv", "references", "legacy.md");
    await writeFile(legacyFile, "legacy\n", "utf-8");
    drift = await doctor({ scope: "user", platform: "codex" });
    assert.equal(drift.ok, true);
    assert.equal(drift.warnings, true);
    assert.match(drift.checks.find((item) => item.name === "skill: omv")?.message ?? "", /extra managed file references[/\\]legacy\.md/);
    assert.equal(
      drift.checks.find((item) => item.name === "skill: omv")?.remediation,
      "omv setup --scope user --platform codex --force",
    );

    const removed = await uninstall({ scope: "user", platform: "codex" });
    assert.equal(removed.platform, "codex");
    assert.equal(removed.removed.includes("omv"), true);
    assert.equal(existsSync(join(skillsDir, "omv")), false);
  } finally {
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
    else process.env.CODEX_HOME = previousCodexHome;
    await rm(home, { recursive: true, force: true });
  }
});

test("Codex project setup persists platform and doctor discovers it", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-codex-project-"));

  try {
    const claudeResult = await setup({ scope: "project", platform: "claude-code", projectRoot });
    assert.deepEqual(claudeResult.errors, []);
    const result = await setup({ scope: "project", platform: "codex", projectRoot });
    const skillsDir = join(projectRoot, ".agents", "skills");
    assert.equal(result.destination, skillsDir);
    assert.deepEqual(result.errors, []);
    assert.equal(existsSync(join(skillsDir, "omv-report", "SKILL.md")), true);
    assert.equal(existsSync(installManifestPath("project", projectRoot, "codex")), true);
    assert.equal(existsSync(installManifestPath("project", projectRoot, "claude-code")), true);
    assert.equal(existsSync(join(projectRoot, ".claude", "skills", "omv-report", "SKILL.md")), true);

    const persisted = JSON.parse(await readFile(join(projectRoot, ".omv", "setup-scope.json"), "utf-8")) as {
      platform?: string;
    };
    assert.equal(persisted.platform, "codex");

    const check = await doctor({ projectRoot });
    assert.equal(check.ok, true);
    assert.equal(check.scope, "project");
    assert.equal(check.platform, "codex");
    assert.equal(check.skillsDir, skillsDir);

    const removed = await uninstall({ scope: "project", platform: "codex", projectRoot });
    assert.deepEqual(removed.errors, []);
    assert.equal(existsSync(join(skillsDir, "omv-report")), false);
    assert.equal(existsSync(join(projectRoot, ".claude", "skills", "omv-report", "SKILL.md")), true);
    assert.equal(existsSync(installManifestPath("project", projectRoot, "claude-code")), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
