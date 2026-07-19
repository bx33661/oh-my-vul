import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initCampaign } from "../campaign.js";
import { seedCampaign } from "../campaign-seed.js";
import {
  proposeCardsForCampaign,
  proposeSurfaces,
  selectSurfaces,
  showSurfaces,
  loadSurfaceCatalog,
} from "../surfaces.js";
import { campaignSurfacesPath, findingsDir } from "../paths.js";

test("surface catalog proposes cards that intersect campaign vulnerability classes", async () => {
  const catalog = await loadSurfaceCatalog();
  const campaign = (await initCampaign({
    target: "Acme",
    version: "1.0",
    ecosystem: "npm",
    vulnerabilities: ["xss", "ssrf"],
  }, { projectRoot: await emptyProject() })).campaign;

  const list = proposeCardsForCampaign(campaign, catalog);
  const ids = list.cards.map((card) => card.id).sort();
  assert.ok(ids.includes("renderer-pipeline"));
  assert.ok(ids.includes("ssrf-filter"), `expected ssrf-filter in ${ids.join(",")}`);
  assert.ok(ids.includes("webhook-client") || ids.includes("media-tool"));
  assert.ok(list.cards.every((card) => card.status === "proposed"));
  assert.ok(list.cards.every((card) => card.finding_id.startsWith(`${campaign.id}-`)));
});

test("ssrf-only campaigns propose the ssrf-filter pack", async () => {
  const catalog = await loadSurfaceCatalog();
  const campaign = (
    await initCampaign(
      {
        target: "FilterLib",
        version: "1",
        ecosystem: "npm",
        vulnerabilities: ["ssrf"],
      },
      { projectRoot: await emptyProject() },
    )
  ).campaign;
  const list = proposeCardsForCampaign(campaign, catalog);
  const ids = list.cards.map((card) => card.id);
  assert.ok(ids.includes("ssrf-filter"));
  assert.ok(ids.includes("webhook-client") || ids.includes("media-tool"));
});

test("surfaces propose/select drive campaign seed finding ids", async () => {
  const projectRoot = await emptyProject();
  try {
    await initCampaign({
      target: "Widget",
      version: "2",
      ecosystem: "npm",
      vulnerabilities: ["xss", "ssrf"],
    }, { projectRoot });

    const proposed = await proposeSurfaces("widget-2", projectRoot);
    assert.equal(proposed.list.cards.length > 0, true);
    assert.match(await readFile(campaignSurfacesPath("widget-2", projectRoot), "utf-8"), /renderer-pipeline|webhook-client/);

    const shownMissingSelect = await showSurfaces("widget-2", projectRoot);
    assert.equal(shownMissingSelect.list?.cards.every((card) => card.status === "proposed"), true);

    const pick = proposed.list.cards.slice(0, 1).map((card) => card.id);
    const selected = await selectSurfaces("widget-2", pick, projectRoot);
    assert.deepEqual(selected.selected, pick);
    assert.equal(selected.list.cards.filter((card) => card.status === "selected").length, 1);

    const seeded = await seedCampaign("widget-2", projectRoot);
    assert.equal(seeded.seedMode, "surfaces");
    assert.equal(seeded.created.length, 1);
    assert.equal(seeded.created[0].id, `${"widget-2"}-${pick[0]}`);
    assert.equal(seeded.failed.length, 0);

    const files = await readFile(join(findingsDir(projectRoot), `${seeded.created[0].id}.yaml`), "utf-8");
    assert.match(files, /status: candidate/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("seed without surfaces file keeps lane mode", async () => {
  const projectRoot = await emptyProject();
  try {
    await initCampaign({
      target: "Plain",
      ecosystem: "npm",
      vulnerabilities: ["xss"],
    }, { projectRoot });
    const seeded = await seedCampaign("plain", projectRoot);
    assert.equal(seeded.seedMode, "lanes");
    assert.equal(seeded.created[0]?.id, "plain-xss");
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

async function emptyProject(): Promise<string> {
  return mkdtemp(join(tmpdir(), "omv-surfaces-"));
}
