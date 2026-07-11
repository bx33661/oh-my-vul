export { setup } from "./cli/setup.js";
export { detectProjectContext, startResearch } from "./cli/start.js";
export { doctor } from "./cli/doctor.js";
export { readCatalog, getInstallableSkills, parseCatalog } from "./cli/catalog.js";
export {
  CAMPAIGN_DEPTHS,
  CAMPAIGN_ECOSYSTEMS,
  CAMPAIGN_LOCAL_REPRODUCTIONS,
  CAMPAIGN_MODES,
  CAMPAIGN_OUTPUTS,
  buildCampaign,
  initCampaign,
  listCampaigns,
  normalizeCampaignId,
  normalizeVulnerabilityClasses,
  parseCampaignYaml,
  renderCampaignRunbook,
  resolveCampaignInput,
  showCampaign,
  validateCampaign,
} from "./cli/campaign.js";
export { seedCampaign } from "./cli/campaign-seed.js";
export { ReadlineCampaignPrompt } from "./cli/campaign-prompt.js";
export { initSourceRef, parseSourceRefYaml, showSourceRef, validateSourceRef } from "./cli/source-ref.js";
export {
  createReportProvenance,
  listReportFiles,
  parseReportProvenanceJson,
  validateReportProvenance,
} from "./cli/report-provenance.js";
export {
  listFindings,
  validateFinding,
  validateFindings,
  promoteFinding,
  archiveFinding,
  checkReportArtifacts,
  createFindingTemplate,
  doctorFinding,
  ensureFindingsDir,
  initReproArtifacts,
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
  campaignsDir,
  campaignPath,
  campaignRunbookPath,
  sourcesDir,
  sourceRefPath,
  archiveDir,
  archivedFindingsDir,
  archiveMetadataDir,
  archiveMetadataPath,
  reportsDir,
  findingReportsDir,
  reportProvenancePath,
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
export type { ProjectContext, StartResearchOptions, StartResearchResult } from "./cli/start.js";
export type { DoctorResult } from "./cli/doctor.js";
export type { OmvCatalog, SkillCatalogEntry } from "./cli/catalog.js";
export type {
  Campaign,
  CampaignInput,
  CampaignLane,
  CampaignSummary,
  CampaignPromptAdapter,
  InitCampaignOptions,
  InitCampaignResult,
  ShowCampaignResult,
} from "./cli/campaign.js";
export type {
  CampaignSeedFailure,
  CampaignSeedResult,
  CampaignSeedSkipped,
} from "./cli/campaign-seed.js";
export type {
  SourceRef,
  SourceRefDetail,
  SourceRefEntry,
  SourceRefInitOptions,
  SourceRefInitResult,
  SourceRefKind,
  SourceRefValidation,
} from "./cli/source-ref.js";
export type {
  CreateReportProvenanceOptions,
  ReportProvenanceInput,
  ReportProvenanceManifest,
  ReportProvenanceResult,
  ReportProvenanceRole,
  ReportProvenanceValidation,
} from "./cli/report-provenance.js";
export type {
  EvidenceStatus,
  EvidenceEcosystem,
  EvidenceResearcherGoal,
  FindingTemplateSeed,
  FindingSummary,
  FindingWorkflowSummary,
  FindingDetail,
  FindingTemplateResult,
  FindingValidation,
  ArchivedFindingSummary,
  FindingArchiveResult,
  FindingRestoreResult,
  FindingDoctorIssue,
  FindingDoctorResult,
  ReportArtifactsResult,
  ReproInitResult,
  CreateFindingTemplateOptions,
  FindingVerdict,
} from "./cli/findings.js";
export { createWorkflowAction } from "./cli/workflow.js";
export type { WorkflowAction, WorkflowActionSurface } from "./cli/workflow.js";
