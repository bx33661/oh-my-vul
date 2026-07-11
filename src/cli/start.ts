import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, join, resolve } from "node:path";
import {
  initCampaign,
  resolveCampaignInput,
  type CampaignEcosystem,
  type CampaignInput,
  type CampaignPromptAdapter,
  type InitCampaignResult,
} from "./campaign.js";
import { initWorkspace, type WorkspaceStatus } from "./workspace.js";

const execFileAsync = promisify(execFile);

export interface ProjectContext {
  root: string;
  target: string;
  version?: string;
  source?: string;
  ecosystem: CampaignEcosystem;
  manifest?: string;
  detectedFrom: string[];
  warnings: string[];
}

export interface StartResearchOptions {
  projectRoot?: string;
  force?: boolean;
  interactive: boolean;
  prompt?: CampaignPromptAdapter;
}

export interface StartResearchResult {
  project: ProjectContext;
  workspace: WorkspaceStatus;
  campaign: InitCampaignResult;
}

const MANIFEST_ECOSYSTEMS: Array<[string, CampaignEcosystem]> = [
  ["pyproject.toml", "python"],
  ["setup.py", "python"],
  ["go.mod", "go"],
  ["Cargo.toml", "rust"],
  ["pom.xml", "java"],
  ["build.gradle", "java"],
  ["Gemfile", "ruby"],
  ["composer.json", "php"],
  ["Package.swift", "swift"],
  ["pubspec.yaml", "dart"],
  ["mix.exs", "elixir"],
  ["Makefile.PL", "perl"],
  ["cpanfile", "perl"],
  ["DESCRIPTION", "r"],
];

export async function detectProjectContext(projectRoot = process.cwd()): Promise<ProjectContext> {
  const root = resolve(projectRoot);
  const context: ProjectContext = {
    root,
    target: basename(root),
    ecosystem: "unknown",
    detectedFrom: ["directory name"],
    warnings: [],
  };
  const packageJsonPath = join(root, "package.json");

  if (existsSync(packageJsonPath)) {
    context.ecosystem = "npm";
    context.manifest = packageJsonPath;
    context.detectedFrom.push("package.json");
    try {
      const pkg = JSON.parse(await readFile(packageJsonPath, "utf-8")) as {
        name?: unknown;
        version?: unknown;
        repository?: string | { url?: unknown };
      };
      if (typeof pkg.name === "string" && pkg.name.trim()) context.target = pkg.name.trim();
      if (typeof pkg.version === "string" && pkg.version.trim()) context.version = pkg.version.trim();
      const repository = typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url;
      if (typeof repository === "string" && repository.trim()) context.source = repository.trim();
    } catch (error) {
      context.warnings.push(`Unable to read package.json metadata: ${errorMessage(error)}`);
    }
  } else {
    for (const [manifest, ecosystem] of MANIFEST_ECOSYSTEMS) {
      const path = join(root, manifest);
      if (existsSync(path)) {
        context.ecosystem = ecosystem;
        context.manifest = path;
        context.detectedFrom.push(manifest);
        break;
      }
    }
    if (context.ecosystem === "unknown") {
      const entries = await readdir(root).catch(() => []);
      const matched = entries.find((entry) => entry.endsWith(".csproj"))
        ?? entries.find((entry) => entry.endsWith(".rockspec"));
      if (matched) {
        context.ecosystem = matched.endsWith(".csproj") ? "csharp" : "lua";
        context.manifest = join(root, matched);
        context.detectedFrom.push(matched);
      }
    }
  }

  const remote = await readGitRemote(root);
  if (remote) {
    context.source = remote;
    context.detectedFrom.push("git remote.origin.url");
  }
  return context;
}

export async function startResearch(
  input: CampaignInput,
  options: StartResearchOptions,
): Promise<StartResearchResult> {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const project = await detectProjectContext(projectRoot);
  const workspace = await initWorkspace(projectRoot, { gitignore: true });
  const resolvedInput = await resolveCampaignInput({
    ...input,
    target: input.target ?? project.target,
    version: input.version ?? project.version,
    source: input.source ?? project.source,
    ecosystem: input.ecosystem ?? project.ecosystem,
  }, {
    interactive: options.interactive,
    prompt: options.prompt,
  });
  const campaign = await initCampaign(resolvedInput, {
    projectRoot,
    force: options.force,
  });
  return { project, workspace, campaign };
}

async function readGitRemote(projectRoot: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("git", ["-C", projectRoot, "config", "--get", "remote.origin.url"], {
      encoding: "utf-8",
    });
    const value = stdout.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
