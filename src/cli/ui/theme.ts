export const theme = {
  accent: "cyan",
  foreground: "white",
  muted: "gray",
  success: "green",
  warning: "yellow",
  danger: "red",
  info: "blue",
} as const;

export function statusColor(status: string): string {
  if (status === "confirmed" || status === "ready" || status === "pass") return theme.success;
  if (status === "blocked" || status === "fail" || status === "error") return theme.danger;
  if (status === "candidate" || status === "warn") return theme.warning;
  return theme.muted;
}
