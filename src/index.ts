export { setup } from "./cli/setup.js";
export { doctor } from "./cli/doctor.js";
export { readCatalog, getInstallableSkills, parseCatalog } from "./cli/catalog.js";
export {
  listFindings,
  validateFinding,
  validateFindings,
  promoteFinding,
  archiveFinding,
  createFindingTemplate,
  ensureFindingsDir,
  listArchivedFindings,
  listFindingWorkflow,
  restoreFinding,
  showFinding,
} from "./cli/findings.js";
export {
  claudeSkillsDir,
  claudeHome,
  projectClaudeHome,
  projectSkillsDir,
  omvStateDir,
  findingsDir,
  archiveDir,
  archivedFindingsDir,
  archiveMetadataDir,
  archiveMetadataPath,
  reportsDir,
  findingReportsDir,
  reproDir,
  findingReproDir,
  workspaceIndexPath,
  workspaceActivityLogPath,
  setupScopePath,
  packageRoot,
  packageSkillsDir,
} from "./cli/paths.js";
export {
  initWorkspace,
  workspaceStatus,
  rebuildWorkspaceIndex,
  readWorkspaceIndex,
  appendWorkspaceActivity,
  readWorkspaceActivity,
} from "./cli/workspace.js";
export type { SetupOptions, SetupResult } from "./cli/setup.js";
export type { DoctorResult } from "./cli/doctor.js";
export type { OmvCatalog, SkillCatalogEntry } from "./cli/catalog.js";
export type {
  EvidenceStatus,
  FindingSummary,
  FindingWorkflowSummary,
  FindingDetail,
  FindingTemplateResult,
  FindingValidation,
  ArchivedFindingSummary,
  FindingArchiveResult,
  FindingRestoreResult,
  CreateFindingTemplateOptions,
  FindingVerdict,
} from "./cli/findings.js";
