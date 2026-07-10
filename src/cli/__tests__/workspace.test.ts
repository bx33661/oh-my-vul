import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  archivedFindingsDir,
  campaignPath,
  campaignRunbookPath,
  campaignsDir,
  findingsDir,
  reproDir,
  sourceRefPath,
  sourcesDir,
  workspaceIndexPath,
} from "../paths.js";
import {
  initWorkspace,
  readWorkspaceActivity,
  workspaceStatus,
} from "../workspace.js";

test("workspace init creates local state and is idempotent", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    const result = await initWorkspace(projectRoot);
    assert.equal(existsSync(findingsDir(projectRoot)), true);
    assert.equal(existsSync(campaignsDir(projectRoot)), true);
    assert.equal(existsSync(sourcesDir(projectRoot)), true);
    assert.equal(existsSync(reproDir(projectRoot)), true);
    assert.equal(existsSync(archivedFindingsDir(projectRoot)), true);
    assert.equal(existsSync(workspaceIndexPath(projectRoot)), true);
    assert.equal(
      campaignPath("demo", projectRoot),
      join(projectRoot, ".omv", "campaigns", "demo.yaml"),
    );
    assert.equal(
      campaignRunbookPath("demo", projectRoot),
      join(projectRoot, ".omv", "campaigns", "demo.md"),
    );
    assert.equal(
      sourceRefPath("demo", projectRoot),
      join(projectRoot, ".omv", "sources", "demo.yaml"),
    );
    assert.equal(result.activeCount, 0);
    assert.equal(result.archivedCount, 0);
    assert.equal((await readWorkspaceActivity(projectRoot))[0].action, "workspace.init");

    const campaignId = "campaign-only";
    const yamlPath = campaignPath(campaignId, projectRoot);
    const runbookPath = campaignRunbookPath(campaignId, projectRoot);
    const campaignYaml = Buffer.from('schema_version: "1"\r\nid: campaign-only\r\n');
    const campaignRunbook = Buffer.from("# Campaign only\r\n\r\nPreserve these bytes.\r\n");
    await writeFile(yamlPath, campaignYaml);
    await writeFile(runbookPath, campaignRunbook);
    const sourcePath = sourceRefPath("demo", projectRoot);
    const sourceBytes = Buffer.from('schema_version: "1"\r\nfinding_id: demo\r\n');
    await writeFile(sourcePath, sourceBytes);
    await writeFile(join(findingsDir(projectRoot), "demo.yaml"), "status: candidate\n", "utf-8");
    const second = await initWorkspace(projectRoot);
    assert.deepEqual(await readFile(yamlPath), campaignYaml);
    assert.deepEqual(await readFile(runbookPath), campaignRunbook);
    assert.deepEqual(await readFile(sourcePath), sourceBytes);
    assert.equal(second.activeCount, 1);
    assert.deepEqual(second.statusCounts, { candidate: 1 });

    const index = JSON.parse(await readFile(workspaceIndexPath(projectRoot), "utf-8")) as {
      findings: Array<{ id: string }>;
    };
    assert.deepEqual(Object.keys(index).sort(), ["findings", "generatedAt", "version"]);
    assert.equal(index.findings.some((entry) => entry.id === campaignId), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workspace status rebuilds stale index and reports gitignore privacy warning", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    await initWorkspace(projectRoot);
    await writeFile(join(findingsDir(projectRoot), "demo.yaml"), "status: confirmed\n", "utf-8");

    const stale = await workspaceStatus(projectRoot);
    assert.equal(stale.staleIndex, true);
    assert.equal(stale.activeCount, 1);
    assert.deepEqual(stale.statusCounts, { confirmed: 1 });
    assert.match(stale.warnings.join("\n"), /\.omv\//);

    await writeFile(join(projectRoot, ".gitignore"), ".omv/\n", "utf-8");
    const ignored = await workspaceStatus(projectRoot);
    assert.deepEqual(ignored.warnings, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workspace init advises ignoring private state without mutating gitignore", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    const result = await initWorkspace(projectRoot);

    assert.equal(existsSync(join(projectRoot, ".gitignore")), false);
    assert.match(result.warnings.join("\n"), /\.omv\//);
    assert.doesNotMatch(result.warnings.join("\n"), /Keep tracked|\.omv\/findings\//);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workspace init --gitignore creates a missing gitignore", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    const result = await initWorkspace(projectRoot, { gitignore: true });

    assert.equal(await readFile(join(projectRoot, ".gitignore"), "utf-8"), ".omv/\n");
    assert.equal(result.warnings.some((warning) => warning.includes("add .omv/")), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workspace init --gitignore appends the private directory idempotently", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    const gitignorePath = join(projectRoot, ".gitignore");
    await writeFile(gitignorePath, "node_modules/", "utf-8");

    const first = await initWorkspace(projectRoot, { gitignore: true });
    const second = await initWorkspace(projectRoot, { gitignore: true });

    assert.equal(await readFile(gitignorePath, "utf-8"), "node_modules/\n.omv/\n");
    assert.equal(first.warnings.some((warning) => warning.includes("add .omv/")), false);
    assert.equal(second.warnings.some((warning) => warning.includes("add .omv/")), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("workspace init --gitignore preserves an equivalent rooted ignore entry", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    const gitignorePath = join(projectRoot, ".gitignore");
    const original = "node_modules/\n/.omv/\n";
    await writeFile(gitignorePath, original, "utf-8");

    const result = await initWorkspace(projectRoot, { gitignore: true });

    assert.equal(await readFile(gitignorePath, "utf-8"), original);
    assert.deepEqual(result.warnings, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
