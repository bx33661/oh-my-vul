import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { stringify as stringifyYaml } from "yaml";
import {
  CAMPAIGN_DEPTHS,
  CAMPAIGN_ECOSYSTEMS,
  CAMPAIGN_LOCAL_REPRODUCTIONS,
  CAMPAIGN_MODES,
  CAMPAIGN_OUTPUTS,
  buildCampaign,
  initCampaign,
  listCampaigns,
  normalizeCampaignId,
  normalizeVulnerabilityClasses,
  parseCampaignYaml,
  renderCampaignRunbook,
  resolveCampaignInput,
  showCampaign,
  validateCampaign,
  type Campaign,
  type CampaignPromptAdapter,
} from "../campaign.js";
import { ReadlineCampaignPrompt } from "../campaign-prompt.js";
import {
  campaignPath,
  campaignRunbookPath,
  campaignsDir,
  workspaceActivityLogPath,
  workspaceIndexPath,
} from "../paths.js";
import { initWorkspace, readWorkspaceActivity } from "../workspace.js";

const FIXED_ISO = "2026-07-10T00:00:00.000Z";
const fixedNow = (): Date => new Date(FIXED_ISO);

class RecordingCampaignPrompt implements CampaignPromptAdapter {
  readonly calls: string[] = [];
  closeCalls = 0;

  constructor(
    private readonly targetAnswer: string,
    private readonly vulnerabilityAnswer: string,
  ) {}

  async askTarget(): Promise<string> {
    this.calls.push("target");
    return this.targetAnswer;
  }

  async askVulnerabilities(): Promise<string> {
    this.calls.push("vulnerabilities");
    return this.vulnerabilityAnswer;
  }

  close(): void {
    this.closeCalls += 1;
  }
}

function closeCampaignPrompt(prompt: CampaignPromptAdapter): void {
  prompt.close();
}

function validCampaign(): Campaign {
  return buildCampaign(
    {
      target: "Acme",
      version: "1.2",
      vulnerabilities: ["xss", "auth-z"],
    },
    fixedNow,
  );
}

test("Campaign construction normalizes input and applies the complete safe shape", () => {
  const campaign = buildCampaign(
    {
      target: " Acme ",
      version: " 1.2 ",
      vulnerabilities: [" XSS ", "auth z", "xss"],
    },
    fixedNow,
  );

  assert.deepEqual(campaign, {
    schema_version: "1",
    id: "acme-1-2",
    title: "Acme 1.2 research campaign",
    status: "active",
    profile: "generic",
    created_at: FIXED_ISO,
    updated_at: FIXED_ISO,
    target: {
      name: "Acme",
      version: "1.2",
      source: "unknown",
      ecosystem: "unknown",
    },
    scope: {
      mode: "passive",
      local_reproduction: "unknown",
      boundaries: [
        "local or explicitly authorized assets only",
        "no live third-party testing",
        "no automatic exploitation",
      ],
    },
    goal: { output: "research-notes" },
    budget: { depth: "standard" },
    priorities: { vulnerability_classes: ["xss", "auth-z"] },
    lanes: [
      {
        id: "xss",
        title: "Review xss hypotheses",
        vulnerability_class: "xss",
        finding_id: "acme-1-2-xss",
      },
      {
        id: "auth-z",
        title: "Review auth-z hypotheses",
        vulnerability_class: "auth-z",
        finding_id: "acme-1-2-auth-z",
      },
    ],
  });
});

test("Campaign construction exports the documented enum values", () => {
  assert.deepEqual(CAMPAIGN_MODES, ["whitebox", "graybox", "local-lab", "passive", "mixed"]);
  assert.deepEqual(CAMPAIGN_OUTPUTS, [
    "course-report",
    "cve",
    "vuldb",
    "internal-report",
    "research-notes",
  ]);
  assert.deepEqual(CAMPAIGN_DEPTHS, ["quick", "standard", "deep"]);
  assert.deepEqual(CAMPAIGN_LOCAL_REPRODUCTIONS, ["yes", "no", "unknown"]);
  assert.deepEqual(CAMPAIGN_ECOSYSTEMS, [
    "unknown",
    "npm",
    "python",
    "go",
    "rust",
    "java",
    "ruby",
    "php",
    "csharp",
    "swift",
    "dart",
    "elixir",
    "perl",
    "r",
    "lua",
  ]);
});

test("Campaign construction omits omitted and explicit unknown versions from generated identity", () => {
  const omitted = buildCampaign({ target: " Acme ", vulnerabilities: ["XSS"] }, fixedNow);
  const explicit = buildCampaign(
    {
      target: " Acme ",
      version: " UNKNOWN ",
      source: " Unknown ",
      ecosystem: " UNKNOWN ",
      vulnerabilities: ["XSS"],
    },
    fixedNow,
  );

  assert.equal(omitted.id, "acme");
  assert.equal(omitted.title, "Acme research campaign");
  assert.equal(explicit.id, "acme");
  assert.equal(explicit.title, "Acme research campaign");
  assert.deepEqual(explicit.target, {
    name: "Acme",
    version: "unknown",
    source: "unknown",
    ecosystem: "unknown",
  });
});

test("Campaign construction never silently omits a known version that cannot form an ASCII id segment", () => {
  assert.throws(
    () => buildCampaign({ target: "Acme", version: "\u5b89\u5168", vulnerabilities: ["xss"] }, fixedNow),
    /version.*ASCII/i,
  );
});

test("Campaign construction accepts non-ASCII target facts when a safe explicit id avoids derivation", () => {
  const campaign = buildCampaign(
    { id: "explicit-id", target: "\u9879\u76ee", version: "\u5b89\u5168", vulnerabilities: ["xss"] },
    fixedNow,
  );
  assert.equal(campaign.id, "explicit-id");
  assert.equal(campaign.target.name, "\u9879\u76ee");
  assert.equal(campaign.target.version, "\u5b89\u5168");
});

test("Campaign construction normalizes and deduplicates lowercase ASCII class slugs", () => {
  assert.deepEqual(
    normalizeVulnerabilityClasses([" Auth Z ", "auth_z", "AUTH--Z", "CWE.79"]),
    ["auth-z", "cwe-79"],
  );
  assert.throws(() => normalizeVulnerabilityClasses(["  ", "---", "\u5b89\u5168"]), /vulnerability/i);
});

test("Campaign construction trims safe explicit ids but never repairs unsafe ids", () => {
  assert.equal(normalizeCampaignId(" Demo_1.2 "), "Demo_1.2");
  assert.equal(
    buildCampaign({ id: " Demo_1.2 ", target: "Acme", vulnerabilities: ["xss"] }, fixedNow).id,
    "Demo_1.2",
  );
  assert.throws(
    () => buildCampaign({ id: "../demo", target: "Acme", vulnerabilities: ["xss"] }, fixedNow),
    /campaign id.*letters, numbers, dots, underscores, or hyphens/i,
  );
});

test("Campaign construction requires target and usable vulnerability classes", () => {
  assert.throws(() => buildCampaign({ vulnerabilities: ["xss"] }, fixedNow), /target.*required/i);
  assert.throws(() => buildCampaign({ target: "   ", vulnerabilities: ["xss"] }, fixedNow), /target.*required/i);
  assert.throws(() => buildCampaign({ target: "Acme", vulnerabilities: [] }, fixedNow), /vulnerability/i);
  assert.throws(
    () => buildCampaign({ target: "Acme", vulnerabilities: ["---", "\u5b89\u5168"] }, fixedNow),
    /vulnerability/i,
  );
});

test("Campaign construction rejects unsupported enum input before returning a campaign", () => {
  const base = { target: "Acme", vulnerabilities: ["xss"] };
  assert.throws(() => buildCampaign({ ...base, mode: "active" as never }, fixedNow), /scope\.mode/);
  assert.throws(() => buildCampaign({ ...base, output: "pdf" as never }, fixedNow), /goal\.output/);
  assert.throws(() => buildCampaign({ ...base, depth: "unbounded" as never }, fixedNow), /budget\.depth/);
  assert.throws(
    () => buildCampaign({ ...base, localReproduction: "maybe" as never }, fixedNow),
    /scope\.local_reproduction/,
  );
  assert.throws(() => buildCampaign({ ...base, ecosystem: "other" }, fixedNow), /target\.ecosystem/);
});

test("Campaign construction has no target-name profiles or built-in Zimbra lanes", () => {
  const campaign = buildCampaign({ target: "Zimbra", vulnerabilities: ["xss"] }, fixedNow);

  assert.equal(campaign.profile, "generic");
  assert.deepEqual(campaign.priorities.vulnerability_classes, ["xss"]);
  assert.deepEqual(campaign.lanes, [
    {
      id: "xss",
      title: "Review xss hypotheses",
      vulnerability_class: "xss",
      finding_id: "zimbra-xss",
    },
  ]);
  assert.doesNotMatch(JSON.stringify(campaign), /soap|mailbox|attachment|proxy/i);
});

test("Campaign validation accepts a complete valid Campaign object", () => {
  const campaign = validCampaign();
  assert.deepEqual(validateCampaign(campaign), campaign);
  assert.deepEqual(parseCampaignYaml(stringifyYaml(campaign)), campaign);
});

test("Campaign validation reports required mapping, list, enum, id, and class paths", () => {
  const invalid = structuredClone(validCampaign()) as unknown as Record<string, unknown>;
  invalid.id = "../unsafe";
  invalid.status = "paused";
  invalid.profile = "target-specific";
  invalid.target = { name: "", version: "", source: 3, ecosystem: "other" };
  invalid.scope = { mode: "active", local_reproduction: "maybe", boundaries: "none" };
  invalid.goal = { output: "pdf" };
  invalid.budget = { depth: "unbounded" };
  invalid.priorities = { vulnerability_classes: ["XSS", ""] };
  invalid.lanes = "not-a-list";

  assert.throws(
    () => validateCampaign(invalid),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      for (const path of [
        "id",
        "status",
        "profile",
        "target.name",
        "target.version",
        "target.source",
        "target.ecosystem",
        "scope.mode",
        "scope.local_reproduction",
        "scope.boundaries",
        "goal.output",
        "budget.depth",
        "priorities.vulnerability_classes[0]",
        "lanes",
      ]) {
        assert.ok(error.message.includes(path), `expected validation error to include ${path}`);
      }
      return true;
    },
  );
});

test("Campaign validation rejects missing required mappings and fields", () => {
  const requiredCases: Array<[string, (value: Record<string, unknown>) => void]> = [
    ["schema_version", (value) => delete value.schema_version],
    ["title", (value) => delete value.title],
    ["created_at", (value) => delete value.created_at],
    ["updated_at", (value) => delete value.updated_at],
    ["target", (value) => delete value.target],
    ["scope", (value) => delete value.scope],
    ["goal", (value) => delete value.goal],
    ["budget", (value) => delete value.budget],
    ["priorities", (value) => delete value.priorities],
    ["lanes", (value) => delete value.lanes],
  ];

  for (const [path, mutate] of requiredCases) {
    const invalid = structuredClone(validCampaign()) as unknown as Record<string, unknown>;
    mutate(invalid);
    assert.throws(() => validateCampaign(invalid), new RegExp(path));
  }
});

test("Campaign validation enforces ISO timestamps, exact lane correspondence, and unique finding ids", () => {
  const invalid = structuredClone(validCampaign());
  invalid.created_at = "next Thursday";
  invalid.updated_at = "2026-07-10";
  invalid.lanes[0].title = "A target-specific claim";
  invalid.lanes[1].vulnerability_class = "xss";
  invalid.lanes[1].finding_id = invalid.lanes[0].finding_id;

  assert.throws(
    () => validateCampaign(invalid),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /created_at.*ISO/);
      assert.match(error.message, /updated_at.*ISO/);
      assert.match(error.message, /lanes\[0\]\.title/);
      assert.match(error.message, /lanes\[1\]\.vulnerability_class/);
      assert.match(error.message, /lanes\[1\]\.finding_id/);
      assert.match(error.message, /unique/i);
      return true;
    },
  );
});

test("Campaign calendar-strict ISO validation rejects rollover dates and invalid clock components", () => {
  for (const timestamp of [
    "2026-02-30T00:00:00.000Z",
    "2026-13-01T00:00:00.000Z",
    "2026-07-10T24:00:00.000Z",
  ]) {
    const invalid = validCampaign();
    invalid.created_at = timestamp;
    assert.throws(() => validateCampaign(invalid), /created_at.*ISO 8601/);
  }
});

test("Campaign calendar-strict ISO validation accepts real leap days and supported offsets", () => {
  const campaign = validCampaign();
  campaign.created_at = "2024-02-29T00:00:00.000Z";
  campaign.updated_at = "2024-02-29T23:59:59+05:30";

  assert.deepEqual(validateCampaign(campaign), campaign);
});

test("Campaign timestamp validation rejects trailing line breaks and reversed chronology", () => {
  const trailingLineBreak = validCampaign();
  trailingLineBreak.created_at = `${FIXED_ISO}\n`;
  assert.throws(() => validateCampaign(trailingLineBreak), /created_at.*ISO 8601/);

  const reversed = validCampaign();
  reversed.created_at = "2026-07-11T00:00:00.000Z";
  reversed.updated_at = "2026-07-10T00:00:00.000Z";
  assert.throws(() => validateCampaign(reversed), /updated_at.*earlier than created_at/i);
});

test("Campaign validation rejects malformed YAML with its source", () => {
  assert.throws(
    () => parseCampaignYaml("target: [unterminated", "/tmp/broken.yaml"),
    /\/tmp\/broken\.yaml.*YAML.*parse/i,
  );
});

test("Campaign validation rejects filename and body id mismatches", () => {
  assert.throws(
    () => parseCampaignYaml(stringifyYaml(validCampaign()), "/tmp/not-acme.yaml"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /filename id/i);
      assert.match(error.message, /not-acme/);
      assert.match(error.message, /acme-1-2/);
      return true;
    },
  );
});

test("Campaign closed schema rejects extra keys at every mapping level without mutating input", () => {
  const cases: Array<[string, (campaign: Campaign) => void]> = [
    ["unexpected", (campaign) => { (campaign as unknown as Record<string, unknown>).unexpected = true; }],
    ["target.unexpected", (campaign) => { (campaign.target as unknown as Record<string, unknown>).unexpected = true; }],
    ["scope.unexpected", (campaign) => { (campaign.scope as unknown as Record<string, unknown>).unexpected = true; }],
    ["goal.unexpected", (campaign) => { (campaign.goal as unknown as Record<string, unknown>).unexpected = true; }],
    ["budget.unexpected", (campaign) => { (campaign.budget as unknown as Record<string, unknown>).unexpected = true; }],
    ["priorities.unexpected", (campaign) => {
      (campaign.priorities as unknown as Record<string, unknown>).unexpected = true;
    }],
    ["lanes[0].unexpected", (campaign) => {
      (campaign.lanes[0] as unknown as Record<string, unknown>).unexpected = true;
    }],
  ];

  for (const [path, mutate] of cases) {
    const invalid = validCampaign();
    mutate(invalid);
    const before = structuredClone(invalid);
    assert.throws(
      () => validateCampaign(invalid),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(error.message, /not allowed/i);
        return true;
      },
    );
    assert.deepEqual(invalid, before);
  }
});

test("Campaign closed schema rejects noncanonical text and uppercase UNKNOWN values", () => {
  const cases: Array<[string, (campaign: Campaign) => void]> = [
    ["title", (campaign) => { campaign.title = ` ${campaign.title}`; }],
    ["target.name", (campaign) => { campaign.target.name = " Acme"; }],
    ["target.version", (campaign) => { campaign.target.version = "1.2 "; }],
    ["target.source", (campaign) => { campaign.target.source = " unknown "; }],
    ["scope.boundaries[0]", (campaign) => { campaign.scope.boundaries[0] = ` ${campaign.scope.boundaries[0]}`; }],
    ["target.version", (campaign) => { campaign.target.version = "UNKNOWN"; }],
    ["target.source", (campaign) => { campaign.target.source = "UNKNOWN"; }],
    ["target.ecosystem", (campaign) => { campaign.target.ecosystem = "UNKNOWN" as never; }],
  ];

  for (const [path, mutate] of cases) {
    const invalid = validCampaign();
    mutate(invalid);
    assert.throws(
      () => validateCampaign(invalid),
      (error: unknown) => error instanceof Error && error.message.includes(path),
    );
  }
});

test("Campaign closed schema requires the exact derived title for known and unknown versions", () => {
  const known = validCampaign();
  known.title = "A user supplied title";
  assert.throws(() => validateCampaign(known), /title.*Acme 1\.2 research campaign/);

  const unknown = buildCampaign({ target: "Acme", vulnerabilities: ["xss"] }, fixedNow);
  unknown.title = "Acme unknown research campaign";
  assert.throws(() => validateCampaign(unknown), /title.*Acme research campaign/);
});

test("Campaign closed schema requires all baseline boundaries and permits normalized additions", () => {
  const campaign = validCampaign();
  for (const boundary of campaign.scope.boundaries) {
    const invalid = structuredClone(campaign);
    invalid.scope.boundaries = invalid.scope.boundaries.filter((item) => item !== boundary);
    assert.throws(
      () => validateCampaign(invalid),
      (error: unknown) => error instanceof Error
        && error.message.includes("scope.boundaries")
        && error.message.includes(boundary),
    );
  }

  const extended = structuredClone(campaign);
  extended.scope.boundaries.push("read-only review");
  assert.deepEqual(validateCampaign(extended), extended);
});

test("Campaign closed schema is enforced when listing and showing files", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const campaign = buildCampaign({ id: "demo", target: "Acme", vulnerabilities: ["xss"] }, fixedNow);
    (campaign.target as unknown as Record<string, unknown>).unexpected = "value";
    await writeFile(join(dir, "demo.yaml"), stringifyYaml(campaign), "utf-8");

    await assert.rejects(() => listCampaigns(projectRoot), /target\.unexpected.*not allowed/i);
    await assert.rejects(() => showCampaign("demo", projectRoot), /target\.unexpected.*not allowed/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign runbook is deterministic, generic, and conservative", () => {
  const campaign = validCampaign();
  const first = renderCampaignRunbook(campaign);
  const second = renderCampaignRunbook(structuredClone(campaign));

  assert.equal(first, second);
  assert.match(first, /^# Acme 1\.2 research campaign/m);
  assert.match(first, /Target: Acme/);
  assert.match(first, /Version: 1\.2/);
  assert.match(first, /Source: unknown/);
  assert.match(first, /Ecosystem: unknown/);
  for (const boundary of campaign.scope.boundaries) {
    assert.match(first, new RegExp(boundary));
  }
  assert.match(first, /unproven candidate hypotheses/i);
  assert.match(first, /Vulnerability class: xss/);
  assert.match(first, /Finding ID: acme-1-2-xss/);
  assert.match(first, /Vulnerability class: auth-z/);
  assert.match(first, /Finding ID: acme-1-2-auth-z/);
  assert.match(first, /omv campaign show acme-1-2/);
  assert.match(first, /Set `target\.ecosystem` to a supported value/);
  assert.match(first, /omv campaign seed acme-1-2/);
  assert.ok(first.indexOf("Set `target.ecosystem`") < first.indexOf("omv campaign seed acme-1-2"));
  assert.match(first, /\/omv-audit acme-1-2-xss/);
  assert.doesNotMatch(
    first,
    /\.omv\/notes|notes file|ThreatMap|\/omv-repro|omv repro|verification|proof[- ]of[- ]concept|PoC/i,
  );
  assert.doesNotMatch(first, /SOAP|mailbox|attachment|proxy/i);
});

test("Campaign rejects control characters and escapes Markdown in user facts", () => {
  assert.throws(
    () => buildCampaign({ target: "Acme\n# injected", vulnerabilities: ["xss"] }, fixedNow),
    /target\.name.*single-line/i,
  );

  const invalidBoundary = validCampaign();
  invalidBoundary.scope.boundaries.push("review locally\n# injected");
  assert.throws(() => validateCampaign(invalidBoundary), /scope\.boundaries.*single-line/i);

  const campaign = buildCampaign(
    {
      target: "Acme *Suite* [docs]",
      version: "1_2",
      source: "https://example.test/a_[b]#fragment",
      vulnerabilities: ["xss"],
    },
    fixedNow,
  );
  campaign.scope.boundaries.push("review [local] *only* #safe");
  const runbook = renderCampaignRunbook(campaign);

  assert.ok(runbook.includes("Acme \\*Suite\\* \\[docs\\]"));
  assert.ok(runbook.includes("1\\_2"));
  assert.ok(runbook.includes("a\\_\\[b\\]\\#fragment"));
  assert.ok(runbook.includes("review \\[local\\] \\*only\\* \\#safe"));
  assert.doesNotMatch(runbook, /^# injected$/m);
});

test("Campaign init validates before creating directories or artifacts", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    await assert.rejects(
      () => initCampaign({ target: "Acme", vulnerabilities: [] }, { projectRoot, now: fixedNow }),
      /vulnerability/i,
    );
    assert.equal(existsSync(campaignsDir(projectRoot)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init serializes concurrent no-force writers with an exclusive lock", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const input = { id: "concurrent", target: "Acme", ecosystem: "npm", vulnerabilities: ["xss"] };
    const results = await Promise.allSettled([
      initCampaign(input, { projectRoot, now: fixedNow }),
      initCampaign(input, { projectRoot, now: fixedNow }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const rejection = results.find((result) => result.status === "rejected");
    assert.match(String(rejection?.reason), /busy|already exists/i);

    const yamlPath = campaignPath("concurrent", projectRoot);
    const runbookPath = campaignRunbookPath("concurrent", projectRoot);
    const campaign = parseCampaignYaml(await readFile(yamlPath, "utf-8"), yamlPath);
    assert.equal(await readFile(runbookPath, "utf-8"), renderCampaignRunbook(campaign));
    assert.equal((await readdir(campaignsDir(projectRoot))).some((name) => name.includes(".lock")), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init reports existing regular and symlink locks as busy without removing them", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const regularLock = join(dir, "regular.lock");
    const symlinkLock = join(dir, "linked.lock");
    await writeFile(regularLock, "held\n", "utf-8");
    await symlink(join(projectRoot, "missing-lock-target"), symlinkLock);

    for (const id of ["regular", "linked"]) {
      await assert.rejects(
        () => initCampaign({ id, target: "Acme", vulnerabilities: ["xss"] }, { projectRoot, now: fixedNow }),
        /busy.*lock/i,
      );
    }
    assert.equal(await readFile(regularLock, "utf-8"), "held\n");
    assert.equal((await readdir(dir)).includes("linked.lock"), true);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init treats dangling artifact symlinks as collisions without following them", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const yamlPath = campaignPath("dangling", projectRoot);
    const runbookPath = campaignRunbookPath("dangling", projectRoot);
    const externalYaml = join(projectRoot, "external-missing.yaml");
    const externalRunbook = join(projectRoot, "external-missing.md");
    await symlink(externalYaml, yamlPath);
    await symlink(externalRunbook, runbookPath);

    await assert.rejects(
      () => initCampaign(
        { id: "dangling", target: "Acme", vulnerabilities: ["xss"] },
        { projectRoot, now: fixedNow },
      ),
      /already exists.*--force/i,
    );
    assert.equal((await lstat(yamlPath)).isSymbolicLink(), true);
    assert.equal((await lstat(runbookPath)).isSymbolicLink(), true);
    assert.equal(existsSync(externalYaml), false);
    assert.equal(existsSync(externalRunbook), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init force replaces external artifact symlinks without changing their targets", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const yamlPath = campaignPath("linked", projectRoot);
    const runbookPath = campaignRunbookPath("linked", projectRoot);
    const externalYaml = join(projectRoot, "external.yaml");
    const externalRunbook = join(projectRoot, "external.md");
    const yamlBytes = Buffer.from("external YAML bytes\r\n");
    const runbookBytes = Buffer.from("external Markdown bytes\r\n");
    await writeFile(externalYaml, yamlBytes);
    await writeFile(externalRunbook, runbookBytes);
    await symlink(externalYaml, yamlPath);
    await symlink(externalRunbook, runbookPath);

    const result = await initCampaign(
      { id: "linked", target: "Acme", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow, force: true },
    );

    assert.equal((await lstat(yamlPath)).isFile(), true);
    assert.equal((await lstat(runbookPath)).isFile(), true);
    assert.deepEqual(await readFile(externalYaml), yamlBytes);
    assert.deepEqual(await readFile(externalRunbook), runbookBytes);
    assert.deepEqual(parseCampaignYaml(await readFile(yamlPath, "utf-8"), yamlPath), result.campaign);
    assert.equal(await readFile(runbookPath, "utf-8"), renderCampaignRunbook(result.campaign));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init rejects directory artifact destinations even with force", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const yamlPath = campaignPath("directory", projectRoot);
    const runbookPath = campaignRunbookPath("directory", projectRoot);
    await mkdir(yamlPath);
    const originalRunbook = Buffer.from("# Preserve me\r\n");
    await writeFile(runbookPath, originalRunbook);

    await assert.rejects(
      () => initCampaign(
        { id: "directory", target: "Acme", vulnerabilities: ["xss"] },
        { projectRoot, now: fixedNow, force: true },
      ),
      /artifact.*directory.*not supported/i,
    );
    assert.equal((await lstat(yamlPath)).isDirectory(), true);
    assert.deepEqual(await readFile(runbookPath), originalRunbook);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init force failure preserves the original pair and leaves no transaction residue", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const first = await initCampaign(
      { id: "rollback", target: "Original", ecosystem: "npm", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    const originalYaml = await readFile(first.yamlPath);
    const originalRunbook = await readFile(first.runbookPath);
    const lateConflict = join(campaignsDir(projectRoot), "rollback.yml");
    let injected = false;
    const options = {
      projectRoot,
      now: fixedNow,
      get force(): boolean {
        if (!injected) {
          mkdirSync(lateConflict);
          injected = true;
        }
        return true;
      },
    };

    await assert.rejects(
      () => initCampaign(
        { id: "rollback", target: "Replacement", ecosystem: "npm", vulnerabilities: ["auth"] },
        options,
      ),
      /artifact.*directory.*not supported/i,
    );

    assert.deepEqual(await readFile(first.yamlPath), originalYaml);
    assert.deepEqual(await readFile(first.runbookPath), originalRunbook);
    assert.equal((await lstat(lateConflict)).isDirectory(), true);
    const residue = (await readdir(campaignsDir(projectRoot))).filter((name) =>
      name.includes(".lock") || name.includes("transaction") || name.includes("backup"));
    assert.deepEqual(residue, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init keeps committed artifacts when activity recording fails", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    await mkdir(workspaceActivityLogPath(projectRoot), { recursive: true });

    const result = await initCampaign(
      { id: "activity-warning", target: "Acme", ecosystem: "npm", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );

    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /activity/i);
    assert.ok(result.warnings[0].includes(workspaceActivityLogPath(projectRoot)));
    assert.deepEqual(
      parseCampaignYaml(await readFile(result.yamlPath, "utf-8"), result.yamlPath),
      result.campaign,
    );
    assert.equal(await readFile(result.runbookPath, "utf-8"), renderCampaignRunbook(result.campaign));
    const residue = (await readdir(campaignsDir(projectRoot))).filter((name) =>
      name.includes(".lock") || name.includes("transaction") || name.includes("backup"));
    assert.deepEqual(residue, []);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init writes a validated pair, records activity, and leaves the workspace index unchanged", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    await initWorkspace(projectRoot);
    const indexBefore = await readFile(workspaceIndexPath(projectRoot));
    const result = await initCampaign(
      { target: "Acme", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );

    assert.equal(result.yamlPath, campaignPath("acme", projectRoot));
    assert.equal(result.runbookPath, campaignRunbookPath("acme", projectRoot));
    assert.equal(result.overwritten, false);
    assert.equal(
      result.nextAction,
      "Set target.ecosystem to a supported value before running omv campaign seed acme",
    );
    assert.deepEqual(
      parseCampaignYaml(await readFile(result.yamlPath, "utf-8"), result.yamlPath),
      result.campaign,
    );
    assert.equal(await readFile(result.runbookPath, "utf-8"), renderCampaignRunbook(result.campaign));
    assert.deepEqual(await readFile(workspaceIndexPath(projectRoot)), indexBefore);

    const activities = await readWorkspaceActivity(projectRoot);
    assert.equal(activities.at(-1)?.action, "campaign.init");
    assert.equal(activities.at(-1)?.id, "acme");
    assert.equal(activities.at(-1)?.path, result.yamlPath);
    const index = JSON.parse(indexBefore.toString("utf-8")) as Record<string, unknown>;
    assert.equal("campaigns" in index, false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init protects an existing YAML artifact without creating the missing runbook", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const first = await initCampaign(
      { target: "Acme", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    await unlink(first.runbookPath);
    const original = Buffer.from("preserve YAML bytes\r\n");
    await writeFile(first.yamlPath, original);

    await assert.rejects(
      () => initCampaign({ target: "Acme", vulnerabilities: ["auth"] }, { projectRoot, now: fixedNow }),
      /already exists.*--force/i,
    );
    assert.deepEqual(await readFile(first.yamlPath), original);
    assert.equal(existsSync(first.runbookPath), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init protects an existing runbook without creating the missing YAML", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const first = await initCampaign(
      { target: "Acme", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    await unlink(first.yamlPath);
    const original = Buffer.from("# Preserve runbook bytes\r\n");
    await writeFile(first.runbookPath, original);

    await assert.rejects(
      () => initCampaign({ target: "Acme", vulnerabilities: ["auth"] }, { projectRoot, now: fixedNow }),
      /already exists.*--force/i,
    );
    assert.deepEqual(await readFile(first.runbookPath), original);
    assert.equal(existsSync(first.yamlPath), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init treats an existing YML file as a protected YAML artifact", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const ymlPath = join(dir, "demo.yml");
    const original = Buffer.from("preserve alternate YAML bytes\r\n");
    await writeFile(ymlPath, original);

    await assert.rejects(
      () => initCampaign(
        { id: "demo", target: "Acme", vulnerabilities: ["xss"] },
        { projectRoot, now: fixedNow },
      ),
      /already exists.*--force/i,
    );
    assert.deepEqual(await readFile(ymlPath), original);
    assert.equal(existsSync(campaignPath("demo", projectRoot)), false);
    assert.equal(existsSync(campaignRunbookPath("demo", projectRoot)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init force replaces an existing YML source with the canonical artifact pair", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const ymlPath = join(dir, "demo.yml");
    await writeFile(ymlPath, "old: YAML\n", "utf-8");
    await writeFile(campaignRunbookPath("demo", projectRoot), "# Old\n", "utf-8");

    const result = await initCampaign(
      { id: "demo", target: "Acme", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow, force: true },
    );

    assert.equal(result.overwritten, true);
    assert.equal(result.yamlPath, campaignPath("demo", projectRoot));
    assert.equal(existsSync(ymlPath), false);
    assert.equal(parseCampaignYaml(await readFile(result.yamlPath, "utf-8"), result.yamlPath).id, "demo");
    assert.equal(await readFile(result.runbookPath, "utf-8"), renderCampaignRunbook(result.campaign));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign init force replaces both artifacts from one newly normalized object", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const first = await initCampaign(
      { id: "demo", target: "Old Target", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    const replacement = await initCampaign(
      { id: "demo", target: "New Target", version: "2.0", vulnerabilities: ["auth z"] },
      { projectRoot, now: fixedNow, force: true },
    );

    assert.equal(replacement.overwritten, true);
    assert.equal(replacement.campaign.target.name, "New Target");
    assert.equal(replacement.campaign.target.version, "2.0");
    assert.deepEqual(replacement.campaign.priorities.vulnerability_classes, ["auth-z"]);
    assert.deepEqual(
      parseCampaignYaml(await readFile(first.yamlPath, "utf-8"), first.yamlPath),
      replacement.campaign,
    );
    assert.equal(await readFile(first.runbookPath, "utf-8"), renderCampaignRunbook(replacement.campaign));
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign list directly scans YAML and YML files into stable sorted summaries", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(join(dir, "nested"), { recursive: true });
    const alpha = buildCampaign({ id: "a", target: "Alpha", vulnerabilities: ["xss"] }, fixedNow);
    const beta = buildCampaign(
      { id: "b", target: "Beta", version: "2", ecosystem: "npm", vulnerabilities: ["ssrf", "auth"] },
      fixedNow,
    );
    await writeFile(join(dir, "b.yml"), stringifyYaml(beta), "utf-8");
    await writeFile(join(dir, "a.yaml"), stringifyYaml(alpha), "utf-8");
    await writeFile(join(dir, "ignored.txt"), stringifyYaml(alpha), "utf-8");
    await writeFile(join(dir, "nested", "nested.yaml"), stringifyYaml(alpha), "utf-8");

    assert.deepEqual(await listCampaigns(projectRoot), [
      {
        id: "a",
        title: "Alpha research campaign",
        status: "active",
        target: "Alpha",
        version: "unknown",
        laneCount: 1,
        nextAction: "Set target.ecosystem to a supported value before running omv campaign seed a",
      },
      {
        id: "b",
        title: "Beta 2 research campaign",
        status: "active",
        target: "Beta",
        version: "2",
        laneCount: 2,
        nextAction: "omv campaign seed b",
      },
    ]);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign list returns empty for a missing directory without mutating the filesystem", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    assert.equal(existsSync(campaignsDir(projectRoot)), false);
    assert.deepEqual(await listCampaigns(projectRoot), []);
    assert.equal(existsSync(campaignsDir(projectRoot)), false);
    assert.equal(existsSync(workspaceIndexPath(projectRoot)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign show resolves either YAML extension when the source is unambiguous", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const primary = buildCampaign({ id: "demo", target: "Primary", vulnerabilities: ["xss"] }, fixedNow);
    const fallback = buildCampaign({ id: "demo", target: "Fallback", vulnerabilities: ["ssrf"] }, fixedNow);
    const yamlPath = join(dir, "demo.yaml");
    const ymlPath = join(dir, "demo.yml");
    const runbookPath = campaignRunbookPath("demo", projectRoot);
    await writeFile(yamlPath, stringifyYaml(primary), "utf-8");
    await writeFile(runbookPath, "# Existing runbook\n", "utf-8");

    const shown = await showCampaign("demo", projectRoot);
    assert.equal(shown.campaign.target.name, "Primary");
    assert.equal(shown.yamlPath, yamlPath);
    assert.equal(shown.runbookPath, runbookPath);
    assert.equal(shown.runbookExists, true);
    assert.equal(
      shown.nextAction,
      "Set target.ecosystem to a supported value before running omv campaign seed demo",
    );

    await unlink(yamlPath);
    await writeFile(ymlPath, stringifyYaml(fallback), "utf-8");
    const fallbackShown = await showCampaign("demo", projectRoot);
    assert.equal(fallbackShown.campaign.target.name, "Fallback");
    assert.equal(fallbackShown.yamlPath, ymlPath);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign duplicate source pairs are rejected by list and show", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const campaign = buildCampaign({ id: "demo", target: "Acme", vulnerabilities: ["xss"] }, fixedNow);
    const yamlPath = join(dir, "demo.yaml");
    const ymlPath = join(dir, "demo.yml");
    await writeFile(yamlPath, stringifyYaml(campaign), "utf-8");
    await writeFile(ymlPath, stringifyYaml(campaign), "utf-8");

    for (const operation of [
      () => listCampaigns(projectRoot),
      () => showCampaign("demo", projectRoot),
    ]) {
      await assert.rejects(
        operation,
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /duplicate Campaign sources/i);
          assert.ok(error.message.includes(yamlPath));
          assert.ok(error.message.includes(ymlPath));
          return true;
        },
      );
    }
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign show rejects unsafe ids before resolving files", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    await assert.rejects(() => showCampaign("../demo", projectRoot), /campaign id/i);
    assert.equal(existsSync(campaignsDir(projectRoot)), false);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign list and show reject malformed files and filename/body id mismatches", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const dir = campaignsDir(projectRoot);
    await mkdir(dir, { recursive: true });
    const path = join(dir, "broken.yaml");
    await writeFile(path, "target: [unterminated", "utf-8");
    await assert.rejects(() => listCampaigns(projectRoot), /broken\.yaml.*YAML.*parse/i);
    await assert.rejects(() => showCampaign("broken", projectRoot), /broken\.yaml.*YAML.*parse/i);

    await writeFile(path, stringifyYaml(validCampaign()), "utf-8");
    await assert.rejects(() => listCampaigns(projectRoot), /filename id broken/i);
    await assert.rejects(() => showCampaign("broken", projectRoot), /filename id broken/i);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign list and show leave workspace index bytes unchanged", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    await initWorkspace(projectRoot);
    const campaign = buildCampaign({ id: "demo", target: "Acme", vulnerabilities: ["xss"] }, fixedNow);
    await writeFile(campaignPath("demo", projectRoot), stringifyYaml(campaign), "utf-8");
    const before = await readFile(workspaceIndexPath(projectRoot));

    await listCampaigns(projectRoot);
    await showCampaign("demo", projectRoot);

    assert.deepEqual(await readFile(workspaceIndexPath(projectRoot)), before);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign ecosystem-aware next actions gate unknown targets before seed", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "omv-campaign-"));

  try {
    const unknown = await initCampaign(
      { id: "unknown-target", target: "Unknown Target", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    const known = await initCampaign(
      { id: "known-target", target: "Known Target", ecosystem: "npm", vulnerabilities: ["xss"] },
      { projectRoot, now: fixedNow },
    );
    const unknownAction = "Set target.ecosystem to a supported value before running omv campaign seed unknown-target";

    assert.equal(unknown.nextAction, unknownAction);
    assert.equal(known.nextAction, "omv campaign seed known-target");

    const listed = await listCampaigns(projectRoot);
    assert.equal(listed.find((item) => item.id === "unknown-target")?.nextAction, unknownAction);
    assert.equal(
      listed.find((item) => item.id === "known-target")?.nextAction,
      "omv campaign seed known-target",
    );
    assert.equal((await showCampaign("unknown-target", projectRoot)).nextAction, unknownAction);
    assert.equal(
      (await showCampaign("known-target", projectRoot)).nextAction,
      "omv campaign seed known-target",
    );

    const unknownRunbook = await readFile(unknown.runbookPath, "utf-8");
    const ecosystemInstruction = unknownRunbook.indexOf("Set `target.ecosystem` to a supported value");
    const seedCommand = unknownRunbook.indexOf("omv campaign seed unknown-target");
    assert.ok(ecosystemInstruction >= 0);
    assert.ok(seedCommand > ecosystemInstruction);
    assert.doesNotMatch(unknownRunbook, /^2\..*omv campaign seed/m);

    const knownRunbook = await readFile(known.runbookPath, "utf-8");
    assert.match(knownRunbook, /^2\..*`omv campaign seed known-target`/m);
    assert.doesNotMatch(knownRunbook, /Set `target\.ecosystem`/);
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

test("Campaign prompt resolution asks for both missing required values and splits comma classes", async () => {
  const prompt = new RecordingCampaignPrompt(" Acme ", " XSS, auth z, ssrf ");

  const completed = await resolveCampaignInput({}, { interactive: true, prompt });

  assert.deepEqual(prompt.calls, ["target", "vulnerabilities"]);
  assert.deepEqual(completed, {
    target: "Acme",
    vulnerabilities: ["XSS", "auth z", "ssrf"],
  });
  assert.equal("version" in completed, false);
  assert.equal("mode" in completed, false);
});

test("Campaign prompt resolution asks only for the required value missing from partial input", async () => {
  const vulnerabilityPrompt = new RecordingCampaignPrompt("unused", " xss, auth ");
  const withTarget = await resolveCampaignInput(
    { target: "Acme" },
    { interactive: true, prompt: vulnerabilityPrompt },
  );
  assert.deepEqual(vulnerabilityPrompt.calls, ["vulnerabilities"]);
  assert.deepEqual(withTarget.vulnerabilities, ["xss", "auth"]);

  const targetPrompt = new RecordingCampaignPrompt(" Beta ", "unused");
  const withVulnerabilities = await resolveCampaignInput(
    { vulnerabilities: ["ssrf"] },
    { interactive: true, prompt: targetPrompt },
  );
  assert.deepEqual(targetPrompt.calls, ["target"]);
  assert.equal(withVulnerabilities.target, "Beta");
  assert.deepEqual(withVulnerabilities.vulnerabilities, ["ssrf"]);
});

test("Campaign prompt resolution never calls an adapter in non-interactive mode and reports all missing fields", async () => {
  for (const reason of ["non-TTY", "--no-interactive", "--json"]) {
    const prompt = new RecordingCampaignPrompt("Acme", "xss");
    await assert.rejects(
      () => resolveCampaignInput({}, { interactive: false, prompt }),
      (error: unknown) => {
        assert.ok(error instanceof Error, reason);
        assert.match(error.message, /target/i, reason);
        assert.match(error.message, /vulnerabilit/i, reason);
        return true;
      },
    );
    assert.deepEqual(prompt.calls, [], reason);
  }
});

test("Campaign prompt resolution rejects blank required responses after asking every missing field", async () => {
  const prompt = new RecordingCampaignPrompt("   ", " ,  , ");

  await assert.rejects(
    () => resolveCampaignInput({}, { interactive: true, prompt }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /target/i);
      assert.match(error.message, /vulnerabilit/i);
      return true;
    },
  );
  assert.deepEqual(prompt.calls, ["target", "vulnerabilities"]);
});

test("Campaign prompt resolution never prompts for complete supplied input", async () => {
  const prompt = new RecordingCampaignPrompt("unused", "unused");
  const input = {
    target: " Acme ",
    vulnerabilities: [" xss, auth ", " XSS "],
    source: " /tmp/source ",
  };

  const completed = await resolveCampaignInput(input, { interactive: true, prompt });

  assert.deepEqual(prompt.calls, []);
  assert.deepEqual(completed, {
    target: "Acme",
    vulnerabilities: ["xss", "auth", "XSS"],
    source: " /tmp/source ",
  });
});

test("Campaign prompt resolution requires an adapter only when interactive input is incomplete", async () => {
  await assert.rejects(
    () => resolveCampaignInput({ target: "Acme" }, { interactive: true }),
    /prompt adapter.*required/i,
  );
  assert.deepEqual(
    await resolveCampaignInput(
      { target: "Acme", vulnerabilities: ["xss"] },
      { interactive: true },
    ),
    { target: "Acme", vulnerabilities: ["xss"] },
  );
});

test("Campaign prompt production adapter routes questions and releases stream listeners", async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  let rendered = "";
  output.setEncoding("utf-8");
  output.on("data", (chunk: string) => {
    rendered += chunk;
  });

  const prompt: CampaignPromptAdapter = new ReadlineCampaignPrompt(input, output);
  const answer = prompt.askTarget();
  input.write("Acme\n");

  assert.equal(await answer, "Acme");
  assert.match(rendered, /Target:/);
  assert.ok(input.listenerCount("data") > 0);
  closeCampaignPrompt(prompt);
  assert.equal(input.listenerCount("data"), 0);
});
