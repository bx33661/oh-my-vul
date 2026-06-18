import { radarBrief, refreshRadar, type RadarBrief, type RadarRefreshResult } from "../radar.js";
import { radarUsage } from "../usage.js";
import { wantsJson } from "./shared.js";
import { command as cmd, empty, kv, muted, panel, table, title, truncate } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "brief";
  const json = wantsJson(args);
  switch (subcommand) {
    case "refresh": {
      const result = await refreshRadar({ dryRun: args.includes("--dry-run") });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printRadarRefresh(result);
      return;
    }
    case "brief": {
      const result = await radarBrief();
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printRadarBrief(result);
      return;
    }
    default:
      console.error(`Unknown radar command: ${subcommand}\n`);
      radarUsage(undefined);
      process.exit(1);
  }
}

function printRadarRefresh(result: RadarRefreshResult): void {
  console.log(
    panel("radar refresh", [
      ...kv([
        ["watchlist", result.watchlistPath],
        ["events", result.dryRun ? "dry-run only" : result.eventsPath],
        ["sources", result.sources.join(", ")],
        ["count", String(result.events.length)],
        ["next", cmd("omv radar brief")],
      ]),
      ...result.events.slice(0, 8).map((event) => `${event.ecosystem}:${event.package ?? event.keyword ?? "-"} ${event.type} ${event.title}`),
    ]),
  );
  if (!result.dryRun) {
    console.log(muted("schedule offer  Ask me to create a weekly Monday radar refresh if you want this automated."));
  }
}

function printRadarBrief(result: RadarBrief): void {
  if (result.eventCount === 0) {
    console.log(empty("No radar events. Run omv radar refresh first."));
    return;
  }
  console.log(title("radar brief"));
  console.log(
    table(
      ["ecosystem", "package", "advisory", "release", "fix", "watch", "signals"],
      result.groups.map((group) => [
        group.ecosystem,
        truncate(group.package, 28),
        String(group.advisory),
        String(group.release),
        String(group.suspectedFix),
        String(group.watchlist),
        truncate(group.titles.join("; "), 52),
      ]),
    ),
  );
}
