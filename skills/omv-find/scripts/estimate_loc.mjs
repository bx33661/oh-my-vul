#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

const target = process.argv[2];
if (!target || process.argv.length !== 3) {
  console.error("usage: node scripts/estimate_loc.mjs <github-url-or-local-path>");
  process.exit(2);
}

const excludedDirs = new Set([".git", "node_modules", "vendor", "target", "dist", "build"]);
const sourceExtensions = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs", ".java", ".rb", ".php",
  ".cs", ".swift", ".dart", ".ex", ".exs", ".pl", ".pm", ".r", ".lua",
]);
let workdir;

try {
  let scanDir = target;
  if (/^(?:https?:\/\/|git@)/i.test(target)) {
    workdir = await mkdtemp(join(tmpdir(), "omv-loc-"));
    scanDir = join(workdir, "repo");
    runRequired("git", ["clone", "--depth", "1", "--quiet", target, scanDir]);
  }

  let externalToolUsed = false;
  for (const tool of ["tokei", "cloc"]) {
    const result = spawnSync(tool, [scanDir], { stdio: "inherit", windowsHide: true });
    if (result.error) continue;
    if (result.status !== 0) throw new Error(`${tool} exited with status ${result.status}`);
    externalToolUsed = true;
    break;
  }

  if (!externalToolUsed) {
    const files = await sourceFiles(scanDir);
    let lines = 0;
    for (const file of files) lines += countLines(await readFile(file));
    console.log(`${lines} total`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (workdir) await rm(workdir, { recursive: true, force: true });
}

function runRequired(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", windowsHide: true });
  if (result.error) throw new Error(`Unable to start ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with status ${result.status}`);
}

async function sourceFiles(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && sourceExtensions.has(extname(entry.name).toLowerCase())) files.push(path);
  }
  return files;
}

function countLines(content) {
  if (content.length === 0) return 0;
  let lines = content[content.length - 1] === 10 ? 0 : 1;
  for (const byte of content) if (byte === 10) lines += 1;
  return lines;
}
