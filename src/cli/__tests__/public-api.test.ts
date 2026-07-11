import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as publicApi from "../../index.js";

interface NodeApiInventory {
  schema_version: string;
  entrypoints: string[];
  runtime_exports: string[];
  type_exports: string[];
}

const inventoryPath = new URL("../../../contracts/node-api.v1.json", import.meta.url);

test("public Node runtime exports match the 1.0 inventory", async () => {
  const inventory = await readInventory();
  assert.equal(inventory.schema_version, "1");
  assert.deepEqual(Object.keys(publicApi).sort(), [...inventory.runtime_exports].sort());
  assert.equal(new Set(inventory.runtime_exports).size, inventory.runtime_exports.length);
  assert.equal(new Set(inventory.type_exports).size, inventory.type_exports.length);
});

test("package self-reference exposes only the root API and package metadata", async () => {
  const root = await import("oh-my-vul");
  assert.deepEqual(Object.keys(root).sort(), Object.keys(publicApi).sort());

  const packageJson = await import("oh-my-vul/package.json", { with: { type: "json" } });
  assert.equal(packageJson.default.name, "oh-my-vul");

  const unsupportedDeepImport = "oh-my-vul/dist/cli/findings.js";
  await assert.rejects(
    import(unsupportedDeepImport),
    (error: NodeJS.ErrnoException) => error.code === "ERR_PACKAGE_PATH_NOT_EXPORTED",
  );
});

async function readInventory(): Promise<NodeApiInventory> {
  return JSON.parse(await readFile(inventoryPath, "utf-8")) as NodeApiInventory;
}
