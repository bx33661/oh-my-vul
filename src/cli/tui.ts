import boxen from "boxen";
import Table from "cli-table3";
import pc from "picocolors";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";

const ANSI_RE = /\u001b\[[0-9;]*m/g;
const color = pc.createColors(shouldColor());

type Outcome = "pass" | "warn" | "fail" | "installed" | "skipped" | "error";
type ColorName = "red" | "green" | "yellow" | "cyan" | "gray";

export function title(text: string): string {
  return color.bold(color.cyan(`\n◆ ${text}`));
}

export function empty(text: string): string {
  return panel("oh-my-vul", [muted(text)]);
}

export function panel(heading: string, lines: string[]): string {
  const maxWidth = terminalWidth();
  const content = lines
    .flatMap((line) => wrapAnsi(line, maxWidth - 6, { hard: true }).split("\n"))
    .join("\n");
  return boxen(content, {
    title: ` ${heading} `,
    padding: { top: 0, bottom: 0, left: 1, right: 1 },
    borderStyle: "round",
    borderColor: shouldColor() ? "cyan" : undefined,
    width: Math.min(maxWidth, Math.max(48, widestLine([heading, content]) + 4)),
  });
}

export function kv(rows: Array<[string, string]>): string[] {
  const width = Math.max(...rows.map(([key]) => stringWidth(key)), 1);
  return rows.map(([key, value]) => `${muted(pad(key, width))}  ${value}`);
}

export function table(headers: string[], rows: string[][]): string {
  const instance = new Table({
    head: headers.map((header) => color.bold(header)),
    chars: {
      top: "─",
      "top-mid": "┬",
      "top-left": "╭",
      "top-right": "╮",
      bottom: "─",
      "bottom-mid": "┴",
      "bottom-left": "╰",
      "bottom-right": "╯",
      left: "│",
      "left-mid": "├",
      mid: "─",
      "mid-mid": "┼",
      right: "│",
      "right-mid": "┤",
      middle: "│",
    },
    style: {
      head: [],
      border: shouldColor() ? ["cyan"] : [],
      compact: true,
    },
    wordWrap: true,
    wrapOnWordBoundary: false,
  });
  instance.push(...rows);
  return instance.toString();
}

export function statusBadge(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "confirmed") return badge(status, "green");
  if (normalized === "blocked") return badge(status, "red");
  if (normalized === "candidate") return badge(status, "yellow");
  return badge(status, "gray");
}

export function validationBadge(ok: boolean): string {
  return ok ? badge("OK", "green") : badge("FAIL", "red");
}

export function outcomeBadge(status: Outcome): string {
  if (status === "pass" || status === "installed") return badge(status, "green");
  if (status === "warn" || status === "skipped") return badge(status, "yellow");
  return badge(status, "red");
}

export function statusIcon(status: Outcome): string {
  if (status === "pass" || status === "installed") return color.green("✓");
  if (status === "warn" || status === "skipped") return color.yellow("!");
  return color.red("✗");
}

export function section(text: string): string {
  return color.bold(text);
}

export function readiness(value: number): string {
  const bounded = Math.max(0, Math.min(100, value));
  const filled = Math.round(bounded / 10);
  const bar = `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
  const painted = bounded >= 75 ? color.green(bar) : bounded >= 50 ? color.yellow(bar) : color.red(bar);
  return `${painted} ${String(bounded).padStart(3)}/100`;
}

export function command(text: string): string {
  return color.cyan(text);
}

export function muted(text: string): string {
  return color.gray(text);
}

export function warn(text: string): string {
  return color.yellow(text);
}

export function error(text: string): string {
  return color.red(text);
}

export function truncate(value: string, maxLength: number): string {
  if (stringWidth(value) <= maxLength) {
    return value;
  }
  const plain = value.replace(ANSI_RE, "");
  let output = "";
  for (const char of plain) {
    if (stringWidth(`${output}${char}…`) > maxLength) {
      break;
    }
    output += char;
  }
  return `${output}…`;
}

function badge(text: string, colorName: ColorName): string {
  const value = ` ${text} `;
  switch (colorName) {
    case "green":
      return color.green(value);
    case "red":
      return color.red(value);
    case "yellow":
      return color.yellow(value);
    case "cyan":
      return color.cyan(value);
    case "gray":
      return color.gray(value);
  }
}

function pad(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - stringWidth(value)))}`;
}

function widestLine(lines: string[]): number {
  return Math.max(...lines.flatMap((line) => line.split("\n")).map((line) => stringWidth(line)), 0);
}

function terminalWidth(): number {
  return Math.max(48, Math.min(process.stdout.columns ? process.stdout.columns - 4 : 100, 120));
}

function shouldColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined && process.env.OMV_NO_COLOR === undefined;
}
