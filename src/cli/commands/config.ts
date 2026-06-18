import { configGet, configList, configSet, configUnset } from "../config.js";
import { configUsage } from "../usage.js";
import { firstPositionalAfter } from "./shared.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "list";
  switch (subcommand) {
    case "get": {
      const key = firstPositionalAfter(args, "get");
      if (!key) {
        console.error("Missing config key.");
        process.exit(1);
      }
      const value = await configGet(key);
      if (value === undefined) {
        console.error(`Config key "${key}" is not set.`);
        process.exit(1);
      }
      console.log(`${key}=${value}`);
      return;
    }
    case "set": {
      const key = firstPositionalAfter(args, "set");
      const value = firstPositionalAfter(args, key ?? "");
      if (!key || !value) {
        console.error("Usage: omv config set <key> <value>");
        process.exit(1);
      }
      await configSet(key, value);
      console.log(`${key}=${value}`);
      return;
    }
    case "unset": {
      const key = firstPositionalAfter(args, "unset");
      if (!key) {
        console.error("Missing config key.");
        process.exit(1);
      }
      await configUnset(key);
      console.log(`${key} unset`);
      return;
    }
    case "list": {
      const entries = await configList();
      const keys = Object.keys(entries);
      if (keys.length === 0) {
        console.log("No config values set.");
        return;
      }
      for (const key of keys.sort()) {
        console.log(`${key}=${entries[key]}`);
      }
      return;
    }
    default:
      console.error(`Unknown config command: ${subcommand}\n`);
      configUsage(undefined);
      process.exit(1);
  }
}
