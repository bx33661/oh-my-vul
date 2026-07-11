import test from "node:test";
import assert from "node:assert/strict";
import { render } from "ink-testing-library";
import { InteractiveApp, type InteractiveAppServices } from "../ui/app.js";
import { buildFindingDetailLines, filterFindings, wrapFindingDetailLines } from "../ui/workspace.js";
import { interactiveRenderOptions, waitForInteractiveExit } from "../ui/launcher.js";
import type { FindingDetail, FindingWorkflowSummary } from "../findings.js";
import { retainInteractiveActivity, type InteractiveWorkspaceModel } from "../ui/model.js";

const candidate = finding({
  id: "demo-xss",
  status: "candidate",
  vulnerability: "cross-site scripting",
  blockers: ["evidence.observed_result is unknown"],
  missingFields: ["evidence.observed_result"],
  command: "/omv-repro demo-xss",
  surface: "claude",
});
const blocked = finding({
  id: "demo-ssrf",
  status: "blocked",
  vulnerability: "server-side request forgery",
  blockers: ["allowlist blocks private destinations"],
  missingFields: [],
  command: "omv findings archive demo-ssrf --reason blocked",
  surface: "cli",
});

test("workspace filters across finding and action fields", () => {
  assert.deepEqual(filterFindings([candidate, blocked], "ssrf blocked").map((item) => item.id), ["demo-ssrf"]);
  assert.deepEqual(filterFindings([candidate, blocked], "omv-repro").map((item) => item.id), ["demo-xss"]);
  assert.deepEqual(filterFindings([candidate, blocked], "", { status: "candidate", surface: "claude" }).map((item) => item.id), ["demo-xss"]);
  assert.deepEqual(filterFindings([candidate, blocked], "demo", { status: "blocked", surface: "claude" }), []);
});

test("full detail lines wrap complete content without ellipsis", () => {
  const sentinel = `BLOCKER_${"x".repeat(70)}_END`;
  const findingWithLongContent: FindingWorkflowSummary = {
    ...candidate,
    blockers: [sentinel],
    verdict: { ...candidate.verdict, reason: `REASON_${"y".repeat(70)}_END` },
  };
  const wrapped = wrapFindingDetailLines(buildFindingDetailLines({
    finding: findingWithLongContent,
    detail: { ...detail(findingWithLongContent), blockers: [sentinel] },
    tab: "summary",
    activity: [],
  }), 24);
  const joined = wrapped.map((item) => item.text).join("");
  assert.match(joined, /BLOCKER_x+_END/);
  assert.match(joined, /REASON_y+_END/);
  assert.equal(wrapped.every((item) => item.text.length <= 24), true);
  assert.equal(wrapped.some((item) => item.text.includes("…")), false);
  const wide = wrapFindingDetailLines(buildFindingDetailLines({
    finding: findingWithLongContent,
    detail: { ...detail(findingWithLongContent), blockers: [sentinel] },
    tab: "summary",
    activity: [],
  }), 80);
  assert.equal(wide.length < wrapped.length, true);
  assert.equal(wide.every((item) => item.text.length <= 80), true);
});

test("full detail focus scrolls to complete content and preserves selection", async () => {
  const longDetail: FindingDetail = {
    ...detail(candidate),
    blockers: Array.from({ length: 20 }, (_, index) => `complete blocker ${index + 1} with full diagnostic context`),
  };
  longDetail.validation.warnings = longDetail.blockers;
  const services: InteractiveAppServices = {
    reload: async () => initializedModel(),
    loadFinding: async (id) => id === candidate.id ? longDetail : detail(blocked),
    start: async () => initializedModel(),
  };
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={services} dimensions={{ columns: 52, rows: 16 }} />);
  await tick();
  screen.stdin.write(" ");
  await tick();
  let frame = screen.lastFrame() ?? "";
  assert.doesNotMatch(frame, /WORKFLOW QUEUE/);
  const firstRange = frame.match(/LINES 1-\d+\/(\d+)/);
  assert.ok(firstRange);
  const total = Number(firstRange[1]);
  assert.equal(total > 8, true);

  screen.stdin.write("G");
  await tick();
  frame = screen.lastFrame() ?? "";
  assert.match(frame, new RegExp(`LINES \\d+-${total}/${total}`));

  screen.stdin.write("]");
  await tick();
  assert.match(screen.lastFrame() ?? "", /LINES 1-/);

  screen.stdin.write(" ");
  await tick();
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  assert.match(screen.lastFrame() ?? "", /demo-xss/);
  screen.unmount();
});

test("activity view pages through retained history", async () => {
  const model = initializedModel();
  model.activity = Array.from({ length: 20 }, (_, index) => ({
    timestamp: `2026-07-11T00:${String(index).padStart(2, "0")}:00.000Z`,
    action: "finding.init" as const,
    id: `finding-${index + 1}`,
    status: "candidate",
    reason: index === 19 ? `FULL_REASON_${"z".repeat(520)}_END` : `activity reason ${index + 1}`,
    path: `/tmp/activity/finding-${index + 1}.yaml`,
  }));
  const screen = render(<InteractiveApp initialModel={model} services={fixtureServices(model)} dimensions={{ columns: 72, rows: 16 }} />);
  await tick();
  screen.stdin.write("4");
  await tick();
  let frame = screen.lastFrame() ?? "";
  assert.match(frame, /1-7\/20 newest first/);
  assert.equal(frame.split("\n").length <= 16, true, frame);
  assert.equal(frame.split("\n").every((line) => line.length <= 72), true, frame);
  screen.stdin.write("G");
  await tick();
  frame = screen.lastFrame() ?? "";
  assert.match(frame, /14-20\/20 newest first/);
  assert.match(frame, /finding-1/);
  assert.equal(frame.split("\n").length <= 16, true, frame);
  screen.stdin.write("g");
  await tick();
  assert.match(screen.lastFrame() ?? "", /1-7\/20 newest first/);

  screen.stdin.write(" ");
  await tick();
  frame = screen.lastFrame() ?? "";
  assert.match(frame, /ACTIVITY DETAIL/);
  const detailRange = frame.match(/LINES 1-\d+\/(\d+)/);
  assert.ok(detailRange);
  const total = Number(detailRange[1]);
  assert.equal(total > 10, true);
  screen.stdin.write("G");
  await tick();
  frame = screen.lastFrame() ?? "";
  assert.match(frame, new RegExp(`LINES \\d+-${total}/${total}`));
  assert.match(frame, /_END/);
  assert.doesNotMatch(frame, /…/);
  screen.stdin.write(" ");
  await tick();
  assert.match(screen.lastFrame() ?? "", /1-7\/20 newest first/);
  screen.unmount();
});

test("interactive activity retention keeps the newest 200 entries", () => {
  const activity = Array.from({ length: 205 }, (_, index) => ({
    timestamp: `2026-07-11T00:00:${String(index % 60).padStart(2, "0")}.000Z`,
    action: "finding.init" as const,
    id: `finding-${index + 1}`,
  }));
  const retained = retainInteractiveActivity(activity);
  assert.equal(retained.length, 200);
  assert.equal(retained[0]?.id, "finding-6");
  assert.equal(retained.at(-1)?.id, "finding-205");
});

test("workspace navigates overview, findings, campaigns, and activity", async () => {
  const model = initializedModel();
  model.campaigns.push({
    id: "second",
    title: "Research second-package 2.0.0",
    status: "active",
    target: "second-package",
    version: "2.0.0",
    laneCount: 3,
    nextAction: "omv campaign seed second",
  });
  const screen = render(<InteractiveApp initialModel={model} services={fixtureServices(model)} dimensions={{ columns: 120, rows: 32 }} />);
  await tick();

  screen.stdin.write("1");
  await tick();
  assert.match(screen.lastFrame() ?? "", /CURRENT CAMPAIGN/);
  assert.match(screen.lastFrame() ?? "", /NEXT PRIORITY/);

  screen.stdin.write("\t");
  await tick();
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);

  screen.stdin.write("3");
  await tick();
  assert.match(screen.lastFrame() ?? "", /CAMPAIGNS/);
  screen.stdin.write("j");
  await tick();
  assert.match(screen.lastFrame() ?? "", /Research second-package 2.0.0/);

  screen.stdin.write("4");
  await tick();
  assert.match(screen.lastFrame() ?? "", /RECENT ACTIVITY/);
  assert.match(screen.lastFrame() ?? "", /finding.promote/);
  screen.unmount();
});

test("finding inspector switches summary, evidence, threat, and history tabs", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 120, rows: 32 }} />);
  await tick();
  assert.match(screen.lastFrame() ?? "", /BLOCKER/);

  screen.stdin.write("]");
  await tick();
  assert.match(screen.lastFrame() ?? "", /VALIDATION/);
  assert.match(screen.lastFrame() ?? "", /REPRO/);

  screen.stdin.write("]");
  await tick();
  assert.match(screen.lastFrame() ?? "", /VALID THREAT MAP/);
  assert.match(screen.lastFrame() ?? "", /user input → parser → HTML sink/);

  screen.stdin.write("]");
  await tick();
  assert.match(screen.lastFrame() ?? "", /finding.promote/);
  screen.unmount();
});

test("structured filters compose and command palette performs local navigation", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 120, rows: 32 }} />);
  await tick();
  screen.stdin.write("f");
  await tick();
  assert.match(screen.lastFrame() ?? "", /STRUCTURED FINDING FILTER/);
  screen.stdin.write("\u001b[C");
  await tick();
  screen.stdin.write("\r");
  await tick();
  assert.match(screen.lastFrame() ?? "", /status:candidate/);
  assert.match(screen.lastFrame() ?? "", /1 match/);

  screen.stdin.write("/");
  await tick();
  screen.stdin.write("ssrf");
  await tick();
  screen.stdin.write("\r");
  await tick();
  assert.match(screen.lastFrame() ?? "", /No matching findings/);

  screen.stdin.write(":");
  await tick();
  assert.match(screen.lastFrame() ?? "", /COMMAND PALETTE/);
  screen.stdin.write("\r");
  await tick();
  assert.match(screen.lastFrame() ?? "", /CURRENT CAMPAIGN/);
  screen.unmount();
});

test("V2 views and overlays remain bounded at 52x16", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 52, rows: 16 }} />);
  await tick();
  for (const key of ["1", "3", "4", ":"]) {
    screen.stdin.write(key);
    await tick();
    const frame = screen.lastFrame() ?? "";
    assert.equal(frame.split("\n").every((line) => line.length <= 52), true, frame);
    assert.equal(frame.split("\n").length <= 16, true, frame);
    if (key === ":") screen.stdin.write("\u001b");
  }
  screen.unmount();
});

test("wide workspace renders modern metrics, queue, inspector, filtering, and help", async () => {
  const services = fixtureServices(initializedModel());
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={services} dimensions={{ columns: 120, rows: 32 }} />);
  await tick();
  assert.match(screen.lastFrame() ?? "", /OH MY VUL/);
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  assert.match(screen.lastFrame() ?? "", /demo-xss/);
  assert.match(screen.lastFrame() ?? "", /SKILL\s+\/omv-repro demo-xss/);

  screen.stdin.write("j");
  await tick();
  assert.match(screen.lastFrame() ?? "", /CLI\s+omv findings archive demo-ssrf/);

  screen.stdin.write("/");
  await tick();
  screen.stdin.write("candidate");
  await tick();
  screen.stdin.write("\r");
  await tick();
  assert.match(screen.lastFrame() ?? "", /1 match/);
  assert.match(screen.lastFrame() ?? "", /demo-xss/);

  screen.stdin.write("?");
  await tick();
  assert.match(screen.lastFrame() ?? "", /KEYBOARD HELP/);
  screen.unmount();
});

test("narrow workspace switches between queue and evidence detail", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 72, rows: 24 }} />);
  await tick();
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  screen.stdin.write("\r");
  await tick();
  assert.doesNotMatch(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  assert.match(screen.lastFrame() ?? "", /BLOCKER/);
  assert.match(screen.lastFrame() ?? "", /VERDICT plausible\/medium/);
  assert.match(screen.lastFrame() ?? "", /enter queue/);
  screen.unmount();
});

test("refresh reloads detail for a finding whose id remains selected", async () => {
  let detailLoads = 0;
  const services: InteractiveAppServices = {
    reload: async () => initializedModel(),
    loadFinding: async () => {
      detailLoads += 1;
      return {
        ...detail(candidate),
        blockers: [`detail revision ${detailLoads}`],
      };
    },
    start: async () => initializedModel(),
  };
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={services} dimensions={{ columns: 120, rows: 32 }} />);
  await tick();
  assert.match(screen.lastFrame() ?? "", /detail revision 1/);

  screen.stdin.write("r");
  await tick();
  await tick();
  assert.equal(detailLoads, 2);
  assert.match(screen.lastFrame() ?? "", /detail revision 2/);
  screen.unmount();
});

test("a detail load error clears after selecting a healthy finding", async () => {
  const services: InteractiveAppServices = {
    reload: async () => initializedModel(),
    loadFinding: async (id) => {
      if (id === candidate.id) throw new Error("candidate detail is unreadable");
      return detail(blocked);
    },
    start: async () => initializedModel(),
  };
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={services} dimensions={{ columns: 120, rows: 32 }} />);
  await tick();
  assert.match(screen.lastFrame() ?? "", /candidate detail is unreadable/);

  screen.stdin.write("j");
  await tick();
  assert.doesNotMatch(screen.lastFrame() ?? "", /candidate detail is unreadable/);
  assert.match(screen.lastFrame() ?? "", /omv findings archive demo-ssrf/);
  screen.unmount();
});

test("undersized terminals render a bounded resize state", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 40, rows: 16 }} />);
  await tick();
  const frame = screen.lastFrame() ?? "";
  assert.match(frame, /Terminal too small/);
  assert.match(frame, /minimum 52x16/);
  assert.doesNotMatch(frame, /WORKFLOW QUEUE/);
  assert.equal(frame.split("\n").every((line) => line.length <= 40), true);
  assert.equal(frame.split("\n").length <= 16, true);
  screen.unmount();
});

test("60-column metrics and detail stay dense within 18 rows", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 60, rows: 18 }} />);
  await tick();
  let frame = screen.lastFrame() ?? "";
  assert.match(frame, /CAMPAIGNS 1  FINDINGS 2  CONFIRMED 0\n CANDIDATE 1  BLOCKED 1\n╭/);
  assert.equal(frame.split("\n").length <= 18, true);

  screen.stdin.write("\r");
  await tick();
  frame = screen.lastFrame() ?? "";
  assert.match(frame, /READINESS 68 · VERDICT plausible\/medium/);
  assert.match(frame, /enter queue/);
  assert.equal(frame.split("\n").length <= 18, true);
  screen.unmount();
});

test("short terminals keep compact detail and help within the row budget", async () => {
  const screen = render(<InteractiveApp initialModel={initializedModel()} services={fixtureServices(initializedModel())} dimensions={{ columns: 72, rows: 16 }} />);
  await tick();
  screen.stdin.write("\r");
  await tick();
  let frame = screen.lastFrame() ?? "";
  assert.match(frame, /BLOCKER/);
  assert.match(frame, /enter queue/);
  assert.equal(frame.split("\n").length <= 16, true);

  screen.stdin.write("?");
  await tick();
  frame = screen.lastFrame() ?? "";
  assert.match(frame, /KEYBOARD HELP/);
  assert.equal(frame.split("\n").length <= 16, true);
  screen.unmount();
});

test("guided start requires explicit scope and transitions in place", async () => {
  const ready = initializedModel();
  let submitted: string[] = [];
  const services = fixtureServices(ready, (classes) => {
    submitted = classes;
    return ready;
  });
  const screen = render(<InteractiveApp initialModel={uninitializedModel()} services={services} dimensions={{ columns: 88, rows: 28 }} />);
  screen.stdin.write("\r");
  await tick();
  assert.match(screen.lastFrame() ?? "", /At least one vulnerability class is required/);

  screen.stdin.write("xss, ssrf");
  await tick();
  screen.stdin.write("\r");
  await tick();
  await tick();
  assert.deepEqual(submitted, ["xss", "ssrf"]);
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  screen.unmount();
});

test("guided start remains editable and retryable after a service error", async () => {
  const ready = initializedModel();
  const submissions: string[][] = [];
  const services = fixtureServices(ready, (classes) => {
    submissions.push(classes);
    if (submissions.length === 1) throw new Error("campaign already exists");
    return ready;
  });
  const screen = render(<InteractiveApp initialModel={uninitializedModel()} services={services} dimensions={{ columns: 88, rows: 28 }} />);
  screen.stdin.write("xss");
  await tick();
  screen.stdin.write("\r");
  await tick();
  assert.match(screen.lastFrame() ?? "", /campaign already exists/);

  screen.stdin.write("\x7f");
  screen.stdin.write("s, ssrf");
  await tick();
  assert.doesNotMatch(screen.lastFrame() ?? "", /campaign already exists/);
  screen.stdin.write("\r");
  await tick();
  await tick();
  assert.deepEqual(submissions, [["xss"], ["xss", "ssrf"]]);
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  screen.unmount();
});

test("guided start keeps pasted scope when return arrives in the same input chunk", async () => {
  const ready = initializedModel();
  let submitted: string[] = [];
  const services = fixtureServices(ready, (classes) => {
    submitted = classes;
    return ready;
  });
  const screen = render(<InteractiveApp initialModel={uninitializedModel()} services={services} dimensions={{ columns: 88, rows: 28 }} />);
  screen.stdin.write("xss, ssrf\r");
  await tick();
  await tick();
  assert.deepEqual(submitted, ["xss", "ssrf"]);
  assert.match(screen.lastFrame() ?? "", /WORKFLOW QUEUE/);
  screen.unmount();
});

test("guided start preserves an inline-submitted scope after failure", async () => {
  const ready = initializedModel();
  let submitted: string[] = [];
  const services = fixtureServices(ready, (classes) => {
    submitted = classes;
    throw new Error("paste submission failed");
  });
  const screen = render(<InteractiveApp initialModel={uninitializedModel()} services={services} dimensions={{ columns: 88, rows: 28 }} />);
  screen.stdin.write("xss\r");
  await tick();
  await tick();
  assert.deepEqual(submitted, ["xss"]);
  assert.match(screen.lastFrame() ?? "", /› xss/);
  assert.match(screen.lastFrame() ?? "", /paste submission failed/);
  screen.unmount();
});

test("launcher enables alternate screen and always cleans up", async () => {
  assert.equal(interactiveRenderOptions({ alternateScreen: false }).alternateScreen, false);
  assert.equal(interactiveRenderOptions().alternateScreen, true);
  let cleaned = false;
  await assert.rejects(
    waitForInteractiveExit({
      waitUntilExit: () => Promise.reject(new Error("render failed")),
      cleanup: () => { cleaned = true; },
    }),
    /render failed/,
  );
  assert.equal(cleaned, true);
});

function initializedModel(): InteractiveWorkspaceModel {
  return {
    initialized: true,
    project: {
      root: "/tmp/demo",
      target: "demo-package",
      version: "1.2.3",
      source: "https://example.test/demo.git",
      ecosystem: "npm",
      manifest: "/tmp/demo/package.json",
      detectedFrom: ["package.json"],
      warnings: [],
    },
    status: {
      root: "/tmp/demo/.omv",
      findingsDir: "/tmp/demo/.omv/findings",
      archiveDir: "/tmp/demo/.omv/archive/findings",
      indexPath: "/tmp/demo/.omv/index.json",
      activeCount: 2,
      archivedCount: 0,
      statusCounts: { candidate: 1, blocked: 1 },
      staleIndex: false,
      warnings: [],
    },
    campaigns: [{
      id: "demo",
      title: "Research demo-package 1.2.3",
      status: "active",
      target: "demo-package",
      version: "1.2.3",
      laneCount: 2,
      nextAction: "omv campaign seed demo",
    }],
    findings: [candidate, blocked],
    activity: [
      { timestamp: "2026-07-10T23:50:00.000Z", action: "campaign.init", id: "demo", status: "active" },
      { timestamp: "2026-07-11T00:00:00.000Z", action: "finding.init", id: "demo-xss", status: "candidate" },
      { timestamp: "2026-07-11T00:05:00.000Z", action: "finding.promote", id: "demo-xss", from: "candidate", to: "candidate", reason: "fixture review" },
    ],
    loadedAt: "2026-07-11T00:00:00.000Z",
  };
}

function uninitializedModel(): InteractiveWorkspaceModel {
  const model = initializedModel();
  return { ...model, initialized: false, status: undefined, campaigns: [], findings: [] };
}

function fixtureServices(
  reloadModel: InteractiveWorkspaceModel,
  start: (classes: string[]) => InteractiveWorkspaceModel = () => reloadModel,
): InteractiveAppServices {
  return {
    reload: async () => reloadModel,
    loadFinding: async (id) => detail(id === candidate.id ? candidate : blocked),
    start: async (classes) => start(classes),
  };
}

function detail(summary: FindingWorkflowSummary): FindingDetail {
  return {
    ...summary,
    archived: false,
    validation: {
      id: summary.id,
      path: summary.path,
      ok: summary.status !== "blocked",
      status: summary.status,
      readiness: summary.readiness,
      evidenceScore: summary.evidenceScore,
      submissionScore: summary.submissionScore,
      errors: [],
      warnings: summary.blockers,
    },
    threatMap: summary.id === candidate.id ? {
      path: `/tmp/${summary.id}.threatmap.yaml`,
      rendered: [
        "PATH 1 · high confidence",
        "user input → parser → HTML sink",
        "GUARDS · encoding (bypassable)",
        "IMPACT · cross-site scripting",
      ],
      validation: {
        id: summary.id,
        path: `/tmp/${summary.id}.threatmap.yaml`,
        exists: true,
        ok: true,
        errors: [],
        warnings: [],
        rendered: [],
      },
    } : undefined,
  };
}

function finding(input: {
  id: string;
  status: string;
  vulnerability: string;
  blockers: string[];
  missingFields: string[];
  command: string;
  surface: "cli" | "claude";
}): FindingWorkflowSummary {
  return {
    id: input.id,
    path: `/tmp/${input.id}.yaml`,
    status: input.status,
    ecosystem: "npm",
    package: "demo-package",
    vulnerability: input.vulnerability,
    readiness: input.status === "blocked" ? 42 : 68,
    evidenceScore: input.status === "blocked" ? 55 : 72,
    submissionScore: input.status === "blocked" ? 20 : 48,
    verdict: { exploitability: "plausible", confidence: "medium", reason: "fixture" },
    reproArtifacts: [],
    nextAction: input.command,
    action: { surface: input.surface, command: input.command, reason: "Resolve the current lifecycle gate." },
    missingFields: input.missingFields,
    blockers: input.blockers,
    priority: input.status === "blocked" ? 10 : 70,
    priorityReason: input.status === "blocked" ? "blocked finding can be archived" : "audit evidence still missing",
  };
}

function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}
