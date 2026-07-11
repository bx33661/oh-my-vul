export { setup, uninstall } from "./cli/setup.js";
export { detectProjectContext, startResearch } from "./cli/start.js";
export { doctor } from "./cli/doctor.js";
export { reviewFinding } from "./cli/review.js";
export {
  CAMPAIGN_DEPTHS,
  CAMPAIGN_ECOSYSTEMS,
  CAMPAIGN_LOCAL_REPRODUCTIONS,
  CAMPAIGN_MODES,
  CAMPAIGN_OUTPUTS,
  buildCampaign,
  initCampaign,
  listCampaigns,
  showCampaign,
  validateCampaign,
} from "./cli/campaign.js";
export { seedCampaign } from "./cli/campaign-seed.js";
export { initSourceRef, showSourceRef, validateSourceRef } from "./cli/source-ref.js";
export {
  createReportProvenance,
  listReportFiles,
  validateReportProvenance,
} from "./cli/report-provenance.js";
export {
  EVIDENCE_ECOSYSTEMS,
  archiveFinding,
  checkReportArtifacts,
  createFindingTemplate,
  doctorFinding,
  initReproArtifacts,
  listArchivedFindings,
  listFindings,
  listFindingWorkflow,
  promoteFinding,
  restoreFinding,
  showFinding,
  validateFinding,
  validateFindings,
} from "./cli/findings.js";
export {
  initWorkspace,
  readWorkspaceActivity,
  workspaceStatus,
} from "./cli/workspace.js";

export type {
  SetupOptions,
  SetupPlatform,
  SetupResult,
  SetupScope,
  UninstallOptions,
  UninstallResult,
} from "./cli/setup.js";
export type { ProjectContext, StartResearchOptions, StartResearchResult } from "./cli/start.js";
export type { Check, DoctorOptions, DoctorResult } from "./cli/doctor.js";
export type { FindingReview, ReviewVerdict } from "./cli/review.js";
export type {
  Campaign,
  CampaignDepth,
  CampaignEcosystem,
  CampaignInput,
  CampaignLane,
  CampaignLocalReproduction,
  CampaignMode,
  CampaignOutput,
  CampaignProfile,
  CampaignPromptAdapter,
  CampaignScope,
  CampaignStatus,
  CampaignSummary,
  CampaignTarget,
  InitCampaignOptions,
  InitCampaignResult,
  ShowCampaignResult,
} from "./cli/campaign.js";
export type {
  CampaignFindingCreator,
  CampaignSeedFailure,
  CampaignSeedResult,
  CampaignSeedSkipped,
  SeedCampaignDependencies,
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
  ArchivedFindingSummary,
  CreateFindingTemplateOptions,
  EvidenceEcosystem,
  EvidenceResearcherGoal,
  EvidenceStatus,
  FindingArchiveResult,
  FindingDetail,
  FindingDoctorIssue,
  FindingDoctorResult,
  FindingRestoreResult,
  FindingSummary,
  FindingTemplateResult,
  FindingTemplateSeed,
  FindingValidation,
  FindingVerdict,
  FindingWorkflowSummary,
  ReportArtifactsResult,
  ReproInitResult,
} from "./cli/findings.js";
export type {
  InitWorkspaceOptions,
  WorkspaceActivityEntry,
  WorkspaceStatus,
} from "./cli/workspace.js";
