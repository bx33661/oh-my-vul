import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { initCampaign } from "../campaign.js";
import { seedCampaign } from "../campaign-seed.js";
import { createFindingTemplate, validateFinding } from "../findings.js";
import {
  findingReportsDir,
  findingReproDir,
  findingsDir,
  threatMapPath,
  verificationPath,
} from "../paths.js";

const fixedNow = (): Date => new Date("2026-07-10T00:00:00.000Z");

test("campaign seed values create a conservative valid candidate Evidence template", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-seed-"));
  try {
    const result = await createFindingTemplate("demo-xss", {
      projectRoot,
      seed: {
        researcherGoal: "triage",
        product: "Acme",
        ecosystem: "npm",
        vulnerabilityClass: "xss",
      },
    });
    const data = parseYaml(await readFile(result.path, "utf-8")) as Record<string, any>;

    assert.equal(data.status, "candidate");
    assert.equal(data.researcher_goal, "triage");
    assert.equal(data.package.product, "Acme");
    assert.equal(data.package.ecosystem, "npm");
    assert.equal(data.package.registry_name, "");
    assert.equal(data.versions.tested, "unknown");
    assert.equal(data.vulnerability.class, "xss");
    for (const field of ["source", "sink", "guard", "reproducer", "observed_result"]) {
      assert.equal(data.evidence[field], "unknown");
      assert.ok(data.provenance.unverified_fields.includes(`evidence.${field}`));
    }
    assert.ok(data.provenance.unverified_fields.includes("versions.tested"));
    assert.equal("campaign_id" in data, false);
    assert.equal((await validateFinding("demo-xss", projectRoot)).ok, true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign seed creates one candidate per lane and no proof sidecars", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-seed-"));
  try {
    await initCampaign(
      { id: "demo", target: "Acme", ecosystem: "npm", output: "cve", vulnerabilities: ["xss", "auth"] },
      { projectRoot, now: fixedNow },
    );
    const result = await seedCampaign("demo", projectRoot);

    assert.deepEqual(result.created.map((item) => item.id), ["demo-xss", "demo-auth"]);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.failed, []);
    for (const id of ["demo-xss", "demo-auth"]) {
      const evidence = parseYaml(await readFile(join(findingsDir(projectRoot), `${id}.yaml`), "utf-8")) as Record<string, any>;
      assert.equal(evidence.researcher_goal, "CVE");
      assert.equal(evidence.status, "candidate");
      assert.equal(evidence.versions.tested, "unknown");
      assert.equal("campaign_id" in evidence, false);
      assert.equal(existsSync(threatMapPath(id, projectRoot)), false);
      assert.equal(existsSync(findingReproDir(id, projectRoot)), false);
      assert.equal(existsSync(verificationPath(id, projectRoot)), false);
      assert.equal(existsSync(findingReportsDir(id, projectRoot)), false);
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign seed preserves existing YAML and YML findings byte-for-byte", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-seed-"));
  try {
    await initCampaign(
      { id: "demo", target: "Acme", ecosystem: "npm", vulnerabilities: ["xss", "auth"] },
      { projectRoot, now: fixedNow },
    );
    await mkdir(findingsDir(projectRoot), { recursive: true });
    const yamlPath = join(findingsDir(projectRoot), "demo-xss.yaml");
    const ymlPath = join(findingsDir(projectRoot), "demo-auth.yml");
    const yamlBytes = Buffer.from("preserve yaml\r\n");
    const ymlBytes = Buffer.from("preserve yml\r\n");
    await writeFile(yamlPath, yamlBytes);
    await writeFile(ymlPath, ymlBytes);

    const result = await seedCampaign("demo", projectRoot);
    assert.deepEqual(result.created, []);
    assert.deepEqual(result.skipped.map((item) => item.id), ["demo-xss", "demo-auth"]);
    assert.deepEqual(await readFile(yamlPath), yamlBytes);
    assert.deepEqual(await readFile(ymlPath), ymlBytes);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign seed rejects unknown ecosystems before creating findings", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-seed-"));
  try {
    await initCampaign(
      { id: "demo", target: "Acme", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    await assert.rejects(() => seedCampaign("demo", projectRoot), /ecosystem.*supported/i);
    assert.equal(existsSync(join(findingsDir(projectRoot), "demo-xss.yaml")), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign seed reports partial failures and remains idempotent on retry", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-seed-"));
  try {
    await initCampaign(
      { id: "demo", target: "Acme", ecosystem: "npm", vulnerabilities: ["xss", "auth"] },
      { projectRoot, now: fixedNow },
    );
    const partial = await seedCampaign("demo", projectRoot, {
      createFinding: async (id, options) => {
        if (id === "demo-auth") {
          throw new Error("injected write failure");
        }
        return createFindingTemplate(id, options);
      },
    });
    assert.deepEqual(partial.created.map((item) => item.id), ["demo-xss"]);
    assert.deepEqual(partial.failed, [{ id: "demo-auth", message: "injected write failure" }]);

    const retried = await seedCampaign("demo", projectRoot);
    assert.deepEqual(retried.skipped.map((item) => item.id), ["demo-xss"]);
    assert.deepEqual(retried.created.map((item) => item.id), ["demo-auth"]);
    assert.deepEqual(retried.failed, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});
