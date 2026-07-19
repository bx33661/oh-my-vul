#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function findTests(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await findTests(path));
    else if (entry.isFile() && entry.name.endsWith(".test.js")) files.push(path);
  }
  return files;
}

const tests = (await findTests(join("dist", "cli", "__tests__"))).sort();
if (tests.length === 0) {
  console.error("No compiled Node tests found. Run npm run build first.");
  process.exit(1);
}
const testEnv = { ...process.env, NO_COLOR: "1" };
delete testEnv.FORCE_COLOR;
const result = spawnSync(process.execPath, ["--test", ...tests], {
  stdio: "inherit",
  windowsHide: true,
  env: testEnv,
});
if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
