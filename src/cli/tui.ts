import pc from "picocolors";
import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";

const ANSI_RE = /\u001b\[[0-9;]*m/g;
const color = pc.createColors(shouldColor());

type Outcome = "pass" | "warn" | "fail" | "installed" | "skipped" | "error" | "planned";
type ColorName = "red" | "green" | "yellow" | "cyan" | "gray";

export function title(text: string): string {
  return color.bold(color.cyan(`\n◆ ${text}`));
}

export function empty(text: string): string {
  return panel("oh-my-vul", [muted(text)]);
}

export function panel(heading: string, lines: string[]): string {
  const maxWidth = terminalWidth();
  const width = Math.min(maxWidth, Math.max(48, widestLine([heading, ...lines]) + 4));
  const contentWidth = width - 4;
  const content = lines.flatMap((line) => wrapAnsi(line, contentWidth, { hard: true }).split("\n"));
  const headingLabel = truncate(` ${heading} `, width - 2);
  const top = `╭${headingLabel}${"─".repeat(Math.max(0, width - 2 - stringWidth(headingLabel)))}╮`;
  const bottom = `╰${"─".repeat(width - 2)}╯`;
  const body = content.map((line) => `│ ${pad(line, contentWidth)} │`);
  return [paintBorder(top), ...body, paintBorder(bottom)].join("\n");
}

export function kv(rows: Array<[string, string]>): string[] {
  const width = Math.max(...rows.map(([key]) => stringWidth(key)), 1);
  return rows.map(([key, value]) => `${muted(pad(key, width))}  ${value}`);
}

export function table(headers: string[], rows: string[][]): string {
  const normalizedRows = rows.map((row) => headers.map((_, index) => row[index] ?? ""));
  const widths = columnWidths(headers, normalizedRows, terminalWidth());
  const border = (left: string, middle: string, right: string) => paintBorder(
    `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`,
  );
  const renderRow = (cells: string[]) => {
    const wrapped = cells.map((cell, index) => wrapAnsi(cell, widths[index], { hard: true }).split("\n"));
    const height = Math.max(...wrapped.map((cell) => cell.length), 1);
    return Array.from({ length: height }, (_, line) => paintBorder("│")
      + wrapped.map((cell, index) => ` ${pad(cell[line] ?? "", widths[index])} `).join(paintBorder("│"))
      + paintBorder("│"));
  };

  return [
    border("╭", "┬", "╮"),
    ...renderRow(headers.map((header) => color.bold(header))),
    border("├", "┼", "┤"),
    ...normalizedRows.flatMap(renderRow),
    border("╰", "┴", "╯"),
  ].join("\n");
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
  if (status === "planned") return badge(status, "cyan");
  if (status === "warn" || status === "skipped") return badge(status, "yellow");
  return badge(status, "red");
}

export function statusIcon(status: Outcome): string {
  if (status === "pass" || status === "installed") return color.green("✓");
  if (status === "planned") return color.cyan("·");
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

function paintBorder(value: string): string {
  return shouldColor() ? color.cyan(value) : value;
}

function columnWidths(headers: string[], rows: string[][], maxWidth: number): number[] {
  const widths = headers.map((header, index) => Math.max(
    1,
    stringWidth(header),
    ...rows.map((row) => stringWidth(row[index] ?? "")),
  ));
  const available = Math.max(headers.length, maxWidth - (headers.length * 3 + 1));
  while (widths.reduce((sum, width) => sum + width, 0) > available) {
    const widest = widths.reduce((best, width, index) => width > widths[best] ? index : best, 0);
    if (widths[widest] <= 1) break;
    widths[widest] -= 1;
  }
  return widths;
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
