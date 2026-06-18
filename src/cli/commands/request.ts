import { requestFetch, requestPreflight, type RequestFetchResult, type RequestPreflightResult } from "../request.js";
import { requestUsage } from "../usage.js";
import { firstPositionalAfter, parseOption, wantsJson } from "./shared.js";
import { kv, muted, outcomeBadge, panel, table, title, truncate, error as tuiError } from "../tui.js";

export async function run(args: string[]): Promise<void> {
  const subcommand = args[1] ?? "preflight";
  const json = wantsJson(args);
  const refresh = args.includes("--refresh");
  switch (subcommand) {
    case "preflight": {
      const result = await requestPreflight({ refresh });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      printRequestPreflight(result);
      if (result.checks.some((check) => check.status === "fail")) {
        process.exit(1);
      }
      return;
    }
    case "fetch": {
      const url = firstPositionalAfter(args, "fetch");
      if (!url) {
        console.error("Missing URL.");
        process.exit(1);
      }
      const result = await requestFetch(url, { accept: parseOption(args, "--accept"), refresh });
      if (json) {
        console.log(JSON.stringify(result, null, 2));
        if (!result.ok) {
          process.exit(1);
        }
        return;
      }
      printRequestFetch(result);
      if (!result.ok) {
        process.exit(1);
      }
      return;
    }
    default:
      console.error(`Unknown request command: ${subcommand}\n`);
      requestUsage(undefined);
      process.exit(1);
  }
}

function printRequestPreflight(result: RequestPreflightResult): void {
  console.log(title("request preflight"));
  console.log(
    panel("request broker", [
      ...kv([
        ["cache", result.cacheDir],
        ["generated", result.generatedAt],
        ["token", process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? "GitHub token detected" : "GitHub token not detected"],
      ]),
    ]),
  );
  console.log(
    table(
      ["source", "state", "status", "cache", "detail"],
      result.checks.map((check) => [
        check.name,
        outcomeBadge(check.status === "pass" ? "pass" : check.status === "warn" ? "warn" : "fail"),
        check.result.status ? String(check.result.status) : "-",
        check.result.cached ? "hit" : "miss",
        truncate(preflightDetail(check.result), 72),
      ]),
    ),
  );
}

function preflightDetail(result: RequestFetchResult): string {
  if (result.failure) {
    return `${result.failure.reason}: ${result.failure.message}`;
  }
  if (result.url.includes("api.github.com") && result.rateLimit?.remaining === 0) {
    return `rate_limited: GitHub API remaining=0${result.rateLimit.reset ? ` reset=${result.rateLimit.reset}` : ""}`;
  }
  return result.url;
}

function printRequestFetch(result: RequestFetchResult): void {
  const state = result.ok ? "pass" : "fail";
  console.log(
    panel("request fetch", [
      ...kv([
        ["url", result.url],
        ["state", outcomeBadge(state)],
        ["status", result.status ? String(result.status) : "-"],
        ["cache", result.cached ? "hit" : "miss"],
        ["bytes", String(result.bodyBytes)],
        ["sha256", result.bodySha256 ?? "-"],
        ["expires", result.expiresAt ?? "-"],
        ["rate limit", formatRateLimit(result)],
        ["cache path", result.cachePath],
      ]),
      ...(result.recommendation ? ["", muted("recommendation"), `  ${result.recommendation}`] : []),
      ...(result.failure ? ["", tuiError("failure"), `  ${result.failure.reason}: ${result.failure.message}`] : []),
      ...(result.bodyPreview ? ["", muted("body preview"), ...result.bodyPreview.split(/\r?\n/).slice(0, 12).map((line) => `  ${truncate(line, 100)}`)] : []),
    ]),
  );
}

function formatRateLimit(result: RequestFetchResult): string {
  if (!result.rateLimit) {
    return "-";
  }
  const remaining = result.rateLimit.remaining ?? "?";
  const limit = result.rateLimit.limit ?? "?";
  const reset = result.rateLimit.reset ? ` reset=${result.rateLimit.reset}` : "";
  const resource = result.rateLimit.resource ? ` ${result.rateLimit.resource}` : "";
  return `${remaining}/${limit}${resource}${reset}`;
}
