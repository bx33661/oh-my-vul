import { Box, Text, useApp, useInput, usePaste, useWindowSize } from "ink";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FindingDetail } from "../findings.js";
import type { InteractiveWorkspaceModel } from "./model.js";
import { Footer, Header, Notice } from "./components.js";
import { StartView } from "./start-view.js";
import {
  buildFindingDetailLines,
  FINDING_DETAIL_TABS,
  filterFindings,
  FocusedFindingDetail,
  HelpView,
  type FindingDetailTab,
  WorkspaceOverview,
  wrapFindingDetailLines,
} from "./workspace.js";
import { theme } from "./theme.js";
import {
  ActivityView,
  activityPageSize,
  buildActivityDetailLines,
  CampaignView,
  CommandPalette,
  DEFAULT_FINDING_FILTER,
  FILTER_STATUSES,
  FILTER_SURFACES,
  type FindingFilter,
  FocusedActivityDetail,
  OverviewView,
  PALETTE_COMMANDS,
  type PaletteCommand,
  StructuredFilterPanel,
  type WorkspaceView,
  WORKSPACE_VIEWS,
  WorkspaceNavigation,
} from "./views.js";

export const MIN_INTERACTIVE_COLUMNS = 52;
export const MIN_INTERACTIVE_ROWS = 16;

export interface InteractiveAppServices {
  reload(): Promise<InteractiveWorkspaceModel>;
  loadFinding(id: string): Promise<FindingDetail>;
  start(vulnerabilityClasses: string[]): Promise<InteractiveWorkspaceModel>;
}

export interface InteractiveAppProps {
  initialModel: InteractiveWorkspaceModel;
  services: InteractiveAppServices;
  dimensions?: { columns: number; rows: number };
}

export function InteractiveApp({ initialModel, services, dimensions }: InteractiveAppProps) {
  const { exit } = useApp();
  const detectedSize = useWindowSize();
  const size = dimensions ?? detectedSize;
  const width = Math.max(1, size.columns || 80);
  const height = Math.max(1, size.rows || 24);
  const terminalTooSmall = width < MIN_INTERACTIVE_COLUMNS || height < MIN_INTERACTIVE_ROWS;
  const [model, setModel] = useState(initialModel);
  const [selectedId, setSelectedId] = useState<string | undefined>(initialModel.findings[0]?.id);
  const [detail, setDetail] = useState<FindingDetail>();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeView, setActiveView] = useState<WorkspaceView>("findings");
  const [detailTab, setDetailTab] = useState<FindingDetailTab>("summary");
  const [detailFocused, setDetailFocused] = useState(false);
  const [detailScroll, setDetailScroll] = useState(0);
  const [findingFilter, setFindingFilter] = useState<FindingFilter>({ ...DEFAULT_FINDING_FILTER });
  const [draftFilter, setDraftFilter] = useState<FindingFilter>({ ...DEFAULT_FINDING_FILTER });
  const [filterPanel, setFilterPanel] = useState(false);
  const [filterField, setFilterField] = useState<0 | 1>(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showAction, setShowAction] = useState(false);
  const [narrowView, setNarrowView] = useState<"queue" | "detail">("queue");
  const [error, setError] = useState<string>();
  const [detailError, setDetailError] = useState<string>();
  const [detailRevision, setDetailRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(initialModel.campaigns[0]?.id);
  const [activitySelectedIndex, setActivitySelectedIndex] = useState(0);
  const [activityFocused, setActivityFocused] = useState(false);
  const [activityDetailScroll, setActivityDetailScroll] = useState(0);
  const findings = useMemo(() => filterFindings(model.findings, query, findingFilter), [findingFilter, model.findings, query]);
  const effectiveSelectedId = selectedId && findings.some((finding) => finding.id === selectedId)
    ? selectedId
    : findings[0]?.id;
  const selectedRef = useRef(effectiveSelectedId);
  selectedRef.current = effectiveSelectedId;
  const selectedFinding = findings.find((finding) => finding.id === effectiveSelectedId);
  const focusedPageSize = Math.max(1, height - (width < 72 ? 8 : 7));
  const focusedLines = useMemo(() => selectedFinding
    ? wrapFindingDetailLines(buildFindingDetailLines({
      finding: selectedFinding,
      detail: detail?.id === selectedFinding.id ? detail : undefined,
      tab: detailTab,
      activity: model.activity,
    }), Math.max(8, width - 6))
    : [], [detail, detailTab, model.activity, selectedFinding, width]);
  const focusedMaxScroll = Math.max(0, focusedLines.length - focusedPageSize);
  const activityEntries = useMemo(() => model.activity.slice().reverse(), [model.activity]);
  const selectedActivity = activityEntries[activitySelectedIndex];
  const activityMaxIndex = Math.max(0, activityEntries.length - 1);
  const activityFocusPageSize = Math.max(1, height - (width < 72 ? 7 : 6));
  const activityFocusLines = useMemo(() => selectedActivity
    ? buildActivityDetailLines(selectedActivity, Math.max(8, width - 6))
    : [], [selectedActivity, width]);
  const activityFocusMaxScroll = Math.max(0, activityFocusLines.length - activityFocusPageSize);

  useEffect(() => {
    if (findings.length === 0) {
      setSelectedId(undefined);
      setDetail(undefined);
      return;
    }
    if (selectedId !== effectiveSelectedId) {
      setSelectedId(effectiveSelectedId);
    }
  }, [effectiveSelectedId, findings.length, selectedId]);

  useEffect(() => {
    if (model.campaigns.length === 0) {
      setSelectedCampaignId(undefined);
    } else if (!model.campaigns.some((campaign) => campaign.id === selectedCampaignId)) {
      setSelectedCampaignId(model.campaigns[0]?.id);
    }
  }, [model.campaigns, selectedCampaignId]);

  useEffect(() => {
    if (!effectiveSelectedId) return;
    let active = true;
    setDetail(undefined);
    setDetailError(undefined);
    services.loadFinding(effectiveSelectedId).then((loaded) => {
      if (active) {
        setDetail(loaded);
        setDetailError(undefined);
      }
    }).catch((cause: unknown) => {
      if (active) setDetailError(errorMessage(cause));
    });
    return () => {
      active = false;
    };
  }, [detailRevision, effectiveSelectedId, services]);

  useEffect(() => {
    setDetailScroll((current) => Math.max(0, Math.min(current, focusedMaxScroll)));
  }, [focusedMaxScroll]);

  useEffect(() => {
    setActivitySelectedIndex((current) => Math.max(0, Math.min(current, activityMaxIndex)));
  }, [activityMaxIndex]);

  useEffect(() => {
    setActivityDetailScroll((current) => Math.max(0, Math.min(current, activityFocusMaxScroll)));
  }, [activityFocusMaxScroll]);

  const refreshWorkspace = (): void => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    services.reload().then((loaded) => {
      setModel(loaded);
      const current = selectedRef.current;
      setSelectedId(current && loaded.findings.some((finding) => finding.id === current) ? current : loaded.findings[0]?.id);
      setSelectedCampaignId((currentCampaign) => currentCampaign && loaded.campaigns.some((campaign) => campaign.id === currentCampaign)
        ? currentCampaign
        : loaded.campaigns[0]?.id);
      setDetailRevision((value) => value + 1);
    }).catch((cause: unknown) => setError(errorMessage(cause))).finally(() => setBusy(false));
  };

  const executePaletteCommand = (command: PaletteCommand): void => {
    setPaletteOpen(false);
    if (command === "refresh") {
      refreshWorkspace();
      return;
    }
    if (command === "show-action") {
      setActiveView("findings");
      setNarrowView("detail");
      setDetailTab("summary");
      setShowAction(true);
      return;
    }
    if (command === "clear-filters") {
      setActiveView("findings");
      setQuery("");
      setFindingFilter({ ...DEFAULT_FINDING_FILTER });
      return;
    }
    if (command === "help") {
      setShowHelp(true);
      return;
    }
    setActiveView(command);
  };

  useInput((input, key) => {
    const textInput = printableText(input);
    const inlineReturn = /[\r\n]/.test(input);
    if (terminalTooSmall) {
      if (input === "q" || key.escape) exit();
      return;
    }
    if (!model.initialized) {
      if (busy) return;
      if (key.escape) {
        exit();
        return;
      }
      if (key.return || inlineReturn) {
        const submittedScope = `${scope}${textInput}`;
        if (submittedScope !== scope) setScope(submittedScope);
        const classes = submittedScope.split(",").map((value) => value.trim()).filter(Boolean);
        if (classes.length === 0) {
          setError("At least one vulnerability class is required.");
          return;
        }
        setBusy(true);
        setError(undefined);
        services.start(classes).then((loaded) => {
          setModel(loaded);
          setSelectedId(loaded.findings[0]?.id);
          setScope("");
        }).catch((cause: unknown) => setError(errorMessage(cause))).finally(() => setBusy(false));
        return;
      }
      if (key.backspace || key.delete) {
        setScope((value) => value.slice(0, -1));
        setError(undefined);
        return;
      }
      if (textInput) {
        setScope((value) => `${value}${textInput}`);
        setError(undefined);
      }
      return;
    }

    if (activityFocused) {
      if (input === " " || key.escape) {
        setActivityFocused(false);
        return;
      }
      if (input === "q") {
        exit();
        return;
      }
      if (key.downArrow || input === "j") {
        setActivityDetailScroll((current) => Math.min(activityFocusMaxScroll, current + 1));
        return;
      }
      if (key.upArrow || input === "k") {
        setActivityDetailScroll((current) => Math.max(0, current - 1));
        return;
      }
      if (key.pageDown) {
        setActivityDetailScroll((current) => Math.min(activityFocusMaxScroll, current + activityFocusPageSize));
        return;
      }
      if (key.pageUp) {
        setActivityDetailScroll((current) => Math.max(0, current - activityFocusPageSize));
        return;
      }
      if (input === "g") setActivityDetailScroll(0);
      if (input === "G") setActivityDetailScroll(activityFocusMaxScroll);
      return;
    }

    if (detailFocused) {
      if (input === " " || key.escape) {
        setDetailFocused(false);
        return;
      }
      if (input === "q") {
        exit();
        return;
      }
      if (input === "]" || input === "[") {
        setDetailTab((current) => cycleDetailTab(current, input === "]" ? 1 : -1));
        setDetailScroll(0);
        return;
      }
      if (key.downArrow || input === "j") {
        setDetailScroll((current) => Math.min(focusedMaxScroll, current + 1));
        return;
      }
      if (key.upArrow || input === "k") {
        setDetailScroll((current) => Math.max(0, current - 1));
        return;
      }
      if (key.pageDown) {
        setDetailScroll((current) => Math.min(focusedMaxScroll, current + focusedPageSize));
        return;
      }
      if (key.pageUp) {
        setDetailScroll((current) => Math.max(0, current - focusedPageSize));
        return;
      }
      if (input === "g") {
        setDetailScroll(0);
        return;
      }
      if (input === "G") {
        setDetailScroll(focusedMaxScroll);
      }
      return;
    }

    if (paletteOpen) {
      if (key.escape || input === "q" || input === ":") {
        setPaletteOpen(false);
        return;
      }
      if (key.downArrow || input === "j") {
        setPaletteIndex((value) => Math.min(PALETTE_COMMANDS.length - 1, value + 1));
        return;
      }
      if (key.upArrow || input === "k") {
        setPaletteIndex((value) => Math.max(0, value - 1));
        return;
      }
      if (key.return || inlineReturn) {
        const command = PALETTE_COMMANDS[paletteIndex];
        if (command) executePaletteCommand(command.id);
      }
      return;
    }

    if (filterPanel) {
      if (key.escape || input === "q" || input === "f") {
        setFilterPanel(false);
        return;
      }
      if (key.downArrow || input === "j") {
        setFilterField(1);
        return;
      }
      if (key.upArrow || input === "k") {
        setFilterField(0);
        return;
      }
      if (key.leftArrow || key.rightArrow) {
        const delta = key.rightArrow ? 1 : -1;
        setDraftFilter((current) => filterField === 0
          ? { ...current, status: cycleValue(current.status, FILTER_STATUSES, delta) }
          : { ...current, surface: cycleValue(current.surface, FILTER_SURFACES, delta) });
        return;
      }
      if (input === "x") {
        setDraftFilter({ ...DEFAULT_FINDING_FILTER });
        return;
      }
      if (key.return || inlineReturn) {
        setFindingFilter({ ...draftFilter });
        setFilterPanel(false);
      }
      return;
    }

    if (searching) {
      if (key.escape) {
        setSearching(false);
        if (query) setQuery("");
        return;
      }
      if (key.return || inlineReturn) {
        if (textInput) setQuery((value) => `${value}${textInput}`);
        setSearching(false);
        return;
      }
      if (key.backspace || key.delete) {
        setQuery((value) => value.slice(0, -1));
        return;
      }
      if (textInput) setQuery((value) => `${value}${textInput}`);
      return;
    }

    if (showHelp) {
      if (input === "?" || key.escape || input === "q") setShowHelp(false);
      return;
    }
    if (input === "q") {
      exit();
      return;
    }
    if (input === "?") {
      setShowHelp(true);
      return;
    }
    if (input === ":") {
      setPaletteIndex(0);
      setPaletteOpen(true);
      return;
    }
    if (input === "f" && activeView === "findings") {
      setDraftFilter({ ...findingFilter });
      setFilterField(0);
      setFilterPanel(true);
      return;
    }
    if (input === "/") {
      setActiveView("findings");
      setSearching(true);
      return;
    }
    if (key.tab) {
      setActiveView((current) => cycleWorkspaceView(current));
      return;
    }
    const directView = WORKSPACE_VIEWS.find((view) => view.key === input);
    if (directView) {
      setActiveView(directView.id);
      return;
    }
    if (key.escape) {
      if (query) setQuery("");
      else if (findingFilter.status !== "all" || findingFilter.surface !== "all") setFindingFilter({ ...DEFAULT_FINDING_FILTER });
      else if (activeView === "findings" && narrowView === "detail") setNarrowView("queue");
      else if (activeView !== "findings") setActiveView("findings");
      setShowAction(false);
      return;
    }
    if (key.return && width < 100 && activeView === "findings") {
      setNarrowView((value) => value === "queue" ? "detail" : "queue");
      return;
    }
    if (input === "a" && activeView === "findings") {
      setShowAction((value) => !value);
      return;
    }
    if ((input === "]" || input === "[") && activeView === "findings") {
      setDetailTab((current) => cycleDetailTab(current, input === "]" ? 1 : -1));
      return;
    }
    if (input === " " && activeView === "findings" && selectedFinding) {
      setDetailScroll(0);
      setDetailFocused(true);
      return;
    }
    if (input === " " && activeView === "activity" && selectedActivity) {
      setActivityDetailScroll(0);
      setActivityFocused(true);
      return;
    }
    if (input === "r") {
      refreshWorkspace();
      return;
    }
    if (activeView === "findings") {
      if (key.downArrow || input === "j") moveSelection(1, findings, effectiveSelectedId, setSelectedId);
      if (key.upArrow || input === "k") moveSelection(-1, findings, effectiveSelectedId, setSelectedId);
    } else if (activeView === "campaign") {
      if (key.downArrow || input === "j") moveCampaignSelection(1, model.campaigns, selectedCampaignId, setSelectedCampaignId);
      if (key.upArrow || input === "k") moveCampaignSelection(-1, model.campaigns, selectedCampaignId, setSelectedCampaignId);
    } else if (activeView === "activity") {
      if (key.downArrow || input === "j") setActivitySelectedIndex((current) => Math.min(activityMaxIndex, current + 1));
      if (key.upArrow || input === "k") setActivitySelectedIndex((current) => Math.max(0, current - 1));
      if (key.pageDown) setActivitySelectedIndex((current) => Math.min(activityMaxIndex, current + activityPageSize(height)));
      if (key.pageUp) setActivitySelectedIndex((current) => Math.max(0, current - activityPageSize(height)));
      if (input === "g") setActivitySelectedIndex(0);
      if (input === "G") setActivitySelectedIndex(activityMaxIndex);
    }
  });

  usePaste((pasted) => {
    if (terminalTooSmall || busy) return;
    const value = pastedText(pasted, model.initialized ? " " : ", ");
    if (!value) return;
    if (!model.initialized) {
      setScope((current) => `${current}${value}`);
      setError(undefined);
    } else if (searching) {
      setQuery((current) => `${current}${value}`);
    }
  }, { isActive: !terminalTooSmall && !busy && (!model.initialized || searching) });

  if (terminalTooSmall) {
    const available = Math.max(1, width);
    return (
      <Box flexDirection="column" width={available}>
        <Text bold color={theme.accent}>{fitForTerminal("OH MY VUL", available)}</Text>
        <Text bold color={theme.foreground}>{fitForTerminal("Terminal too small", available)}</Text>
        <Text color={theme.muted}>{fitForTerminal(`${width}x${height} detected; minimum ${MIN_INTERACTIVE_COLUMNS}x${MIN_INTERACTIVE_ROWS}.`, available)}</Text>
        <Text color={theme.foreground}>{fitForTerminal("Resize to continue, or press q to quit.", available)}</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" width={width} minHeight={Math.min(height, 40)}>
      <Header target={model.project.target} version={model.project.version} ecosystem={model.project.ecosystem} width={width} />
      <Box paddingX={1}><Text color={theme.muted}>{"─".repeat(Math.max(1, width - 2))}</Text></Box>
      {busy && model.initialized ? <Notice tone="warning">Refreshing local research state…</Notice> : null}
      {model.initialized && !detailFocused && !activityFocused ? <WorkspaceNavigation active={activeView} width={width} /> : null}
      {!model.initialized ? (
        <StartView project={model.project} scope={scope} busy={busy} error={error} width={width} compact={height < 24} />
      ) : activityFocused && selectedActivity ? (
        <FocusedActivityDetail
          entry={selectedActivity}
          lines={activityFocusLines}
          offset={activityDetailScroll}
          pageSize={activityFocusPageSize}
          width={width}
        />
      ) : detailFocused && selectedFinding ? (
        <FocusedFindingDetail
          finding={selectedFinding}
          tab={detailTab}
          lines={focusedLines}
          offset={detailScroll}
          pageSize={focusedPageSize}
          width={width}
        />
      ) : showHelp ? (
        <HelpView width={width} compact={height < 26} />
      ) : paletteOpen ? (
        <CommandPalette selectedIndex={paletteIndex} width={width} height={height} />
      ) : filterPanel ? (
        <StructuredFilterPanel value={draftFilter} field={filterField} width={width} />
      ) : activeView === "overview" ? (
        <OverviewView model={model} width={width} height={height} />
      ) : activeView === "campaign" ? (
        <CampaignView campaigns={model.campaigns} selectedId={selectedCampaignId} width={width} height={height} />
      ) : activeView === "activity" ? (
        <ActivityView activity={model.activity} width={width} height={height} selectedIndex={activitySelectedIndex} />
      ) : (
        <WorkspaceOverview
          model={model}
          findings={findings}
          selectedId={effectiveSelectedId}
          detail={detail?.id === effectiveSelectedId ? detail : undefined}
          width={width}
          height={height}
          query={query}
          searching={searching}
          narrowView={narrowView}
          showAction={showAction}
          detailTab={detailTab}
          filter={findingFilter}
          error={error ?? detailError}
        />
      )}
      {model.initialized && !detailFocused && !activityFocused && !showHelp && !paletteOpen && !filterPanel
        ? <Footer searching={searching} narrow={width < 100} narrowView={narrowView} view={activeView} detailTab={detailTab} width={width} />
        : null}
    </Box>
  );
}

function moveSelection(
  delta: number,
  findings: InteractiveWorkspaceModel["findings"],
  selectedId: string | undefined,
  select: (id: string | undefined) => void,
): void {
  if (findings.length === 0) return;
  const current = Math.max(0, findings.findIndex((finding) => finding.id === selectedId));
  const next = Math.max(0, Math.min(findings.length - 1, current + delta));
  select(findings[next]?.id);
}

function moveCampaignSelection(
  delta: number,
  campaigns: InteractiveWorkspaceModel["campaigns"],
  selectedId: string | undefined,
  select: (id: string | undefined) => void,
): void {
  if (campaigns.length === 0) return;
  const current = Math.max(0, campaigns.findIndex((campaign) => campaign.id === selectedId));
  const next = Math.max(0, Math.min(campaigns.length - 1, current + delta));
  select(campaigns[next]?.id);
}

function cycleWorkspaceView(current: WorkspaceView): WorkspaceView {
  const index = WORKSPACE_VIEWS.findIndex((view) => view.id === current);
  return WORKSPACE_VIEWS[(index + 1) % WORKSPACE_VIEWS.length]?.id ?? "findings";
}

function cycleDetailTab(current: FindingDetailTab, delta: number): FindingDetailTab {
  const index = FINDING_DETAIL_TABS.findIndex((tab) => tab.id === current);
  const next = (index + delta + FINDING_DETAIL_TABS.length) % FINDING_DETAIL_TABS.length;
  return FINDING_DETAIL_TABS[next]?.id ?? "summary";
}

function cycleValue<T>(current: T, values: readonly T[], delta: number): T {
  const index = Math.max(0, values.indexOf(current));
  const next = (index + delta + values.length) % values.length;
  return values[next] ?? current;
}

function printableText(input: string): string {
  return input.replace(/[\u0000-\u001f\u007f]/g, "");
}

function pastedText(input: string, lineSeparator: string): string {
  return input
    .replace(/[\r\n]+/g, lineSeparator)
    .replace(/[\u0000-\u001f\u007f]/g, "");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fitForTerminal(value: string, width: number): string {
  return value.length <= width ? value : `${value.slice(0, Math.max(0, width - 1))}…`;
}
