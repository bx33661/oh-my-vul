import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../omv.js", import.meta.url));
const evidenceFixturePath = fileURLToPath(
  new URL("../../../skills/omv-report/evals/fixtures/confirmed-prototype-pollution.yaml", import.meta.url),
);
const packageJsonPath = fileURLToPath(new URL("../../../package.json", import.meta.url));

test("compiled CLI entrypoint emits complete version JSON on the supported runtime baseline", async () => {
  const result = runCli(["version", "--json"]);
  const pkg = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
    version: string;
    engines: { node: string };
    dependencies: Record<string, string>;
  };

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(output.package, "oh-my-vul");
  assert.equal(output.version, pkg.version);
  assert.equal(typeof output.registryVersion, "string");
  assert.equal(typeof output.platform, "string");
  assert.equal(pkg.engines.node, ">=22");
  assert.match(pkg.dependencies.ink, /^\^7\./);
  assert.match(pkg.dependencies.react, /^\^19\./);
});

test("compiled CLI renders help through the command router", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /oh-my-vul/);
  assert.match(result.stdout, /Workflow/);
  assert.match(result.stdout, /omv start/);
  assert.match(result.stdout, /omv dashboard/);
  assert.match(result.stdout, /omv review/);
  assert.match(result.stdout, /omv setup/);
  assert.match(result.stdout, /omv doctor/);
  assert.match(result.stdout, /omv version/);
  assert.match(result.stdout, /omv help/);
  assert.doesNotMatch(result.stdout, /omv submissions record/);
  assert.doesNotMatch(result.stdout, /omv request/);
  assert.doesNotMatch(result.stdout, /omv eval/);
  assert.doesNotMatch(result.stdout, /campaign surfaces/);
});

test("compiled CLI groups all public commands behind help --all", () => {
  const result = runCli(["help", "--all"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Core Workflow/);
  assert.match(result.stdout, /Advanced Automation/);
  assert.match(result.stdout, /omv campaign list\|init\|show/);
  assert.match(result.stdout, /omv submissions record/);
  assert.match(result.stdout, /Skill-managed primitives are intentionally omitted/);
  assert.doesNotMatch(result.stdout, /omv request/);
  assert.doesNotMatch(result.stdout, /omv eval/);
  assert.doesNotMatch(result.stdout, /campaign surfaces/);
  assert.doesNotMatch(result.stdout, /workspace init/);
  assert.doesNotMatch(result.stdout, /findings workflow|findings doctor|findings open|findings delete/);
});

test("compiled CLI labels direct implicit command help as Skill-managed", () => {
  const result = runCli(["help", "request"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Skill-managed primitive: request/);
  assert.match(result.stdout, /omv request preflight/);
});

test("bare CLI is read-only before initialization and opens the dashboard afterward", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-entry-"));
  try {
    const welcome = runCli([], projectRoot);
    assert.equal(welcome.status, 0, welcome.stderr);
    assert.match(welcome.stdout, /omv start/);
    assert.equal(existsSync(join(projectRoot, ".omv")), false);

    const explicitPlain = runCli(["--no-tui"], projectRoot);
    assert.equal(explicitPlain.status, 0, explicitPlain.stderr);
    assert.match(explicitPlain.stdout, /omv start/);

    const explicitTuiPlain = runCli(["tui", "--no-tui"], projectRoot);
    assert.equal(explicitTuiPlain.status, 0, explicitTuiPlain.stderr);
    assert.match(explicitTuiPlain.stdout, /omv start/);
    assert.equal(existsSync(join(projectRoot, ".omv")), false);

    await mkdir(join(projectRoot, ".omv"), { recursive: true });
    const dashboard = runCli([], projectRoot);
    assert.equal(dashboard.status, 0, dashboard.stderr);
    assert.match(dashboard.stdout, /oh-my-vul dashboard/);

    const explicitTuiDashboard = runCli(["tui", "--no-tui"], projectRoot);
    assert.equal(explicitTuiDashboard.status, 0, explicitTuiDashboard.stderr);
    assert.match(explicitTuiDashboard.stdout, /oh-my-vul dashboard/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("explicit TUI command explains the non-TTY fallback", () => {
  const result = runCli(["tui"], process.cwd(), { CI: "false" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires a terminal/i);
  assert.match(result.stderr, /omv dashboard/);
});

test("compiled CLI rejects an unknown command with focused suggestions and a non-zero exit", () => {
  const result = runCli(["find"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: find/);
  assert.match(result.stderr, /Did you mean:/);
  assert.match(result.stderr, /\/omv-find/);
  assert.doesNotMatch(result.stdout + result.stderr, /omv submissions record/);
});

test("dashboard human output uses the canonical workflow columns", async () => {
  const projectRoot = await projectWithFinding();

  try {
    const result = runCli(["dashboard"], projectRoot);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\bverdict\b/);
    assert.match(result.stdout, /\bblocker\b/);
    assert.match(result.stdout, /\b(?:CLI|SKILL)\b/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("dashboard JSON output is one parseable document with stable core fields", async () => {
  const projectRoot = await projectWithFinding();

  try {
    const result = runCli(["dashboard", "--json"], projectRoot);

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout) as {
      status?: { root?: string; activeCount?: number };
      workflow?: Array<{ nextAction: string; action: { surface: string; command: string; reason: string } }>;
      campaigns?: unknown[];
      activity?: unknown[];
    };
    const actualRoot = await stat(output.status?.root ?? "");
    const expectedRoot = await stat(join(projectRoot, ".omv"));
    assert.equal(actualRoot.dev, expectedRoot.dev);
    assert.equal(actualRoot.ino, expectedRoot.ino);
    assert.equal(output.status?.activeCount, 1);
    assert.equal(Array.isArray(output.workflow), true);
    assert.equal(Array.isArray(output.campaigns), true);
    assert.equal(output.workflow?.[0].nextAction, output.workflow?.[0].action.command);
    assert.match(output.workflow?.[0].action.surface ?? "", /^(?:cli|claude)$/);
    assert.equal(Array.isArray(output.activity), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("compiled CLI runs the canonical Campaign workflow with stable JSON", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-campaign-"));
  try {
    const initialized = runCli([
      "campaign", "init", "--id", "demo", "--target", "Acme", "--ecosystem", "npm",
      "--vuln", "xss,auth", "--no-interactive", "--json",
    ], projectRoot);
    assert.equal(initialized.status, 0, initialized.stderr);
    const initJson = JSON.parse(initialized.stdout) as { campaign: { id: string }; yamlPath: string; runbookPath: string };
    assert.equal(initJson.campaign.id, "demo");
    assert.equal(existsSync(initJson.yamlPath), true);
    assert.equal(existsSync(initJson.runbookPath), true);

    const dashboard = runCli(["dashboard", "--json"], projectRoot);
    assert.equal(dashboard.status, 0, dashboard.stderr);
    const dashboardJson = JSON.parse(dashboard.stdout) as { campaigns: Array<{ id: string; nextAction: string }> };
    assert.equal(dashboardJson.campaigns[0].id, "demo");
    assert.match(dashboardJson.campaigns[0].nextAction, /^omv campaign/);

    const listed = runCli(["campaign", "--json"], projectRoot);
    assert.equal(listed.status, 0, listed.stderr);
    assert.deepEqual((JSON.parse(listed.stdout) as Array<{ id: string }>).map((item) => item.id), ["demo"]);

    const shown = runCli(["campaign", "show", "demo", "--json"], projectRoot);
    assert.equal(shown.status, 0, shown.stderr);
    assert.equal((JSON.parse(shown.stdout) as { campaign: { id: string } }).campaign.id, "demo");

    const seeded = runCli(["campaign", "seed", "demo", "--json"], projectRoot);
    assert.equal(seeded.status, 0, seeded.stderr);
    assert.deepEqual((JSON.parse(seeded.stdout) as { created: Array<{ id: string }> }).created.map((item) => item.id), [
      "demo-xss", "demo-auth",
    ]);
    const repeated = runCli(["campaign", "seed", "demo", "--json"], projectRoot);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal((JSON.parse(repeated.stdout) as { skipped: unknown[] }).skipped.length, 2);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("compiled CLI rejects removed routes with focused migration errors", () => {
  const removedRoutes: Array<[string[], RegExp]> = [
    [["first"], /use omv start.*omv campaign init/],
    [["workspace", "init"], /use omv start/],
    [["findings", "workflow"], /use omv dashboard/],
    [["findings", "doctor", "demo"], /use omv review <id>/],
    [["findings", "open", "demo"], /use omv findings show <id>/],
    [["findings", "delete", "demo"], /use omv findings archive <id>/],
  ];

  for (const [command, replacement] of removedRoutes) {
    const result = runCli(command);
    assert.equal(result.status, 1, command.join(" "));
    assert.match(result.stderr, replacement, command.join(" "));
    assert.equal(result.stdout, "", command.join(" "));
  }
});

test("compiled start detects npm context, initializes privacy state, and preserves campaign collisions", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-start-"));
  try {
    await writeFile(join(projectRoot, "package.json"), JSON.stringify({
      name: "detected-package",
      version: "1.2.3",
      repository: { url: "https://example.test/detected-package.git" },
    }), "utf-8");
    const started = runCli(["start", "--id", "guided", "--vuln", "xss", "--no-interactive", "--json"], projectRoot);
    assert.equal(started.status, 0, started.stderr);
    const result = JSON.parse(started.stdout) as {
      campaign: { campaign: { id: string; target: { name: string; version: string; ecosystem: string; source: string } } };
    };
    assert.deepEqual(result.campaign.campaign.target, {
      name: "detected-package",
      version: "1.2.3",
      ecosystem: "npm",
      source: "https://example.test/detected-package.git",
    });
    assert.equal(await readFile(join(projectRoot, ".gitignore"), "utf-8"), ".omv/\n");

    const collision = runCli(["start", "--id", "guided", "--vuln", "ssrf", "--no-interactive"], projectRoot);
    assert.equal(collision.status, 1);
    assert.match(collision.stderr, /already exists/);
    assert.match(await readFile(join(projectRoot, ".omv", "campaigns", "guided.yaml"), "utf-8"), /xss/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("compiled start detects non-npm manifests and honors explicit overrides", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-start-go-"));
  try {
    await writeFile(join(projectRoot, "go.mod"), "module example.test/demo\n", "utf-8");
    const detected = runCli(["start", "--id", "go-demo", "--vuln", "ssrf", "--no-interactive", "--json"], projectRoot);
    assert.equal(detected.status, 0, detected.stderr);
    assert.equal((JSON.parse(detected.stdout) as { campaign: { campaign: { target: { ecosystem: string } } } }).campaign.campaign.target.ecosystem, "go");

    const overridden = runCli([
      "start", "--id", "override", "--target", "explicit", "--version", "9.0.0",
      "--source", "local-source", "--ecosystem", "rust", "--vuln", "path-traversal",
      "--no-interactive", "--json",
    ], projectRoot);
    assert.equal(overridden.status, 0, overridden.stderr);
    assert.deepEqual(
      (JSON.parse(overridden.stdout) as { campaign: { campaign: { target: unknown } } }).campaign.campaign.target,
      { name: "explicit", version: "9.0.0", source: "local-source", ecosystem: "rust" },
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("compiled start never guesses vulnerability classes in non-interactive mode", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-start-missing-"));
  try {
    const result = runCli(["start", "--no-interactive", "--json"], projectRoot);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing required fields: vulnerability classes/i);
    assert.equal(existsSync(join(projectRoot, ".omv")), true);
    assert.equal(existsSync(join(projectRoot, ".omv", "campaigns", `${projectRoot.split("/").pop()}.yaml`)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("compiled CLI runs the SourceRef and report provenance workflow with stable JSON", async () => {
  const projectRoot = await projectWithFinding();
  try {
    const initialized = runCli(["sources", "init", "dashboard-fixture", "--json"], projectRoot);
    assert.equal(initialized.status, 0, initialized.stderr);
    const initJson = JSON.parse(initialized.stdout) as {
      sourceRef: { finding_id: string; sources: unknown[] };
      path: string;
    };
    assert.equal(initJson.sourceRef.finding_id, "dashboard-fixture");
    assert.equal(initJson.sourceRef.sources.length > 0, true);
    assert.equal(existsSync(initJson.path), true);

    const shown = runCli(["sources", "show", "dashboard-fixture", "--json"], projectRoot);
    assert.equal(shown.status, 0, shown.stderr);
    assert.equal((JSON.parse(shown.stdout) as { stale: boolean }).stale, false);

    const reportDir = join(projectRoot, ".omv", "reports", "dashboard-fixture");
    const declaredReproDir = join(projectRoot, ".omv", "repro", "demo-merge-pp");
    await mkdir(reportDir, { recursive: true });
    await mkdir(join(projectRoot, ".omv", "repro", "dashboard-fixture"), { recursive: true });
    await mkdir(declaredReproDir, { recursive: true });
    await writeFile(join(reportDir, "advisory.md"), "# Advisory\n", "utf-8");
    await writeFile(join(declaredReproDir, "commands.sh"), "node repro.js\n", "utf-8");
    await writeFile(join(declaredReproDir, "observed.txt"), "observed locally\n", "utf-8");
    const provenance = runCli(["report", "provenance", "dashboard-fixture", "--json"], projectRoot);
    assert.equal(provenance.status, 0, provenance.stderr);
    const provenanceJson = JSON.parse(provenance.stdout) as {
      manifest: { finding_id: string; inputs: unknown[] };
      path: string;
    };
    assert.equal(provenanceJson.manifest.finding_id, "dashboard-fixture");
    assert.equal(provenanceJson.manifest.inputs.length >= 3, true);
    assert.equal(existsSync(provenanceJson.path), true);

    const artifacts = runCli(["report", "artifacts", "dashboard-fixture", "--json"], projectRoot);
    assert.equal(artifacts.status, 0, artifacts.stderr);
    const artifactJson = JSON.parse(artifacts.stdout) as {
      provenanceManifestExists: boolean;
      provenanceFresh: boolean;
      reportArtifactPaths: string[];
    };
    assert.equal(artifactJson.provenanceManifestExists, true);
    assert.equal(artifactJson.provenanceFresh, true);
    assert.equal(artifactJson.reportArtifactPaths.length, 1);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

function runCli(args: string[], cwd = process.cwd(), extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", ...extraEnv },
  });
}

async function projectWithFinding(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-"));
  const findingsDir = join(projectRoot, ".omv", "findings");
  await mkdir(findingsDir, { recursive: true });
  await writeFile(
    join(findingsDir, "dashboard-fixture.yaml"),
    await readFile(evidenceFixturePath, "utf-8"),
    "utf-8",
  );
  return projectRoot;
}
