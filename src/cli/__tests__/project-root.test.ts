import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectRootIfInsideOmvState, resolveProjectRoot } from "../paths.js";
import { extractProjectRootOption } from "../commands/index.js";

test("projectRootIfInsideOmvState maps checkouts back to the owner project", () => {
  const root = "/tmp/research-root";
  assert.equal(
    projectRootIfInsideOmvState(join(root, ".omv", "checkouts", "pkg")),
    root,
  );
  assert.equal(
    projectRootIfInsideOmvState(join(root, ".omv", "findings")),
    root,
  );
  assert.equal(projectRootIfInsideOmvState(root), undefined);
  assert.equal(projectRootIfInsideOmvState(join(root, "src")), undefined);
});

test("resolveProjectRoot prefers OMV_PROJECT_ROOT over walk-up", async () => {
  const outer = await mkdtemp(join(tmpdir(), "omv-root-outer-"));
  const inner = await mkdtemp(join(tmpdir(), "omv-root-inner-"));
  try {
    await mkdir(join(outer, ".omv"), { recursive: true });
    await mkdir(join(inner, ".omv"), { recursive: true });
    const previous = process.env.OMV_PROJECT_ROOT;
    process.env.OMV_PROJECT_ROOT = inner;
    try {
      assert.equal(resolveProjectRoot(outer), inner);
    } finally {
      if (previous === undefined) {
        delete process.env.OMV_PROJECT_ROOT;
      } else {
        process.env.OMV_PROJECT_ROOT = previous;
      }
    }
  } finally {
    await rm(outer, { recursive: true, force: true });
    await rm(inner, { recursive: true, force: true });
  }
});

test("resolveProjectRoot walks up to nearest .omv owner from a subdirectory", async () => {
  const project = await mkdtemp(join(tmpdir(), "omv-root-walk-"));
  try {
    await mkdir(join(project, ".omv", "findings"), { recursive: true });
    await writeFile(join(project, ".omv", "index.json"), "{\"version\":1,\"findings\":[]}\n", "utf-8");
    const nested = join(project, "src", "cli");
    await mkdir(nested, { recursive: true });
    const previous = process.env.OMV_PROJECT_ROOT;
    delete process.env.OMV_PROJECT_ROOT;
    delete process.env.OMV_ROOT;
    try {
      assert.equal(resolveProjectRoot(nested), project);
    } finally {
      if (previous !== undefined) {
        process.env.OMV_PROJECT_ROOT = previous;
      }
    }
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("resolveProjectRoot does not create nested workspaces under .omv/checkouts", async () => {
  const project = await mkdtemp(join(tmpdir(), "omv-root-checkout-"));
  try {
    const checkout = join(project, ".omv", "checkouts", "sanitize-url");
    await mkdir(checkout, { recursive: true });
    await mkdir(join(project, ".omv", "findings"), { recursive: true });
    // Accidental nested workspace under the checkout must not win.
    await mkdir(join(checkout, ".omv", "findings"), { recursive: true });
    const previous = process.env.OMV_PROJECT_ROOT;
    delete process.env.OMV_PROJECT_ROOT;
    delete process.env.OMV_ROOT;
    try {
      assert.equal(resolveProjectRoot(checkout), project);
    } finally {
      if (previous !== undefined) {
        process.env.OMV_PROJECT_ROOT = previous;
      }
    }
  } finally {
    await rm(project, { recursive: true, force: true });
  }
});

test("extractProjectRootOption strips --root forms", () => {
  assert.deepEqual(extractProjectRootOption(["--root", "/tmp/ws", "dashboard", "--json"]), {
    args: ["dashboard", "--json"],
    root: "/tmp/ws",
  });
  assert.deepEqual(extractProjectRootOption(["findings", "list", "--root=/tmp/ws"]), {
    args: ["findings", "list"],
    root: "/tmp/ws",
  });
  assert.equal(extractProjectRootOption(["--root"]).error, "--root requires a directory path");
});
