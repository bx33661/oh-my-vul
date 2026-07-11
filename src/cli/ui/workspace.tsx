import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { FindingDetail, FindingWorkflowSummary } from "../findings.js";
import type { WorkspaceActivityEntry } from "../workspace.js";
import type { InteractiveWorkspaceModel } from "./model.js";
import { CommandLine, Meter, Metrics, Notice, SectionTitle, StatusBadge } from "./components.js";
import { fitText, normalizedTerms, windowAround, wrapText } from "./format.js";
import { theme } from "./theme.js";
import type { FindingFilter } from "./views.js";

export type FindingDetailTab = "summary" | "evidence" | "threat" | "history";

export const FINDING_DETAIL_TABS: ReadonlyArray<{ id: FindingDetailTab; label: string }> = [
  { id: "summary", label: "SUMMARY" },
  { id: "evidence", label: "EVIDENCE" },
  { id: "threat", label: "THREAT" },
  { id: "history", label: "HISTORY" },
];

export type DetailLineTone = "foreground" | "muted" | "warning" | "danger" | "success" | "accent";

export interface FindingDetailLine {
  text: string;
  tone: DetailLineTone;
}

export function filterFindings(
  findings: FindingWorkflowSummary[],
  query: string,
  filter: FindingFilter = { status: "all", surface: "all" },
): FindingWorkflowSummary[] {
  const terms = normalizedTerms(query);
  return findings.filter((finding) => {
    if (filter.status !== "all" && finding.status !== filter.status) return false;
    if (filter.surface !== "all" && finding.action.surface !== filter.surface) return false;
    if (terms.length === 0) return true;
    const haystack = [
      finding.id,
      finding.package,
      finding.ecosystem,
      finding.vulnerability,
      finding.status,
      finding.action.command,
      finding.action.reason,
    ].join(" ").toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function WorkspaceOverview(props: {
  model: InteractiveWorkspaceModel;
  findings: FindingWorkflowSummary[];
  selectedId?: string;
  detail?: FindingDetail;
  width: number;
  height: number;
  query: string;
  searching: boolean;
  narrowView: "queue" | "detail";
  showAction: boolean;
  detailTab: FindingDetailTab;
  filter: FindingFilter;
  error?: string;
}): ReactNode {
  const statuses = props.model.status?.statusCounts ?? {};
  const narrow = props.width < 100;
  const selectedIndex = Math.max(0, props.findings.findIndex((finding) => finding.id === props.selectedId));
  const compact = props.height < 26;
  const rowBudget = Math.max(1, props.height - 13);
  const visible = windowAround(props.findings, selectedIndex, rowBudget);
  const selected = props.findings.find((finding) => finding.id === props.selectedId);
  const hasStructuredFilter = props.filter.status !== "all" || props.filter.surface !== "all";
  const filterSummary = [
    props.query ? `/${fitText(props.query, Math.max(1, props.width - 36))}` : undefined,
    props.filter.status !== "all" ? `status:${props.filter.status}` : undefined,
    props.filter.surface !== "all" ? `surface:${props.filter.surface}` : undefined,
  ].filter(Boolean).join(" · ");

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
      {props.error ? <Notice tone="error">{fitText(props.error, Math.max(8, props.width - 10))}</Notice> : null}
      {props.searching || props.query || hasStructuredFilter ? (
        <Box paddingX={1}>
          <Text color={theme.accent}>FILTER </Text>
          <Text color={theme.foreground}>{filterSummary || "/"}</Text>
          {props.searching ? <Text inverse> </Text> : null}
          <Text color={theme.muted}>  {props.findings.length} match{props.findings.length === 1 ? "" : "es"}</Text>
        </Box>
      ) : null}
      {props.model.findings.length === 0 ? (
        <EmptyWorkspace model={props.model} width={props.width} />
      ) : props.findings.length === 0 ? (
        <Box borderStyle="round" borderColor={theme.muted} paddingX={1} marginX={1} flexDirection="column">
          <SectionTitle>No matching findings</SectionTitle>
          <Text color={theme.muted}>Press f to change structured filters or Esc to clear the active filter.</Text>
        </Box>
      ) : narrow ? (
        props.narrowView === "queue"
          ? <Queue findings={visible} selectedId={props.selectedId} width={props.width - 2} />
          : <Inspector finding={selected} detail={props.detail} activity={props.model.activity} width={props.width - 2} height={props.height} showAction={props.showAction} compact={compact} tab={props.detailTab} />
      ) : (
        <Box paddingX={1} gap={1}>
          <Queue findings={visible} selectedId={props.selectedId} width={Math.floor((props.width - 3) * 0.48)} />
          <Inspector finding={selected} detail={props.detail} activity={props.model.activity} width={Math.ceil((props.width - 3) * 0.52)} height={props.height} showAction={props.showAction} compact={compact} tab={props.detailTab} />
        </Box>
      )}
    </Box>
  );
}

function EmptyWorkspace({ model, width }: { model: InteractiveWorkspaceModel; width: number }): ReactNode {
  const campaign = model.campaigns[0];
  const command = campaign?.nextAction ?? "omv start";
  return (
    <Box marginX={1} marginTop={1} flexDirection="column" borderStyle="round" borderColor={theme.muted} paddingX={2} paddingY={1}>
      <SectionTitle>{campaign ? `Campaign ${campaign.id} is ready` : "No active research campaign"}</SectionTitle>
      <Text color={theme.muted}>{campaign ? "Continue the campaign to seed evidence-backed hypotheses." : "Start with a bounded target and explicit vulnerability scope."}</Text>
      <Box marginTop={1}><CommandLine surface="cli" command={command} compact width={Math.max(20, width - 8)} /></Box>
    </Box>
  );
}

function Queue(props: {
  findings: FindingWorkflowSummary[];
  selectedId?: string;
  width: number;
}): ReactNode {
  const idWidth = Math.max(12, props.width - 30);
  return (
    <Box width={props.width} flexDirection="column" borderStyle="round" borderColor={theme.muted} paddingX={1}>
      <Box justifyContent="space-between">
        <SectionTitle>WORKFLOW QUEUE</SectionTitle>
        <Text color={theme.muted}>priority ordered</Text>
      </Box>
      <Box>
        <Text color={theme.muted}>  {"ID".padEnd(idWidth)} {"STATUS".padEnd(11)} SCORE</Text>
      </Box>
      {props.findings.map((finding) => {
        const selected = finding.id === props.selectedId;
        return (
          <Box key={finding.id}>
            <Text color={selected ? theme.accent : theme.muted}>{selected ? "›" : " "} </Text>
            <Text bold={selected} color={selected ? theme.foreground : theme.muted}>{fitText(finding.id, idWidth).padEnd(idWidth)} </Text>
            <Box width={12}><StatusBadge status={finding.status} /></Box>
            <Text color={finding.submissionScore >= 75 ? theme.success : theme.warning}>{String(finding.submissionScore).padStart(3)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function Inspector(props: {
  finding?: FindingWorkflowSummary;
  detail?: FindingDetail;
  activity: WorkspaceActivityEntry[];
  width: number;
  height: number;
  showAction: boolean;
  compact: boolean;
  tab: FindingDetailTab;
}): ReactNode {
  if (!props.finding) {
    return (
      <Box width={props.width} borderStyle="round" borderColor={theme.muted} paddingX={1}>
        <Text color={theme.muted}>Select a finding to inspect its evidence.</Text>
      </Box>
    );
  }
  const blockers = props.detail?.blockers ?? props.finding.blockers;
  const missing = props.detail?.missingFields ?? props.finding.missingFields;
  return (
    <Box width={props.width} flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1}>
      <Box justifyContent="space-between">
        <SectionTitle>{fitText(props.finding.id, Math.max(8, props.width - 18))}</SectionTitle>
        <StatusBadge status={props.finding.status} />
      </Box>
      <DetailTabs active={props.tab} />
      {props.tab === "summary" ? <SummaryTab finding={props.finding} blockers={blockers} showAction={props.showAction} width={props.width} compact={props.compact} /> : null}
      {props.tab === "evidence" ? <EvidenceTab finding={props.finding} detail={props.detail} blockers={blockers} missing={missing} width={props.width} compact={props.compact} /> : null}
      {props.tab === "threat" ? <ThreatTab finding={props.finding} detail={props.detail} width={props.width} height={props.height} compact={props.compact} /> : null}
      {props.tab === "history" ? <HistoryTab finding={props.finding} activity={props.activity} width={props.width} height={props.height} compact={props.compact} /> : null}
    </Box>
  );
}

function DetailTabs({ active }: { active: FindingDetailTab }): ReactNode {
  return (
    <Box gap={1}>
      {FINDING_DETAIL_TABS.map((tab) => (
        <Text key={tab.id} bold={tab.id === active} inverse={tab.id === active} color={tab.id === active ? theme.accent : theme.muted}>
          {` ${tab.label} `}
        </Text>
      ))}
    </Box>
  );
}

function SummaryTab(props: {
  finding: FindingWorkflowSummary;
  blockers: string[];
  showAction: boolean;
  width: number;
  compact: boolean;
}): ReactNode {
  return (
    <Box flexDirection="column">
      <Text color={theme.muted}>{fitText(`${props.finding.ecosystem}:${props.finding.package} · ${props.finding.vulnerability}`, Math.max(8, props.width - 4))}</Text>
      <Text color={theme.muted}>{fitText(`READINESS ${props.finding.readiness} · VERDICT ${props.finding.verdict.exploitability}/${props.finding.verdict.confidence}`, Math.max(8, props.width - 4))}</Text>
      {!props.compact ? <Text color={theme.foreground}>{fitText(props.finding.verdict.reason, Math.max(8, props.width - 4))}</Text> : null}
      <Text color={props.blockers.length > 0 ? theme.warning : theme.success}>
        {fitText(props.blockers.length > 0 ? `BLOCKER  ${props.blockers[0]}` : "BLOCKER  none", Math.max(8, props.width - 4))}
      </Text>
      {!props.compact && props.blockers.length > 1
        ? props.blockers.slice(1, 3).map((blocker) => <Text key={blocker} color={theme.warning}>· {fitText(blocker, Math.max(8, props.width - 6))}</Text>)
        : null}
      <CommandLine
        surface={props.finding.action.surface}
        command={props.finding.action.command}
        reason={props.showAction ? props.finding.action.reason : undefined}
        compact
        width={props.width - 4}
      />
    </Box>
  );
}

function EvidenceTab(props: {
  finding: FindingWorkflowSummary;
  detail?: FindingDetail;
  blockers: string[];
  missing: string[];
  width: number;
  compact: boolean;
}): ReactNode {
  const errors = props.detail?.validation.errors ?? [];
  const warnings = props.detail?.validation.warnings ?? props.blockers;
  return (
    <Box flexDirection="column">
      {props.compact ? (
        <Text>
          <Text color={theme.muted}>EVIDENCE </Text><Text color={theme.foreground}>{props.finding.evidenceScore}</Text>
          <Text color={theme.muted}> · SUBMISSION </Text><Text color={theme.foreground}>{props.finding.submissionScore}</Text>
        </Text>
      ) : (
        <>
          <Box><Text color={theme.muted}>EVIDENCE    </Text><Meter value={props.finding.evidenceScore} /></Box>
          <Box><Text color={theme.muted}>SUBMISSION  </Text><Meter value={props.finding.submissionScore} /></Box>
        </>
      )}
      <Text color={props.missing.length > 0 ? theme.warning : theme.success}>{fitText(props.missing.length > 0 ? `MISSING  ${props.missing.join(" · ")}` : "MISSING  none", Math.max(8, props.width - 4))}</Text>
      <Text color={errors.length > 0 ? theme.danger : theme.muted}>{fitText(`VALIDATION  ${errors.length} errors · ${warnings.length} warnings`, Math.max(8, props.width - 4))}</Text>
      {!props.compact ? errors.slice(0, 3).map((error) => <Text key={error} color={theme.danger}>· {fitText(error, Math.max(8, props.width - 6))}</Text>) : null}
      <Text color={theme.muted}>{fitText(`REPRO  ${props.finding.reproArtifacts.length > 0 ? props.finding.reproArtifacts.join(" · ") : "no artifacts"}`, Math.max(8, props.width - 4))}</Text>
      {!props.compact ? <Text color={theme.muted}>{fitText(`SOURCE  ${props.finding.path}`, Math.max(8, props.width - 4))}</Text> : null}
    </Box>
  );
}

function ThreatTab(props: {
  finding: FindingWorkflowSummary;
  detail?: FindingDetail;
  width: number;
  height: number;
  compact: boolean;
}): ReactNode {
  const map = props.detail?.threatMap;
  if (!map) {
    return (
      <Box flexDirection="column">
        <Text color={theme.muted}>No ThreatMap.v1 sidecar is available for this finding.</Text>
        <CommandLine surface="cli" command={`omv threat-map init ${props.finding.id}`} compact width={props.width - 4} />
      </Box>
    );
  }
  const budget = props.compact ? 4 : Math.max(4, props.height - 13);
  return (
    <Box flexDirection="column">
      <Text color={map.validation.ok ? theme.success : theme.danger}>{map.validation.ok ? "VALID THREAT MAP" : "THREAT MAP NEEDS ATTENTION"}</Text>
      {map.rendered.slice(0, budget).map((line, index) => <Text key={`${index}-${line}`} color={theme.muted}>{fitText(line, Math.max(8, props.width - 4))}</Text>)}
      {map.rendered.length > budget ? <Text color={theme.muted}>… {map.rendered.length - budget} more lines</Text> : null}
    </Box>
  );
}

function HistoryTab(props: {
  finding: FindingWorkflowSummary;
  activity: WorkspaceActivityEntry[];
  width: number;
  height: number;
  compact: boolean;
}): ReactNode {
  const events = props.activity.filter((entry) => entry.id === props.finding.id).reverse();
  const budget = props.compact ? 4 : Math.max(4, props.height - 13);
  return (
    <Box flexDirection="column">
      {events.length === 0 ? <Text color={theme.muted}>No activity recorded for this finding.</Text> : null}
      {events.slice(0, budget).map((entry, index) => (
        <Text key={`${entry.timestamp}-${entry.action}-${index}`}>
          <Text color={theme.muted}>{entry.timestamp.replace("T", " ").slice(5, 16)} </Text>
          <Text color={theme.foreground}>{fitText(`${entry.action}${entry.status ? ` · ${entry.status}` : ""}${entry.reason ? ` · ${entry.reason}` : ""}`, Math.max(8, props.width - 17))}</Text>
        </Text>
      ))}
    </Box>
  );
}

export function buildFindingDetailLines(input: {
  finding: FindingWorkflowSummary;
  detail?: FindingDetail;
  tab: FindingDetailTab;
  activity: WorkspaceActivityEntry[];
}): FindingDetailLine[] {
  const { finding, detail } = input;
  const blockers = detail?.blockers ?? finding.blockers;
  const missing = detail?.missingFields ?? finding.missingFields;
  if (input.tab === "summary") {
    return [
      line(`PACKAGE  ${finding.ecosystem}:${finding.package}`, "muted"),
      line(`VULNERABILITY  ${finding.vulnerability}`, "foreground"),
      line(`READINESS  ${finding.readiness} · EVIDENCE  ${finding.evidenceScore} · SUBMISSION  ${finding.submissionScore}`, "muted"),
      line(`VERDICT  ${finding.verdict.exploitability}/${finding.verdict.confidence}`, "foreground"),
      line(`VERDICT REASON  ${finding.verdict.reason || "unknown"}`, "muted"),
      line(`PRIORITY  ${finding.priority} · ${finding.priorityReason || "unknown"}`, "muted"),
      ...(blockers.length > 0
        ? blockers.map((blocker, index) => line(`BLOCKER ${index + 1}  ${blocker}`, "warning"))
        : [line("BLOCKERS  none", "success")]),
      line(`ACTION  ${finding.action.surface === "claude" ? "SKILL" : "CLI"}  ${finding.action.command}`, "accent"),
      line(`ACTION REASON  ${finding.action.reason || "unknown"}`, "muted"),
    ];
  }
  if (input.tab === "evidence") {
    const errors = detail?.validation.errors ?? [];
    const warnings = detail?.validation.warnings ?? blockers;
    return [
      line(`EVIDENCE SCORE  ${finding.evidenceScore}`, "foreground"),
      line(`SUBMISSION SCORE  ${finding.submissionScore}`, "foreground"),
      ...(missing.length > 0
        ? missing.map((field, index) => line(`MISSING ${index + 1}  ${field}`, "warning"))
        : [line("MISSING  none", "success")]),
      ...(errors.length > 0
        ? errors.map((error, index) => line(`ERROR ${index + 1}  ${error}`, "danger"))
        : [line("VALIDATION ERRORS  none", "success")]),
      ...(warnings.length > 0
        ? warnings.map((warning, index) => line(`WARNING ${index + 1}  ${warning}`, "warning"))
        : [line("VALIDATION WARNINGS  none", "success")]),
      ...(finding.reproArtifacts.length > 0
        ? finding.reproArtifacts.map((artifact, index) => line(`REPRO ${index + 1}  ${artifact}`, "muted"))
        : [line("REPRO  no artifacts", "muted")]),
      line(`SOURCE  ${finding.path}`, "muted"),
    ];
  }
  if (input.tab === "threat") {
    const map = detail?.threatMap;
    if (!map) {
      return [
        line("No ThreatMap.v1 sidecar is available for this finding.", "muted"),
        line(`ACTION  CLI  omv threat-map init ${finding.id}`, "accent"),
      ];
    }
    return [
      line(map.validation.ok ? "VALID THREAT MAP" : "THREAT MAP NEEDS ATTENTION", map.validation.ok ? "success" : "danger"),
      line(`SOURCE  ${map.path}`, "muted"),
      ...map.validation.errors.map((error, index) => line(`ERROR ${index + 1}  ${error}`, "danger")),
      ...map.validation.warnings.map((warning, index) => line(`WARNING ${index + 1}  ${warning}`, "warning")),
      ...map.rendered.map((rendered) => line(rendered, "foreground")),
    ];
  }
  const events = input.activity.filter((entry) => entry.id === finding.id).reverse();
  return events.length > 0
    ? events.map((entry) => line([
      entry.timestamp,
      entry.action,
      entry.status,
      entry.from && entry.to ? `${entry.from}→${entry.to}` : undefined,
      entry.reason,
      entry.path,
    ].filter(Boolean).join(" · "), "foreground"))
    : [line("No activity recorded for this finding.", "muted")];
}

export function wrapFindingDetailLines(lines: FindingDetailLine[], width: number): FindingDetailLine[] {
  return lines.flatMap((item) => wrapText(item.text, width).map((text) => ({ text, tone: item.tone })));
}

export function FocusedFindingDetail(props: {
  finding: FindingWorkflowSummary;
  tab: FindingDetailTab;
  lines: FindingDetailLine[];
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
      <Box justifyContent="space-between">
        <SectionTitle>{props.finding.id}</SectionTitle>
        <StatusBadge status={props.finding.status} />
      </Box>
      <DetailTabs active={props.tab} />
      {visible.map((item, index) => <Text key={`${offset + index}-${item.text}`} color={detailLineColor(item.tone)}>{item.text || " "}</Text>)}
      <Box justifyContent="space-between">
        <Text color={theme.muted}>LINES {start}-{end}/{props.lines.length}</Text>
        <Text color={theme.muted}>{props.width < 72 ? "j/k · Pg · g/G · Space close" : "j/k scroll · PgUp/PgDn · g/G · Space/Esc close"}</Text>
      </Box>
    </Box>
  );
}

function line(text: string, tone: DetailLineTone): FindingDetailLine {
  return { text, tone };
}

function detailLineColor(tone: DetailLineTone): string {
  return theme[tone];
}

export function HelpView({ width, compact = false }: { width: number; compact?: boolean }): ReactNode {
  if (compact) {
    return (
      <Box marginX={1} flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={1} width={width - 2}>
        <SectionTitle>KEYBOARD HELP</SectionTitle>
        <Text color={theme.foreground}>Tab/1-4 views · ↑↓/jk move · Enter detail</Text>
        <Text color={theme.foreground}>/ search · f filter · [ ] tabs · : commands</Text>
        <Text color={theme.foreground}>Space full · Pg scroll · g/G ends · q quit</Text>
        <Text color={theme.muted}>Press ? or Esc to return.</Text>
      </Box>
    );
  }
  const rows = [
    ["Tab / 1-4", "cycle or jump to workspace views"],
    ["↑ / k", "previous finding"],
    ["↓ / j", "next finding"],
    ["/", "search the finding queue"],
    ["f", "structured status and surface filters"],
    ["Enter", "switch queue/detail on narrow terminals"],
    ["[ / ]", "switch finding detail tabs"],
    ["Space", "open or close full-width finding detail"],
    ["PgUp/PgDn", "page full detail or Activity history"],
    ["g / G", "jump to the first or last available line"],
    [":", "open the read-only command palette"],
    ["a", "explain the selected next action"],
    ["r", "refresh local workspace state"],
    ["Esc", "back or clear filter"],
    ["q", "quit and restore terminal"],
  ];
  return (
    <Box marginX={1} flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={2} paddingY={1} width={Math.min(width - 2, 76)}>
      <SectionTitle>KEYBOARD HELP</SectionTitle>
      <Text color={theme.muted}>The workspace is read-only. Commands are shown with their required execution surface.</Text>
      <Box marginTop={1} flexDirection="column">
        {rows.map(([key, description]) => (
          <Box key={key}>
            <Box width={12}><Text bold color={theme.accent}>{key}</Text></Box>
            <Text color={theme.foreground}>{description}</Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}><Text color={theme.muted}>Press ? or Esc to return.</Text></Box>
    </Box>
  );
}
