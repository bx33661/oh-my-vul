import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const estimateLoc = fileURLToPath(new URL("../../../shared/scripts/estimate_loc.mjs", import.meta.url));

test("cross-platform LOC fallback counts source files without Bash tools", async () => {
  const root = await mkdtemp(join(tmpdir(), "omv-loc-test-"));
  try {
    await writeFile(join(root, "index.ts"), "const one = 1;\nconst two = 2;\n", "utf-8");
    await writeFile(join(root, "README.md"), "not source\n", "utf-8");
    await mkdir(join(root, "node_modules"), { recursive: true });
    await writeFile(join(root, "node_modules", "ignored.ts"), "ignored\n", "utf-8");

    const result = spawnSync(process.execPath, [estimateLoc, root], {
      encoding: "utf-8",
      env: { ...process.env, PATH: "" },
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "2 total");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
