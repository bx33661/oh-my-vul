import { listFindingWorkflow, listFindings, showFinding, validateFinding, validateFindings } from "./findings.js";
import { radarBrief } from "./radar.js";
import { trackSubmissions } from "./submissions.js";

export interface McpRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface McpResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

const READONLY_METHODS = new Set([
  "findings.list",
  "findings.show",
  "findings.workflow",
  "findings.validate",
  "radar.brief",
  "submissions.track",
]);

export async function handleMcpRequest(request: McpRequest, projectRoot = process.cwd()): Promise<McpResponse> {
  if (!READONLY_METHODS.has(request.method)) {
    return { ok: false, error: `unsupported read-only method: ${request.method}` };
  }
  const params = request.params ?? {};
  switch (request.method) {
    case "findings.list":
      return { ok: true, result: await listFindings(projectRoot) };
    case "findings.show":
      return { ok: true, result: await showFinding(requiredString(params, "id"), projectRoot) };
    case "findings.workflow":
      return { ok: true, result: await listFindingWorkflow(projectRoot) };
    case "findings.validate": {
      const id = optionalString(params, "id");
      return { ok: true, result: id ? await validateFinding(id, projectRoot) : await validateFindings(projectRoot) };
    }
    case "radar.brief":
      return { ok: true, result: await radarBrief(projectRoot) };
    case "submissions.track":
      return { ok: true, result: await trackSubmissions(requiredString(params, "id"), projectRoot) };
    default:
      return { ok: false, error: `unsupported read-only method: ${request.method}` };
  }
}

function requiredString(params: Record<string, unknown>, name: string): string {
  const value = optionalString(params, name);
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function optionalString(params: Record<string, unknown>, name: string): string | undefined {
  const value = params[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
