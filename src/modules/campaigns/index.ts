// Public API of the campaigns module (CRM-style bulk messaging).

// --- Service (server-only) --------------------------------------------------
export {
  canManageCampaigns,
  canCreateCampaign,
  canEditCampaign,
  canSendCampaign,
  canCancelCampaign,
  getCampaignFormData,
  listCampaignsView,
  getCampaignDetail,
  createCampaign,
  snapshotAudience,
  sendCampaign,
  cancelCampaign,
} from "./campaigns.service";

// --- Orchestrator (used by the engine) --------------------------------------
export { runCampaigns } from "./campaigns.orchestrator";
export type { CampaignPorts, CampaignRunResult } from "./campaigns.orchestrator";

// --- Schema (isomorphic) ----------------------------------------------------
export {
  campaignCreateSchema,
  campaignCancelSchema,
  campaignSendSchema,
} from "./campaigns.schema";
export type {
  CampaignCreateInput,
  CampaignCancelInput,
  CampaignSendInput,
} from "./campaigns.schema";

// --- Types (isomorphic) -----------------------------------------------------
export type {
  AudienceFilter,
  CampaignRow,
  CampaignRecipientRow,
  CampaignDetail,
  CampaignFormData,
  CampaignListParams,
  CampaignListResult,
  SendAttemptResult,
} from "./campaigns.types";

// --- Guards (isomorphic) ----------------------------------------------------
export {
  isCampaignEditable,
  isCampaignSendable,
  CAMPAIGN_FORBIDDEN,
  CAMPAIGN_NOT_FOUND,
  CAMPAIGN_NOT_EDITABLE,
  CAMPAIGN_NOT_SENDABLE,
  CAMPAIGN_NO_RECIPIENTS,
  SMS_TEMPLATE_REQUIRED,
  INTERNAL_BODY_REQUIRED,
  CAMPAIGN_ALREADY_RUNNING,
  CAMPAIGN_FINISHED,
} from "./campaigns.guards";

// --- Presentation labels (isomorphic) ---------------------------------------
export {
  CAMPAIGN_CHANNEL_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_BADGE,
  RECIPIENT_STATUS_LABELS,
  RECIPIENT_STATUS_BADGE,
} from "./lib/labels";

// --- Module UI (for server pages) -------------------------------------------
export { CampaignForm } from "./components/campaign-form";
export { CampaignsTable } from "./components/campaigns-table";
export { CampaignSendPanel } from "./components/campaign-send-panel";
export { CampaignCancelButton } from "./components/campaign-cancel-button";