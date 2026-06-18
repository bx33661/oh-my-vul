#!/usr/bin/env node
import { run } from "./commands/index.js";

run().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
