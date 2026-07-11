import stringWidth from "string-width";
import wrapAnsi from "wrap-ansi";

export function fitText(value: string, width: number): string {
  if (width <= 0) return "";
  if (stringWidth(value) <= width) return value;
  if (width === 1) return "…";
  let output = "";
  for (const character of value) {
    if (stringWidth(`${output}${character}…`) > width) break;
    output += character;
  }
  return `${output}…`;
}

export function windowAround<T>(items: readonly T[], selectedIndex: number, size: number): T[] {
  if (size <= 0 || items.length <= size) return items.slice(0, Math.max(0, size));
  const half = Math.floor(size / 2);
  const start = Math.max(0, Math.min(selectedIndex - half, items.length - size));
  return items.slice(start, start + size);
}

export function normalizedTerms(value: string): string[] {
  return value.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

export function wrapText(value: string, width: number): string[] {
  if (width <= 0) return [""];
  return wrapAnsi(value, width, { hard: true, trim: false, wordWrap: true }).split("\n");
}
