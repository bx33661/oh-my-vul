import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { CampaignSummary } from "../campaign.js";
import type { WorkspaceActivityEntry } from "../workspace.js";
import { CommandLine, Metrics, SectionTitle, StatusBadge } from "./components.js";
import { fitText, windowAround, wrapText } from "./format.js";
import type { InteractiveWorkspaceModel } from "./model.js";
import { theme } from "./theme.js";

export type WorkspaceView = "overview" | "findings" | "campaign" | "activity";

export const WORKSPACE_VIEWS: ReadonlyArray<{ id: WorkspaceView; label: string; key: string }> = [
  { id: "overview", label: "OVERVIEW", key: "1" },
  { id: "findings", label: "FINDINGS", key: "2" },
  { id: "campaign", label: "CAMPAIGN", key: "3" },
  { id: "activity", label: "ACTIVITY", key: "4" },
];

export type FindingFilterStatus = "all" | "candidate" | "confirmed" | "blocked";
export type FindingFilterSurface = "all" | "cli" | "claude";

export interface FindingFilter {
  status: FindingFilterStatus;
  surface: FindingFilterSurface;
}

export const DEFAULT_FINDING_FILTER: FindingFilter = { status: "all", surface: "all" };
export const FILTER_STATUSES: FindingFilterStatus[] = ["all", "candidate", "confirmed", "blocked"];
export const FILTER_SURFACES: FindingFilterSurface[] = ["all", "cli", "claude"];

export type PaletteCommand =
  | "overview"
  | "findings"
  | "campaign"
  | "activity"
  | "refresh"
  | "show-action"
  | "clear-filters"
  | "help";

export const PALETTE_COMMANDS: ReadonlyArray<{ id: PaletteCommand; label: string; description: string }> = [
  { id: "overview", label: "Go to Overview", description: "Workspace health and next priority" },
  { id: "findings", label: "Go to Findings", description: "Open the workflow queue" },
  { id: "campaign", label: "Go to Campaign", description: "Review campaign scope and lanes" },
  { id: "activity", label: "Go to Activity", description: "Inspect recent local changes" },
  { id: "refresh", label: "Refresh workspace", description: "Reload local research state" },
  { id: "show-action", label: "Show selected action", description: "Reveal the action reason without executing" },
  { id: "clear-filters", label: "Clear finding filters", description: "Reset text, status, and surface filters" },
  { id: "help", label: "Open keyboard help", description: "Show all workspace shortcuts" },
];

export function WorkspaceNavigation({ active, width }: { active: WorkspaceView; width: number }): ReactNode {
  const compact = width < 72;
  return (
    <Box paddingX={1} gap={compact ? 1 : 2}>
      {WORKSPACE_VIEWS.map((view) => {
        const selected = view.id === active;
        const label = compact ? `${view.key}:${view.label.slice(0, 4)}` : `${view.key} ${view.label}`;
        return (
          <Text key={view.id} bold={selected} inverse={selected} color={selected ? theme.accent : theme.muted}>
            {` ${label} `}
          </Text>
        );
      })}
    </Box>
  );
}

export function OverviewView(props: {
  model: InteractiveWorkspaceModel;
  width: number;
  height: number;
}): ReactNode {
  const statuses = props.model.status?.statusCounts ?? {};
  const compact = props.height < 24 || props.width < 72;
  const short = props.height < 20;
  const campaign = props.model.campaigns[0];
  const priority = props.model.findings[0];
  const recent = props.model.activity.at(-1);
  const campaignWidth = compact ? props.width - 2 : Math.floor((props.width - 3) * 0.43);
  const priorityWidth = compact ? props.width - 2 : Math.ceil((props.width - 3) * 0.57);
  return (
    <Box flexDirection="column" width={props.width}>
      <Metrics
        campaigns={props.model.campaigns.length}
        findings={props.model.findings.length}
        confirmed={statuses.confirmed ?? 0}
        candidates={statuses.candidate ?? 0}
        blocked={statuses.blocked ?? 0}
        compact={props.width < 72}
      />
      {short ? (
        <Box paddingX={1}>
          <Text color={theme.muted}>CAMPAIGN  </Text>
          <Text color={theme.foreground}>{campaign ? fitText(`${campaign.id} · ${campaign.laneCount} lanes`, Math.max(8, props.width - 12)) : "none"}</Text>
        </Box>
      ) : null}
      <Box paddingX={1} gap={1} flexDirection={compact ? "column" : "row"}>
        {!short ? <Box flexDirection="column" borderStyle="round" borderColor={theme.muted} paddingX={1} width={campaignWidth}>
          <SectionTitle>CURRENT CAMPAIGN</SectionTitle>
          {campaign ? (
            <>
              <Text bold color={theme.foreground}>{fitText(campaign.id, Math.max(8, campaignWidth - 4))}</Text>
              <Text color={theme.muted}>{fitText(`${campaign.target}@${campaign.version} · ${campaign.laneCount} lanes`, Math.max(8, campaignWidth - 4))}</Text>
              {!compact ? <CommandLine surface="cli" command={campaign.nextAction} compact width={Math.max(12, campaignWidth - 4)} /> : null}
            </>
          ) : <Text color={theme.muted}>No active campaign.</Text>}
        </Box> : null}
        <Box flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1} width={priorityWidth}>
          <SectionTitle>NEXT PRIORITY</SectionTitle>
          {priority ? (
            <>
              <Box justifyContent="space-between">
                <Text bold color={theme.foreground}>{fitText(priority.id, Math.max(8, priorityWidth - 18))}</Text>
                <StatusBadge status={priority.status} />
              </Box>
              {!short ? <Text color={theme.muted}>{fitText(`${priority.vulnerability} · score ${priority.submissionScore}`, Math.max(8, priorityWidth - 4))}</Text> : null}
              <Text color={theme.warning}>{fitText(priority.blockers[0] ?? "No current blocker", Math.max(8, priorityWidth - 4))}</Text>
              {!compact ? <CommandLine surface={priority.action.surface} command={priority.action.command} compact width={Math.max(12, priorityWidth - 4)} /> : null}
            </>
          ) : <Text color={theme.muted}>No active findings.</Text>}
        </Box>
      </Box>
      <Box paddingX={1}>
        <Text color={theme.muted}>RECENT  </Text>
        <Text color={theme.foreground}>{recent ? fitText(activityLabel(recent), Math.max(8, props.width - 10)) : "No recorded workspace activity."}</Text>
      </Box>
    </Box>
  );
}

export function CampaignView(props: {
  campaigns: CampaignSummary[];
  selectedId?: string;
  width: number;
  height: number;
}): ReactNode {
  const selectedIndex = Math.max(0, props.campaigns.findIndex((campaign) => campaign.id === props.selectedId));
  const visible = windowAround(props.campaigns, selectedIndex, Math.max(1, props.height - 14));
  const selected = props.campaigns.find((campaign) => campaign.id === props.selectedId) ?? props.campaigns[0];
  if (!selected) {
    return (
      <Box marginX={1} borderStyle="round" borderColor={theme.muted} paddingX={1} flexDirection="column">
        <SectionTitle>CAMPAIGNS</SectionTitle>
        <Text color={theme.muted}>No campaign is initialized in this workspace.</Text>
      </Box>
    );
  }
  const narrow = props.width < 100;
  const compact = props.height < 22;
  const listWidth = narrow ? props.width - 2 : Math.floor((props.width - 3) * 0.42);
  const detailWidth = narrow ? props.width - 2 : Math.ceil((props.width - 3) * 0.58);
  const list = (
    <Box width={listWidth} borderStyle="round" borderColor={theme.muted} paddingX={1} flexDirection="column">
      <Box justifyContent="space-between"><SectionTitle>CAMPAIGNS</SectionTitle><Text color={theme.muted}>{props.campaigns.length} total</Text></Box>
      {visible.map((campaign) => {
        const active = campaign.id === selected.id;
        return (
          <Text key={campaign.id} bold={active} color={active ? theme.foreground : theme.muted}>
            <Text color={active ? theme.accent : theme.muted}>{active ? "› " : "  "}</Text>
            {fitText(campaign.id, Math.max(8, listWidth - 17)).padEnd(Math.max(8, listWidth - 17))} {String(campaign.laneCount).padStart(2)} lanes
          </Text>
        );
      })}
    </Box>
  );
  const detail = (
    <Box width={detailWidth} borderStyle="round" borderColor={theme.accent} paddingX={1} flexDirection="column">
      <Box justifyContent="space-between"><SectionTitle>{fitText(selected.id, Math.max(8, detailWidth - 18))}</SectionTitle><StatusBadge status={selected.status} /></Box>
      <Text color={theme.foreground}>{fitText(selected.title, Math.max(8, detailWidth - 4))}</Text>
      <Text color={theme.muted}>{fitText(`${selected.target}@${selected.version}`, Math.max(8, detailWidth - 4))}</Text>
      <Text color={theme.muted}>SCOPE  {selected.laneCount} vulnerability lane{selected.laneCount === 1 ? "" : "s"}</Text>
      <CommandLine surface="cli" command={selected.nextAction} compact width={detailWidth - 4} />
    </Box>
  );
  if (narrow && compact) return <Box paddingX={1}>{detail}</Box>;
  return narrow
    ? <Box paddingX={1} flexDirection="column">{list}{detail}</Box>
    : <Box paddingX={1} gap={1}>{list}{detail}</Box>;
}

export function ActivityView(props: {
  activity: WorkspaceActivityEntry[];
  width: number;
  height: number;
  selectedIndex: number;
}): ReactNode {
  const compact = props.width < 80;
  const entries = props.activity.slice().reverse();
  const pageSize = activityPageSize(props.height);
  const selectedIndex = Math.max(0, Math.min(props.selectedIndex, Math.max(0, entries.length - 1)));
  const maxOffset = Math.max(0, entries.length - pageSize);
  const offset = Math.max(0, Math.min(selectedIndex - Math.floor(pageSize / 2), maxOffset));
  const visible = entries.slice(offset, offset + pageSize);
  const start = entries.length === 0 ? 0 : offset + 1;
  const end = Math.min(entries.length, offset + pageSize);
  return (
    <Box marginX={1} borderStyle="round" borderColor={theme.muted} paddingX={1} flexDirection="column">
      <Box justifyContent="space-between"><SectionTitle>RECENT ACTIVITY</SectionTitle><Text color={theme.muted}>{start}-{end}/{entries.length} newest first</Text></Box>
      {visible.length === 0 ? <Text color={theme.muted}>No recorded workspace activity.</Text> : null}
      {visible.map((entry, index) => compact ? (
        <Text key={`${entry.timestamp}-${entry.action}-${index}`} bold={offset + index === selectedIndex}>
          <Text color={offset + index === selectedIndex ? theme.accent : theme.muted}>{offset + index === selectedIndex ? "› " : "  "}</Text>
          <Text color={theme.muted}>{shortTimestamp(entry.timestamp)} </Text>
          <Text color={theme.foreground}>{fitText(`${entry.action} ${activityContext(entry)}`, Math.max(8, props.width - 20))}</Text>
        </Text>
      ) : (
        <Box key={`${entry.timestamp}-${entry.action}-${index}`}>
          <Text color={offset + index === selectedIndex ? theme.accent : theme.muted}>{offset + index === selectedIndex ? "› " : "  "}</Text>
          <Box width={21}><Text color={theme.muted}>{shortTimestamp(entry.timestamp, true)}</Text></Box>
          <Box width={28}><Text color={theme.foreground}>{fitText(entry.action, 26)}</Text></Box>
          <Text color={theme.muted}>{fitText(activityContext(entry), Math.max(8, props.width - 57))}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function activityPageSize(height: number): number {
  return Math.max(1, height - 9);
}

export function buildActivityDetailLines(entry: WorkspaceActivityEntry, width: number): string[] {
  const logical = [
    `TIMESTAMP  ${entry.timestamp}`,
    `ACTION  ${entry.action}`,
    entry.id ? `ID  ${entry.id}` : undefined,
    entry.status ? `STATUS  ${entry.status}` : undefined,
    entry.from || entry.to ? `TRANSITION  ${entry.from ?? "unknown"} → ${entry.to ?? "unknown"}` : undefined,
    entry.reason ? `REASON  ${entry.reason}` : undefined,
    entry.path ? `PATH  ${entry.path}` : undefined,
  ].filter((value): value is string => Boolean(value));
  return logical.flatMap((value) => wrapText(value, width));
}

export function FocusedActivityDetail(props: {
  entry: WorkspaceActivityEntry;
  lines: string[];
  offset: number;
  pageSize: number;
  width: number;
}): ReactNode {
  const maxOffset = Math.max(0, props.lines.length - props.pageSize);
  const offset = Math.max(0, Math.min(props.offset, maxOffset));
  const visible = props.lines.slice(offset, offset + props.pageSize);
  const start = props.lines.length === 0 ? 0 : offset + 1;
  const end = Math.min(props.lines.length, offset + props.pageSize);
  return (
    <Box marginX={1} width={props.width - 2} borderStyle="round" borderColor={theme.accent} paddingX={1} flexDirection="column">
      <Box justifyContent="space-between"><SectionTitle>ACTIVITY DETAIL</SectionTitle><Text color={theme.accent}>{props.entry.action}</Text></Box>
      {visible.map((value, index) => <Text key={`${offset + index}-${value}`} color={theme.foreground}>{value}</Text>)}
      <Box justifyContent="space-between">
        <Text color={theme.muted}>LINES {start}-{end}/{props.lines.length}</Text>
        <Text color={theme.muted}>{props.width < 72 ? "j/k · Pg · g/G · Space close" : "j/k scroll · PgUp/PgDn · g/G · Space/Esc close"}</Text>
      </Box>
    </Box>
  );
}

export function StructuredFilterPanel(props: {
  value: FindingFilter;
  field: 0 | 1;
  width: number;
}): ReactNode {
  const compact = props.width < 60;
  return (
    <Box marginX={1} width={Math.min(props.width - 2, 72)} borderStyle="round" borderColor={theme.accent} paddingX={2} paddingY={compact ? 0 : 1} flexDirection="column">
      <SectionTitle>STRUCTURED FINDING FILTER</SectionTitle>
      <Text color={theme.muted}>{compact ? "↑↓ field · ←→ value" : "Use ↑↓ to choose a field and ←→ to change its value."}</Text>
      <FilterRow label="STATUS" values={FILTER_STATUSES} active={props.value.status} selected={props.field === 0} compact={compact} />
      <FilterRow label="SURFACE" values={FILTER_SURFACES} active={props.value.surface} selected={props.field === 1} compact={compact} />
      <Text color={theme.muted}>Enter apply · x reset · Esc cancel</Text>
    </Box>
  );
}

function FilterRow(props: { label: string; values: string[]; active: string; selected: boolean; compact: boolean }): ReactNode {
  const labels = props.values.map((value) => {
    const display = props.compact
      ? value === "candidate" ? "cand" : value === "confirmed" ? "conf" : value === "blocked" ? "block" : value
      : value;
    return value === props.active ? `[${display}]` : display;
  });
  return (
    <Box>
      <Box width={11}><Text bold color={props.selected ? theme.accent : theme.muted}>{props.selected ? "› " : "  "}{props.label}</Text></Box>
      <Text color={theme.foreground}>{labels.join("  ")}</Text>
    </Box>
  );
}

export function CommandPalette(props: {
  selectedIndex: number;
  width: number;
  height: number;
}): ReactNode {
  const compact = props.height < 24;
  const visible = compact
    ? windowAround(PALETTE_COMMANDS, props.selectedIndex, 5)
    : PALETTE_COMMANDS;
  return (
    <Box marginX={1} width={Math.min(props.width - 2, 78)} borderStyle="round" borderColor={theme.accent} paddingX={2} paddingY={compact ? 0 : 1} flexDirection="column">
      <SectionTitle>COMMAND PALETTE</SectionTitle>
      {visible.map((command) => {
        const index = PALETTE_COMMANDS.findIndex((candidate) => candidate.id === command.id);
        const selected = index === props.selectedIndex;
        return (
          <Box key={command.id}>
            <Text bold={selected} color={selected ? theme.accent : theme.muted}>{selected ? "› " : "  "}{fitText(command.label, 25).padEnd(25)}</Text>
            {!compact ? <Text color={theme.muted}>{fitText(command.description, Math.max(8, props.width - 34))}</Text> : null}
          </Box>
        );
      })}
      <Text color={theme.muted}>{props.width < 60 ? "↑↓ select · Enter run · Esc close" : "↑↓ select · Enter run local action · Esc close"}</Text>
    </Box>
  );
}

function shortTimestamp(value: string, seconds = false): string {
  const normalized = value.replace("T", " ").replace(/Z$/, "");
  return seconds ? normalized.slice(0, 19) : normalized.slice(5, 16);
}

function activityContext(entry: WorkspaceActivityEntry): string {
  return [
    entry.id,
    entry.status,
    entry.from && entry.to ? `${entry.from}→${entry.to}` : undefined,
    entry.reason,
  ].filter(Boolean).join(" · ") || "workspace";
}

function activityLabel(entry: WorkspaceActivityEntry): string {
  return `${shortTimestamp(entry.timestamp)} · ${entry.action} · ${activityContext(entry)}`;
}
