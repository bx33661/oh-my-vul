import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { archivedFindingsDir, findingsDir, reproDir, workspaceIndexPath } from "../paths.js";
import { initWorkspace, readWorkspaceActivity, workspaceStatus } from "../workspace.js";

test("workspace init creates local state and is idempotent", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-workspace-"));

  try {
    const result = await initWorkspace(projectRoot);
    assert.equal(existsSync(findingsDir(projectRoot)), true);
    assert.equal(existsSync(reproDir(projectRoot)), true);
    assert.equal(existsSync(archivedFindingsDir(projectRoot)), true);
    assert.equal(existsSync(workspaceIndexPath(projectRoot)), true);
    assert.equal(result.activeCount, 0);
    assert.equal(result.archivedCount, 0);
    assert.equal((await readWorkspaceActivity(projectRoot))[0].action, "workspace.init");

    await writeFile(join(findingsDir(projectRoot), "demo.yaml"), "status: candidate\n", "utf-8");
    const second = await initWorkspace(projectRoot);
    assert.equal(second.activeCount, 1);
    assert.deepEqual(second.statusCounts, { candidate: 1 });
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
