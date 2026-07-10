import { commandUsage } from "../usage.js";
import { firstPositionalAfter, parseOption, wantsJson } from "./shared.js";
import { table, title } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "timeline";
  const json = wantsJson(args);
  if (subcommand !== "timeline") {
    console.error(`Unknown disclose command: ${subcommand}\n`);
    commandUsage("disclose", args[1]);
    process.exit(1);
  }
  const id = firstPositionalAfter(args, "timeline");
  if (!id) {
    console.error("Missing finding id.");
    process.exit(1);
  }
  const result = disclosureTimeline(id, Number(parseOption(args, "--days") ?? "90"));
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  printDisclosureTimeline(result);
}

function disclosureTimeline(id: string, days: number): { id: string; days: number; milestones: { name: string; date: string }[] } {
  if (!Number.isInteger(days) || days <= 0) {
    throw new Error("--days must be a positive integer");
  }
  const start = new Date();
  const addDays = (count: number) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
  };
  return {
    id,
    days,
    milestones: [
      { name: "initial contact", date: addDays(0) },
      { name: "follow-up", date: addDays(Math.min(45, Math.max(1, Math.floor(days / 2)))) },
      { name: "7-day reminder", date: addDays(Math.max(0, days - 7)) },
      { name: "planned disclosure", date: addDays(days) },
    ],
  };
}

function printDisclosureTimeline(result: { id: string; days: number; milestones: { name: string; date: string }[] }): void {
  console.log(title(`disclosure ${result.id}`));
  console.log(table(["milestone", "date"], result.milestones.map((item) => [item.name, item.date])));
}
