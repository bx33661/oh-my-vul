import { mkdir, cp, readFile, writeFile, rm, readdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import {
  claudeAgentsDir,
  claudeSkillsDir,
  codexSkillsDir,
  omvStateDir,
  packageRoot,
  projectAgentsDir,
  projectCodexSkillsDir,
  projectSkillsDir,
  setupScopePath,
} from "./paths.js";
import { getInstallableSkills, readCatalog } from "./catalog.js";
import { buildInstallManifest, installManifestPath, readInstallManifest, writeInstallManifest } from "./install-manifest.js";

export type SetupScope = "user" | "project";
export type SetupPlatform = "claude-code" | "codex";

export interface SetupOptions {
  force?: boolean;
  dryRun?: boolean;
  scope?: SetupScope;
  platform?: SetupPlatform;
  projectRoot?: string;
}

export interface SetupResult {
  scope: SetupScope;
  platform: SetupPlatform;
  destination: string;
  installed: string[];
  installedAgents: string[];
  skipped: string[];
  errors: string[];
  dryRun?: boolean;
  verification?: {
    ok: boolean;
    warnings: boolean;
    passed: number;
    warned: number;
    failed: number;
  };
  nextAction?: string;
}

export interface UninstallOptions {
  scope?: SetupScope;
  platform?: SetupPlatform;
  projectRoot?: string;
  json?: boolean;
}

export interface UninstallResult {
  scope: SetupScope;
  platform: SetupPlatform;
  skillsDir: string;
  agentsDir: string;
  removed: string[];
  agentsRemoved: string[];
  notFound: string[];
  errors: string[];
  manifestRemoved: boolean;
  setupScopeRemoved: boolean;
}

export async function uninstall(options: UninstallOptions = {}): Promise<UninstallResult> {
  const { scope = "user", platform = "claude-code", projectRoot = process.cwd() } = options;
  const skillsDir = resolveSkillsDir(scope, platform, projectRoot);
  const agentsDir = scope === "project" ? projectAgentsDir(projectRoot) : claudeAgentsDir();
  const result: UninstallResult = {
    scope,
    platform,
    skillsDir,
    agentsDir,
    removed: [],
    agentsRemoved: [],
    notFound: [],
    errors: [],
    manifestRemoved: false,
    setupScopeRemoved: false,
  };

  const manifest = await readInstallManifest(installManifestPath(scope, projectRoot, platform));
  const skillsToRemove = manifest?.skills.map((s) => s.name) ?? [];
  const agentsToRemove = manifest?.agents ?? [];

  for (const skill of skillsToRemove) {
    const dest = join(skillsDir, skill);
    if (!existsSync(dest)) {
      result.notFound.push(skill);
      continue;
    }
    try {
      await rm(dest, { recursive: true, force: true });
      result.removed.push(skill);
    } catch (err) {
      result.errors.push(`${skill}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Remove installed agent .md files (best-effort; not an error if missing).
  for (const agent of agentsToRemove) {
    const dest = join(agentsDir, agent.file);
    if (!existsSync(dest)) {
      continue;
    }
    try {
      await rm(dest, { force: true });
      result.agentsRemoved.push(agent.name);
    } catch (err) {
      result.errors.push(`agent:${agent.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Remove install manifest
  const manifestPath = installManifestPath(scope, projectRoot, platform);
  if (existsSync(manifestPath)) {
    try {
      await rm(manifestPath, { force: true });
      result.manifestRemoved = true;
    } catch (err) {
      result.errors.push(`manifest: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Remove setup-scope.json for project scope
  if (scope === "project") {
    const scopePath = setupScopePath(projectRoot);
    if (existsSync(scopePath)) {
      try {
        const persisted = JSON.parse(await readFile(scopePath, "utf-8")) as {
          platform?: SetupPlatform;
        };
        if ((persisted.platform ?? "claude-code") === platform) {
          await rm(scopePath, { force: true });
          result.setupScopeRemoved = true;
        }
      } catch (err) {
        result.errors.push(`setup-scope: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return result;
}

export async function setup(options: SetupOptions = {}): Promise<SetupResult> {
  const { force = false, dryRun = false, scope = "user", platform = "claude-code", projectRoot = process.cwd() } = options;
  const destDir = resolveSkillsDir(scope, platform, projectRoot);
  const agentsDir = scope === "project" ? projectAgentsDir(projectRoot) : claudeAgentsDir();
  const result: SetupResult = {
    scope,
    platform,
    destination: destDir,
    installed: [],
    installedAgents: [],
    skipped: [],
    errors: [],
    dryRun,
  };

  const catalog = await readCatalog();
  const skillDirs = getInstallableSkills(catalog);

  if (skillDirs.length === 0) {
    result.errors.push("no installable skills found in registry");
    return result;
  }

  if (!dryRun) {
    await mkdir(destDir, { recursive: true });
    if (scope === "project") {
      await mkdir(omvStateDir(projectRoot), { recursive: true });
      await writeFile(
        setupScopePath(projectRoot),
        JSON.stringify({ scope, platform, installed_at: new Date().toISOString() }, null, 2) + "\n",
        "utf-8",
      );
    }
  }

  for (const skill of skillDirs) {
    const src = join(packageRoot(), skill.path);
    const dest = join(destDir, skill.name);

    if (!existsSync(join(src, "SKILL.md"))) {
      result.errors.push(`${skill.name}: skill directory not found: ${src}`);
      continue;
    }

    if (existsSync(dest) && !force) {
      result.skipped.push(skill.name);
      continue;
    }

    if (!dryRun) {
      try {
        await cp(src, dest, { recursive: true, force: true });
        result.installed.push(skill.name);
      } catch (err) {
        result.errors.push(`${skill.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      result.installed.push(skill.name);
    }
  }

  if (!dryRun && platform === "claude-code") {
    await mkdir(agentsDir, { recursive: true });
  }

  // Install each agents/*.md as a Claude Code subagent definition.
  // Each agent file has frontmatter (name, description, tools, model) and is
  // auto-discovered by Claude Code under .claude/agents/ (project) or
  // ~/.claude/agents/ (user).
  const agentsSrc = join(packageRoot(), "agents");
  if (platform === "claude-code" && existsSync(agentsSrc)) {
    let agentFiles: string[] = [];
    try {
      agentFiles = (await readdir(agentsSrc)).filter((f) => f.endsWith(".md"));
    } catch (err) {
      result.errors.push(`agents: ${err instanceof Error ? err.message : String(err)}`);
    }
    for (const agentFile of agentFiles) {
      const src = join(agentsSrc, agentFile);
      const dest = join(agentsDir, agentFile);
      const agentName = agentFile.replace(/\.md$/, "");

      if (existsSync(dest) && !force) {
        result.skipped.push(`agent:${agentName}`);
        continue;
      }

      if (!dryRun) {
        try {
          await cp(src, dest, { force: true });
          result.installedAgents.push(agentName);
        } catch (err) {
          result.errors.push(`agent:${agentName}: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        result.installedAgents.push(agentName);
      }
    }
  }

  if (!dryRun && result.errors.length === 0) {
    const manifest = await buildInstallManifest({
      scope,
      platform,
      skillsDir: destDir,
      skills: skillDirs,
      registryVersion: catalog.version,
      projectRoot,
      agentsDir,
      agents: result.installedAgents,
    });
    await writeInstallManifest(installManifestPath(scope, projectRoot, platform), manifest);
  }

  return result;
}

export function resolveSkillsDir(
  scope: SetupScope,
  platform: SetupPlatform,
  projectRoot = process.cwd(),
): string {
  if (platform === "codex") {
    return scope === "project" ? projectCodexSkillsDir(projectRoot) : codexSkillsDir();
  }
  return scope === "project" ? projectSkillsDir(projectRoot) : claudeSkillsDir();
}
