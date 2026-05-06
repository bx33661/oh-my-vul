#!/usr/bin/env node
import { createInterface } from "node:readline";
import { handleMcpRequest, type McpRequest } from "./mcp.js";

console.error("omv-mcp read-only server: exposes private local .omv/ research state to trusted local clients only.");

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", (line) => {
  void handleLine(line);
});

async function handleLine(line: string): Promise<void> {
  try {
    const request = JSON.parse(line) as McpRequest;
    const response = await handleMcpRequest(request);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (err) {
    process.stdout.write(`${JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) })}\n`);
  }
}
