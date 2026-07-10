import test from "node:test";
import assert from "node:assert/strict";
import {
  printCampaignDetail,
  printCampaignInitResult,
  printCampaignSeedResult,
  printCampaignSummaries,
  printReportArtifacts,
  printReproInitResult,
  printUninstallResult,
} from "../render.js";
import { buildCampaign } from "../campaign.js";

test("canonical uninstall renderer summarizes removed skills and manifest state", () => {
  const output = captureOutput(() => printUninstallResult({
    scope: "user",
    skillsDir: "/tmp/skills",
    agentsDir: "/tmp/agents",
    removed: ["omv"],
    agentsRemoved: [],
    notFound: ["omv-find"],
    errors: [],
    manifestRemoved: true,
    setupScopeRemoved: false,
  }));

  assert.match(output, /oh-my-vul uninstall/);
  assert.match(output, /1\/2 skill\(s\) removed/);
  assert.match(output, /manifest\s+removed/);
});

test("canonical repro renderer owns evidence and next-action output", () => {
  const output = captureOutput(() => printReproInitResult({
    id: "demo",
    path: "/tmp/repro/demo",
    findingPath: "/tmp/findings/demo.yaml",
    artifacts: ["/tmp/repro/demo/repro.md"],
    written: ["/tmp/repro/demo/repro.md"],
    skipped: [],
    updatedFinding: true,
  }));

  assert.match(output, /repro artifacts/);
  assert.match(output, /evidence\s+updated evidence\.repro_artifacts/);
  assert.match(output, /\/omv-repro demo/);
});

test("canonical report renderer owns artifact and reproduction summaries", () => {
  const output = captureOutput(() => printReportArtifacts({
    id: "demo",
    status: "confirmed",
    reportsDir: "/tmp/reports/demo",
    reproDir: "/tmp/repro/demo",
    reportArtifactPaths: ["/tmp/reports/demo/vuldb.md"],
    emptyReportArtifactPaths: [],
    listedReproArtifacts: ["repro.md"],
    existingReproArtifacts: ["repro.md"],
    missingReproArtifacts: [],
    errors: [],
    warnings: [],
  }));

  assert.match(output, /report files\s+1/);
  assert.match(output, /repro refs\s+1\/1/);
  assert.match(output, /vuldb\.md/);
});

test("canonical Campaign renderers own init, list, show, and seed output", () => {
  const campaign = buildCampaign(
    { id: "demo", target: "Acme", ecosystem: "npm", vulnerabilities: ["xss"] },
    () => new Date("2026-07-10T00:00:00.000Z"),
  );
  const init = captureOutput(() => printCampaignInitResult({
    campaign,
    yamlPath: "/tmp/.omv/campaigns/demo.yaml",
    runbookPath: "/tmp/.omv/campaigns/demo.md",
    overwritten: false,
    nextAction: "omv campaign seed demo",
    warnings: [],
  }));
  const list = captureOutput(() => printCampaignSummaries([{
    id: "demo",
    title: campaign.title,
    status: "active",
    target: "Acme",
    version: "unknown",
    laneCount: 1,
    nextAction: "omv campaign seed demo",
  }]));
  const detail = captureOutput(() => printCampaignDetail({
    campaign,
    yamlPath: "/tmp/.omv/campaigns/demo.yaml",
    runbookPath: "/tmp/.omv/campaigns/demo.md",
    runbookExists: true,
    nextAction: "omv campaign seed demo",
  }));
  const seed = captureOutput(() => printCampaignSeedResult({
    campaignId: "demo",
    campaignPath: "/tmp/.omv/campaigns/demo.yaml",
    created: [{ id: "demo-xss", path: "/tmp/.omv/findings/demo-xss.yaml", status: "candidate", created: true }],
    skipped: [],
    failed: [],
    nextAction: "omv findings workflow",
  }));

  assert.match(init, /campaign created/i);
  assert.match(init, /demo\.yaml/);
  assert.match(list, /lanes/i);
  assert.match(list, /Acme/);
  assert.match(detail, /demo-xss|xss/);
  assert.match(seed, /created\s+1/);
  assert.match(seed, /omv findings workflow/);
});

function captureOutput(render: () => void): string {
  const originalLog = console.log;
  const lines: string[] = [];
  console.log = (...values: unknown[]) => {
    lines.push(values.map(String).join(" "));
  };
  try {
    render();
  } finally {
    console.log = originalLog;
  }
  return lines.join("\n");
}
