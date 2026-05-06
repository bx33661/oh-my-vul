import { existsSync } from "fs";
import { appendFile, mkdir, readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { packageRoot, radarDir, radarEventsPath, radarWatchlistPath } from "./paths.js";
import { appendWorkspaceActivity, ensureWorkspaceDirs } from "./workspace.js";

export interface RadarWatchEntry {
  ecosystem: string;
  package?: string;
  keyword?: string;
  vulnerability?: string;
}

export interface RadarEvent {
  id: string;
  observedAt: string;
  source: string;
  ecosystem: string;
  package?: string;
  keyword?: string;
  type: "advisory" | "release" | "suspected-fix" | "watchlist";
  title: string;
  url?: string;
  severity?: string;
  publishedAt?: string;
}

export interface RadarRefreshResult {
  watchlistPath: string;
  eventsPath: string;
  dryRun: boolean;
  events: RadarEvent[];
  sources: string[];
}

export interface RadarBrief {
  eventsPath: string;
  eventCount: number;
  groups: RadarBriefGroup[];
}

export interface RadarBriefGroup {
  ecosystem: string;
  package: string;
  advisory: number;
  release: number;
  suspectedFix: number;
  watchlist: number;
  titles: string[];
}

export async function refreshRadar(options: { dryRun?: boolean; projectRoot?: string } = {}): Promise<RadarRefreshResult> {
  const projectRoot = options.projectRoot ?? process.cwd();
  await ensureWorkspaceDirs(projectRoot);
  await mkdir(radarDir(projectRoot), { recursive: true });
  const watchlistPath = radarWatchlistPath(projectRoot);
  if (!existsSync(watchlistPath)) {
    throw new Error(`${watchlistPath} does not exist; create .omv/radar/watchlist.yaml before refreshing radar`);
  }
  const watchlist = await readWatchlist(watchlistPath);
  const observedAt = new Date().toISOString();
  const events = options.dryRun
    ? await readFixtureEvents(observedAt)
    : watchlist.map((entry, index) => watchEntryEvent(entry, index, observedAt));
  const eventsPath = radarEventsPath(projectRoot);
  if (!options.dryRun && events.length > 0) {
    await appendFile(eventsPath, events.map((event) => JSON.stringify(event)).join("\n") + "\n", "utf-8");
    await appendWorkspaceActivity({ action: "radar.refresh", path: eventsPath }, projectRoot);
  }
  return {
    watchlistPath,
    eventsPath,
    dryRun: Boolean(options.dryRun),
    events,
    sources: options.dryRun ? ["fixture:nvd", "fixture:ghsa", "fixture:osv", "fixture:registry"] : ["watchlist"],
  };
}

export async function radarBrief(projectRoot = process.cwd()): Promise<RadarBrief> {
  const eventsPath = radarEventsPath(projectRoot);
  const events = existsSync(eventsPath) ? parseEvents(await readFile(eventsPath, "utf-8")) : [];
  const groups = new Map<string, RadarBriefGroup>();
  for (const event of events) {
    const pkg = event.package ?? event.keyword ?? "unknown";
    const key = `${event.ecosystem}:${pkg}`;
    const current = groups.get(key) ?? {
      ecosystem: event.ecosystem,
      package: pkg,
      advisory: 0,
      release: 0,
      suspectedFix: 0,
      watchlist: 0,
      titles: [],
    };
    if (event.type === "advisory") current.advisory += 1;
    if (event.type === "release") current.release += 1;
    if (event.type === "suspected-fix") current.suspectedFix += 1;
    if (event.type === "watchlist") current.watchlist += 1;
    if (current.titles.length < 3) current.titles.push(event.title);
    groups.set(key, current);
  }
  return {
    eventsPath,
    eventCount: events.length,
    groups: Array.from(groups.values()).sort((left, right) => left.ecosystem.localeCompare(right.ecosystem) || left.package.localeCompare(right.package)),
  };
}

async function readWatchlist(path: string): Promise<RadarWatchEntry[]> {
  const parsed = parseYaml(await readFile(path, "utf-8"));
  const rawEntries = isRecord(parsed) && Array.isArray(parsed.watch)
    ? parsed.watch
    : Array.isArray(parsed)
      ? parsed
      : [];
  const entries = rawEntries.filter(isRecord).map((entry) => ({
    ecosystem: stringValue(entry.ecosystem) || "unknown",
    package: stringValue(entry.package),
    keyword: stringValue(entry.keyword),
    vulnerability: stringValue(entry.vulnerability),
  }));
  if (entries.length === 0) {
    throw new Error(`${path} must contain at least one watch entry`);
  }
  return entries;
}

async function readFixtureEvents(observedAt: string): Promise<RadarEvent[]> {
  const path = `${packageRoot()}/shared/fixtures/radar/events.jsonl`;
  const text = await readFile(path, "utf-8");
  return parseEvents(text).map((event, index) => ({ ...event, id: event.id || `fixture-${index + 1}`, observedAt }));
}

function parseEvents(text: string): RadarEvent[] {
  const events: RadarEvent[] = [];
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      const parsed = JSON.parse(line) as Partial<RadarEvent>;
      events.push({
        id: parsed.id ?? "",
        observedAt: parsed.observedAt ?? "",
        source: parsed.source ?? "unknown",
        ecosystem: parsed.ecosystem ?? "unknown",
        package: parsed.package,
        keyword: parsed.keyword,
        type: parsed.type ?? "watchlist",
        title: parsed.title ?? "untitled radar event",
        url: parsed.url,
        severity: parsed.severity,
        publishedAt: parsed.publishedAt,
      });
    } catch {
      // Ignore malformed manual edits in local JSONL state.
    }
  }
  return events;
}

function watchEntryEvent(entry: RadarWatchEntry, index: number, observedAt: string): RadarEvent {
  const subject = entry.package ?? entry.keyword ?? entry.vulnerability ?? "watch entry";
  return {
    id: `watchlist-${Date.parse(observedAt)}-${index + 1}`,
    observedAt,
    source: "watchlist",
    ecosystem: entry.ecosystem,
    package: entry.package,
    keyword: entry.keyword,
    type: "watchlist",
    title: `Watchlist snapshot for ${entry.ecosystem}:${subject}`,
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
