const ANSI_RE = /\u001b\[[0-9;]*m/g;

const COLOR = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  blue: "\u001b[34m",
  cyan: "\u001b[36m",
  gray: "\u001b[90m",
};

export function title(text: string): string {
  return style(`\n${text}`, "bold", "cyan");
}

export function empty(text: string): string {
  return panel("oh-my-vul", [muted(text)]);
}

export function panel(heading: string, lines: string[]): string {
  const maxWidth = Math.max(48, Math.min(process.stdout.columns ? process.stdout.columns - 4 : 100, 120));
  const wrapped = lines.flatMap((line) => wrapLine(line, maxWidth));
  const width = Math.min(maxWidth, Math.max(visibleLength(heading), ...wrapped.map(visibleLength), 12));
  const top = `╭─ ${heading} ${"─".repeat(Math.max(0, width - visibleLength(heading) - 1))}╮`;
  const body = wrapped.map((line) => `│ ${line}${" ".repeat(width - visibleLength(line))} │`);
  const bottom = `╰${"─".repeat(width + 2)}╯`;
  return [top, ...body, bottom].join("\n");
}

export function kv(rows: Array<[string, string]>): string[] {
  const width = Math.max(...rows.map(([key]) => key.length), 1);
  return rows.map(([key, value]) => `${muted(key.padEnd(width))}  ${value}`);
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(
      visibleLength(header),
      ...rows.map((row) => visibleLength(row[index] ?? "")),
    ),
  );
  const top = `╭${widths.map((width) => "─".repeat(width + 2)).join("┬")}╮`;
  const head = `│ ${headers.map((header, index) => style(pad(header, widths[index]), "bold")).join(" │ ")} │`;
  const sep = `├${widths.map((width) => "─".repeat(width + 2)).join("┼")}┤`;
  const body = rows.map((row) => `│ ${row.map((cell, index) => pad(cell ?? "", widths[index])).join(" │ ")} │`);
  const bottom = `╰${widths.map((width) => "─".repeat(width + 2)).join("┴")}╯`;
  return [top, head, sep, ...body, bottom].join("\n");
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

export function readiness(value: number): string {
  const bounded = Math.max(0, Math.min(100, value));
  const filled = Math.round(bounded / 10);
  const bar = `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
  const color = bounded >= 75 ? "green" : bounded >= 50 ? "yellow" : "red";
  return `${style(bar, color)} ${String(bounded).padStart(3)}/100`;
}

export function command(text: string): string {
  return style(text, "cyan");
}

export function muted(text: string): string {
  return style(text, "gray");
}

export function warn(text: string): string {
  return style(text, "yellow");
}

export function error(text: string): string {
  return style(text, "red");
}

export function truncate(value: string, maxLength: number): string {
  if (visibleLength(value) <= maxLength) {
    return value;
  }
  const plain = value.replace(ANSI_RE, "");
  return `${plain.slice(0, Math.max(0, maxLength - 1))}…`;
}

function badge(text: string, color: keyof typeof COLOR): string {
  return style(` ${text} `, color);
}

function pad(value: string, width: number): string {
  return `${value}${" ".repeat(Math.max(0, width - visibleLength(value)))}`;
}

function visibleLength(value: string): number {
  return value.replace(ANSI_RE, "").length;
}

function wrapLine(line: string, width: number): string[] {
  if (visibleLength(line) <= width) {
    return [line];
  }
  const plain = line.replace(ANSI_RE, "");
  const indent = plain.match(/^\s*/)?.[0] ?? "";
  const words = plain.trimEnd().split(/(\s+)/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && visibleLength(current + word) > width) {
      lines.push(current.trimEnd());
      current = indent + word.trimStart();
      continue;
    }
    current += word;
    while (visibleLength(current) > width) {
      lines.push(current.slice(0, width));
      current = indent + current.slice(width);
    }
  }
  if (current) {
    lines.push(current.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
}

function style(text: string, ...styles: Array<keyof typeof COLOR>): string {
  if (!shouldColor()) {
    return text;
  }
  return `${styles.map((name) => COLOR[name]).join("")}${text}${COLOR.reset}`;
}

function shouldColor(): boolean {
  return Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined && process.env.OMV_NO_COLOR === undefined;
}
