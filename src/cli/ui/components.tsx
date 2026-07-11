import { Box, Text } from "ink";
import type { ReactNode } from "react";
import { fitText } from "./format.js";
import { statusColor, theme } from "./theme.js";

export function Header(props: {
  target: string;
  version?: string;
  ecosystem: string;
  width: number;
}): ReactNode {
  const compact = props.width < 72;
  const projectLabel = `${props.target}@${props.version ?? "unknown"} · ${props.ecosystem}`;
  return (
    <Box flexDirection={compact ? "column" : "row"} justifyContent="space-between" paddingX={1}>
      <Box>
        <Text bold color={theme.accent}>OH MY VUL</Text>
        <Text color={theme.muted}>  evidence workspace</Text>
      </Box>
      <Text color={theme.foreground}>{fitText(projectLabel, compact ? Math.max(1, props.width - 2) : 44)}</Text>
    </Box>
  );
}

export function Metrics(props: {
  campaigns: number;
  findings: number;
  confirmed: number;
  candidates: number;
  blocked: number;
  compact?: boolean;
}): ReactNode {
  if (props.compact) {
    return (
      <Box paddingX={1} flexDirection="column">
        <Box gap={2}>
          <Metric label="CAMPAIGNS" value={props.campaigns} color={theme.info} />
          <Metric label="FINDINGS" value={props.findings} color={theme.foreground} />
          <Metric label="CONFIRMED" value={props.confirmed} color={theme.success} />
        </Box>
        <Box gap={2}>
          <Metric label="CANDIDATE" value={props.candidates} color={theme.warning} />
          <Metric label="BLOCKED" value={props.blocked} color={theme.danger} />
        </Box>
      </Box>
    );
  }
  return (
    <Box paddingX={1} gap={3} flexWrap="wrap">
      <Metric label="CAMPAIGNS" value={props.campaigns} color={theme.info} />
      <Metric label="FINDINGS" value={props.findings} color={theme.foreground} />
      <Metric label="CONFIRMED" value={props.confirmed} color={theme.success} />
      <Metric label="CANDIDATE" value={props.candidates} color={theme.warning} />
      <Metric label="BLOCKED" value={props.blocked} color={theme.danger} />
    </Box>
  );
}

function Metric(props: { label: string; value: number; color: string }): ReactNode {
  return (
    <Text>
      <Text color={theme.muted}>{props.label} </Text>
      <Text bold color={props.color}>{props.value}</Text>
    </Text>
  );
}

export function StatusBadge({ status }: { status: string }): ReactNode {
  return <Text bold color={statusColor(status)}>{status.toUpperCase()}</Text>;
}

export function Meter({ value, width = 10 }: { value: number; width?: number }): ReactNode {
  const bounded = Math.max(0, Math.min(100, value));
  const filled = Math.round((bounded / 100) * width);
  const color = bounded >= 75 ? theme.success : bounded >= 50 ? theme.warning : theme.danger;
  return (
    <Text>
      <Text color={color}>{"█".repeat(filled)}</Text>
      <Text color={theme.muted}>{"░".repeat(width - filled)}</Text>
      <Text color={theme.muted}> {String(bounded).padStart(3)}</Text>
    </Text>
  );
}

export function SectionTitle({ children }: { children: ReactNode }): ReactNode {
  return <Text bold color={theme.foreground}>{children}</Text>;
}

export function CommandLine(props: {
  surface: "cli" | "claude";
  command: string;
  reason?: string;
  compact?: boolean;
  width?: number;
}): ReactNode {
  if (props.compact) {
    const command = props.width ? fitText(props.command, Math.max(12, props.width - 10)) : props.command;
    const reason = props.reason && props.width ? fitText(props.reason, Math.max(12, props.width - 4)) : props.reason;
    return (
      <Box flexDirection="column">
        <Text>
          <Text color={theme.muted}>└─ </Text>
          <Text bold color={props.surface === "claude" ? theme.info : theme.accent}>{props.surface === "claude" ? "SKILL" : "CLI"}</Text>
          <Text color={theme.foreground}>  {command}</Text>
        </Text>
        {reason ? <Text color={theme.muted}>   {reason}</Text> : null}
      </Box>
    );
  }
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={props.surface === "claude" ? theme.info : theme.accent} paddingX={1}>
      <Text>
        <Text bold color={props.surface === "claude" ? theme.info : theme.accent}>{props.surface === "claude" ? "SKILL" : "CLI"}</Text>
        <Text color={theme.foreground}>  {props.command}</Text>
      </Text>
      {props.reason ? <Text color={theme.muted}>{props.reason}</Text> : null}
    </Box>
  );
}

export function Notice(props: {
  tone?: "info" | "warning" | "error";
  children: ReactNode;
}): ReactNode {
  const color = props.tone === "error" ? theme.danger : props.tone === "warning" ? theme.warning : theme.info;
  return (
    <Box paddingX={1}>
      <Text color={color}>{props.tone === "error" ? "ERROR" : props.tone === "warning" ? "NOTE" : "INFO"}</Text>
      <Text color={theme.foreground}>  {props.children}</Text>
    </Box>
  );
}

export function Footer({
  searching,
  narrow,
  narrowView,
  view,
  detailTab,
  width,
}: {
  searching: boolean;
  narrow: boolean;
  narrowView?: "queue" | "detail";
  view: "overview" | "findings" | "campaign" | "activity";
  detailTab: "summary" | "evidence" | "threat" | "history";
  width: number;
}): ReactNode {
  if (narrow) {
    const destination = narrowView === "detail" ? "queue" : "detail";
    const defaultHint = view === "findings"
      ? width < 72
        ? `↑↓ · enter ${destination} · Space full · : · q`
        : `↑↓ · enter ${destination} · [ ] ${detailTab} · Space full · Tab · : · q`
      : view === "activity"
        ? "j/k · Pg · g/G · Space full · Tab · : · q"
        : "tab views · 1-4 jump · : commands · ? help · q quit";
    return (
      <Box paddingX={1}>
        <Text color={theme.muted}>
          {searching
            ? "type filter · enter apply · esc clear"
            : defaultHint}
        </Text>
      </Box>
    );
  }
  return (
    <Box paddingX={1} justifyContent="space-between">
      <Text color={theme.muted}>
        {searching
          ? "type to filter · enter apply · esc cancel"
          : view === "findings"
            ? `↑↓/jk move · / search · f filters · [ ] ${detailTab} · Space full · a action`
            : view === "campaign"
              ? "↑↓/jk campaign · tab views · 1-4 jump · r refresh"
              : view === "activity"
                ? "↑↓/jk select · PgUp/PgDn · g/G · Space full"
                : "tab views · 1-4 jump · r refresh"}
      </Text>
      <Text color={theme.muted}>: commands · ? help · q quit</Text>
    </Box>
  );
}
