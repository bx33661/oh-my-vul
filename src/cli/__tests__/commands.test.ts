import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const cliPath = fileURLToPath(new URL("../omv.js", import.meta.url));
const evidenceFixturePath = fileURLToPath(
  new URL("../../../skills/omv-report/evals/fixtures/confirmed-prototype-pollution.yaml", import.meta.url),
);
const packageJsonPath = fileURLToPath(new URL("../../../package.json", import.meta.url));

test("compiled CLI entrypoint emits complete version JSON", async () => {
  const result = runCli(["version", "--json"]);
  const pkg = JSON.parse(await readFile(packageJsonPath, "utf-8")) as { version: string };

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  const output = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(output.package, "oh-my-vul");
  assert.equal(output.version, pkg.version);
  assert.equal(typeof output.registryVersion, "string");
  assert.equal(typeof output.platform, "string");
});

test("compiled CLI renders help through the command router", () => {
  const result = runCli(["--help"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /oh-my-vul/);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /omv findings workflow/);
});

test("compiled CLI rejects an unknown command with actionable text and a non-zero exit", () => {
  const result = runCli(["not-a-command"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown command: not-a-command/);
  assert.match(result.stderr, /Valid commands:/);
  assert.match(result.stdout, /Usage:/);
});

test("dashboard human output uses the canonical workflow columns", async () => {
  const projectRoot = await projectWithFinding();

  try {
    const result = runCli(["dashboard"], projectRoot);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\bverdict\b/);
    assert.match(result.stdout, /\bblocker\b/);
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
      workflow?: unknown[];
      activity?: unknown[];
    };
    assert.equal(output.status?.root, await realpath(join(projectRoot, ".omv")));
    assert.equal(output.status?.activeCount, 1);
    assert.equal(Array.isArray(output.workflow), true);
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

    const listed = runCli(["campaign", "--json"], projectRoot);
    assert.equal(listed.status, 0, listed.stderr);
    assert.deepEqual((JSON.parse(listed.stdout) as Array<{ id: string }>).map((item) => item.id), ["demo"]);

    const shown = runCli(["first", "show", "demo", "--json"], projectRoot);
    assert.equal(shown.status, 0, shown.stderr);
    assert.equal((JSON.parse(shown.stdout) as { campaign: { id: string } }).campaign.id, "demo");

    const seeded = runCli(["campaign", "seed", "demo", "--json"], projectRoot);
    assert.equal(seeded.status, 0, seeded.stderr);
    assert.deepEqual((JSON.parse(seeded.stdout) as { created: Array<{ id: string }> }).created.map((item) => item.id), [
      "demo-xss", "demo-auth",
    ]);
    const repeated = runCli(["first", "seed", "demo", "--json"], projectRoot);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal((JSON.parse(repeated.stdout) as { skipped: unknown[] }).skipped.length, 2);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("compiled first alias initializes and JSON never prompts for missing values", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-commands-campaign-"));
  try {
    const alias = runCli([
      "first", "--id", "alias", "--target", "Alias", "--ecosystem", "npm",
      "--vuln", "xss", "--no-interactive", "--json",
    ], projectRoot);
    assert.equal(alias.status, 0, alias.stderr);
    assert.equal((JSON.parse(alias.stdout) as { campaign: { id: string } }).campaign.id, "alias");

    const missing = runCli(["first", "--json"], projectRoot);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /missing required fields/i);
    assert.doesNotMatch(missing.stdout, /Target:|Vulnerability classes/);
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

function runCli(args: string[], cwd = process.cwd()) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1" },
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
