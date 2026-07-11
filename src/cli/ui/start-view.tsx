import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { ProjectContext } from "../start.js";
import { Notice, SectionTitle } from "./components.js";
import { fitText } from "./format.js";
import { theme } from "./theme.js";

export function StartView(props: {
  project: ProjectContext;
  scope: string;
  busy: boolean;
  error?: string;
  width: number;
  compact?: boolean;
}): ReactNode {
  const inputWidth = Math.max(1, props.width - 12);
  return (
    <Box marginX={1} flexDirection="column" borderStyle="round" borderColor={theme.accent} paddingX={2} paddingY={props.compact ? 0 : 1}>
      <SectionTitle>START A RESEARCH CAMPAIGN</SectionTitle>
      {!props.compact ? <Text color={theme.muted}>Review the detected local project, then define a bounded vulnerability scope.</Text> : null}
      <Box marginTop={props.compact ? 0 : 1} flexDirection="column">
        <Fact label="TARGET" value={props.project.target} width={props.width} />
        <Fact label="VERSION" value={props.project.version ?? "unknown"} width={props.width} />
        <Fact label="ECOSYSTEM" value={props.project.ecosystem} width={props.width} />
        {!props.compact ? <Fact label="SOURCE" value={props.project.source ?? "unknown"} width={props.width} /> : null}
        {!props.compact ? <Fact label="MANIFEST" value={props.project.manifest ?? "not detected"} width={props.width} /> : null}
      </Box>
      <Box marginTop={props.compact ? 0 : 1} flexDirection="column">
        <Text bold color={theme.foreground}>VULNERABILITY CLASSES</Text>
        {!props.compact ? <Text color={theme.muted}>Comma-separated, for example: xss, ssrf, path-traversal</Text> : null}
        <Box borderStyle="single" borderColor={props.error ? theme.danger : theme.accent} paddingX={1}>
          <Text color={theme.accent}>› </Text>
          <Text color={theme.foreground}>{fitText(props.scope, inputWidth)}</Text>
          {!props.busy ? <Text inverse> </Text> : null}
        </Box>
      </Box>
      {props.error ? <Notice tone="error">{fitText(props.error, Math.max(8, props.width - 22))}</Notice> : null}
      <Box marginTop={props.compact ? 0 : 1} justifyContent="space-between">
        <Text color={props.busy ? theme.warning : theme.success}>{props.busy ? "Creating workspace…" : "Enter create"}</Text>
        <Text color={theme.muted}>Esc quit</Text>
      </Box>
    </Box>
  );
}

function Fact({ label, value, width }: { label: string; value: string; width: number }): ReactNode {
  return (
    <Box>
      <Box width={12}><Text color={theme.muted}>{label}</Text></Box>
      <Text color={theme.foreground}>{fitText(value, Math.max(16, width - 20))}</Text>
    </Box>
  );
}
