import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPublicJsonContracts,
  validatePublicJsonResult,
  type PublicJsonCommandContract,
} from "./helpers/public-contracts.js";
import { PUBLIC_JSON_COMMANDS, SKILL_MANAGED_COMMANDS } from "../usage.js";

const cliPath = fileURLToPath(new URL("../omv.js", import.meta.url));
const findingFixture = fileURLToPath(
  new URL("../../../skills/omv-report/evals/fixtures/confirmed-prototype-pollution.yaml", import.meta.url),
);
const radarFixture = fileURLToPath(new URL("../../../contracts/fixtures/radar-watchlist.yaml", import.meta.url));

test("public JSON inventory is unique, complete, and excludes Skill-managed primitives", async () => {
  const inventory = await loadPublicJsonContracts();
  const commands = inventory.commands.map((entry) => entry.command);
  assert.equal(inventory.schema_version, "1");
  assert.deepEqual(commands, [...PUBLIC_JSON_COMMANDS]);
  assert.equal(new Set(commands).size, commands.length);
  assert.equal(inventory.compatibility.additive_fields, true);
  assert.equal(inventory.compatibility.one_document, true);
  for (const primitive of SKILL_MANAGED_COMMANDS) {
    assert.equal(commands.some((command: string) => command === String(primitive) || command.startsWith(`${primitive} `)), false, primitive);
  }
  for (const entry of inventory.commands) {
    assert.match(entry.exit_behavior, /0|non-zero|1/);
    assert.deepEqual(validatePublicJsonResult(entry, sampleFor(entry)), []);
  }
});

test("every public JSON command family emits one compatible document", async () => {
  const inventory = await loadPublicJsonContracts();
  const contracts = new Map(inventory.commands.map((entry) => [entry.command, entry]));
  const covered = new Set<string>();
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-public-json-"));
  const home = await mkdtemp(join(tmpdir(), "omv-public-json-home-"));
  const env = { HOME: home, USERPROFILE: home, CODEX_HOME: join(home, ".codex") };

  const capture = (command: string, args: string[], cwd = projectRoot, extraEnv: Record<string, string> = {}) => {
    const result = runCli(args, cwd, extraEnv);
    assert.ok(result.status === 0 || result.status === 1, `${command}: ${result.stderr}`);
    assert.notEqual(result.stdout.trim(), "", `${command}: expected JSON stdout`);
    const value = JSON.parse(result.stdout) as unknown;
    const contract = contracts.get(command);
    assert.ok(contract, `missing contract for ${command}`);
    assert.deepEqual(validatePublicJsonResult(contract, value), [], command);
    covered.add(command);
    return value;
  };

  try {
    await mkdir(env.CODEX_HOME, { recursive: true });
    capture("version", ["version", "--json"]);
    const setupResult = capture(
      "setup",
      ["setup", "--scope", "user", "--platform", "codex", "--json"],
      projectRoot,
      env,
    ) as { verification?: { ok?: boolean }; nextAction?: string };
    assert.equal(setupResult.verification?.ok, true);
    assert.equal(setupResult.nextAction, "Restart Codex, then invoke $omv");
    capture("doctor", ["doctor", "--scope", "user", "--platform", "codex", "--json"], projectRoot, env);

    capture("start", [
      "start", "--id", "guided", "--target", "Guided", "--ecosystem", "npm",
      "--vuln", "xss", "--no-interactive", "--json",
    ]);
    capture("campaign init", [
      "campaign", "init", "--id", "demo", "--target", "Acme", "--ecosystem", "npm",
      "--vuln", "auth", "--no-interactive", "--json",
    ]);
    capture("campaign list", ["campaign", "list", "--json"]);
    capture("campaign show", ["campaign", "show", "demo", "--json"]);

    const findingsDir = join(projectRoot, ".omv", "findings");
    await mkdir(findingsDir, { recursive: true });
    await copyFile(findingFixture, join(findingsDir, "confirmed-fixture.yaml"));
    capture("findings init", ["findings", "init", "scratch", "--json"]);
    capture("findings list", ["findings", "list", "--json"]);
    capture("findings show", ["findings", "show", "confirmed-fixture", "--json"]);
    capture("findings validate <id>", ["findings", "validate", "scratch", "--json"]);
    capture("findings validate", ["findings", "validate", "--json"]);
    capture("findings promote", ["findings", "promote", "scratch", "--status", "candidate", "--json"]);
    capture("review", ["review", "confirmed-fixture", "--json"]);
    capture("dedup", ["dedup", "confirmed-fixture", "--json"]);
    capture("disclose timeline", ["disclose", "timeline", "confirmed-fixture", "--days", "45", "--json"]);
    capture("submissions record", [
      "submissions", "record", "confirmed-fixture", "--platform", "vuldb",
      "--submission-id", "123", "--url", "https://example.test/123", "--json",
    ]);
    capture("submissions track", ["submissions", "track", "confirmed-fixture", "--json"]);
    capture("submissions close", ["submissions", "close", "confirmed-fixture", "--cve", "CVE-2026-12345", "--json"]);

    capture("findings archive", ["findings", "archive", "scratch", "--reason", "inactive", "--json"]);
    capture("findings archive list", ["findings", "archive", "list", "--json"]);
    capture("findings restore", ["findings", "restore", "scratch", "--json"]);
    capture("workspace status", ["workspace", "status", "--json"]);
    capture("workspace log", ["workspace", "log", "--json"]);
    capture("dashboard", ["dashboard", "--json"]);

    const radarDir = join(projectRoot, ".omv", "radar");
    await mkdir(radarDir, { recursive: true });
    await copyFile(radarFixture, join(radarDir, "watchlist.yaml"));
    capture("radar refresh", ["radar", "refresh", "--json"]);
    capture("radar brief", ["radar", "brief", "--json"]);

    capture("uninstall", ["uninstall", "--scope", "user", "--platform", "codex", "--json"], projectRoot, env);
    assert.deepEqual([...covered].sort(), [...contracts.keys()].sort());
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  }
});

test("invalid public JSON invocations do not emit partial success documents", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-public-json-invalid-"));
  try {
    for (const args of [
      ["campaign", "show", "missing", "--json"],
      ["findings", "show", "missing", "--json"],
      ["disclose", "timeline", "demo", "--days", "0", "--json"],
    ]) {
      const result = runCli(args, projectRoot);
      assert.equal(result.status, 1, args.join(" "));
      assert.equal(result.stdout, "", args.join(" "));
      assert.notEqual(result.stderr, "", args.join(" "));
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

function runCli(args: string[], cwd: string, extraEnv: Record<string, string> = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", ...extraEnv },
  });
}

function sampleFor(contract: PublicJsonCommandContract): unknown {
  if (contract.result_kind === "array") {
    return contract.item_required ? [objectFor(contract.item_required)] : [];
  }
  return objectFor(contract.required);
}

function objectFor(fields: Record<string, string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([name, type]) => [name, valueFor(type)]));
}

function valueFor(type: string): unknown {
  switch (type) {
    case "array": return [];
    case "boolean": return false;
    case "null": return null;
    case "number": return 0;
    case "object": return {};
    case "string": return "value";
    default: throw new Error(`unsupported JSON type ${type}`);
  }
}
