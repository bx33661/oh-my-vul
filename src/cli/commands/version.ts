import { readFile } from "fs/promises";
import { readCatalog } from "../catalog.js";
import { packageRoot } from "../paths.js";
import { wantsJson } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const json = wantsJson(args);
  const pkg = JSON.parse(await readFile(`${packageRoot()}/package.json`, "utf-8")) as { name?: string; version?: string };
  const catalog = await readCatalog();
  const result = {
    package: pkg.name ?? "oh-my-vul",
    version: pkg.version ?? "",
    registryVersion: catalog.version,
    platform: catalog.platform,
    updated: catalog.updated,
  };

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`${result.package} ${result.version}`);
  console.log(`Registry: ${result.registryVersion} (${result.platform}, updated ${result.updated})`);
}
