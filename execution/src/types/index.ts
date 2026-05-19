// ─────────────────────────────────────────────
// VF ERP System — Shared TypeScript Types
// Phase 2: CRM + BizDev Pipeline
// ─────────────────────────────────────────────

// ── Enums ──────────────────────────────────────

export type Role = "admin" | "commercial_director" | "account" | "operation" | "hr" | "finance"

export type EngagementType = "retainer" | "project" | "both"

export type HealthStatus = "healthy" | "at_risk" | "churned"

export type ClientStatus = "active" | "inactive" | "lead"

export type UpsellStatus = "identified" | "pitched" | "won" | "lost"

export type PipelineStage =
  | "leads"
  | "pipeline"
  | "negotiation"
  | "closed_won"
  | "lost_deal"
  | "invoiced"
  | "contract_renewal"
  | "no_response"

export type ProjectType = "one_time" | "retainer"

export type ProductLine =
  | "stracomm"
  | "smm"
  | "creative_strategy"
  | "media_buying"
  | "ads_management"
  | "production"
  | "others"

export type DocumentType = "quotation" | "quotation_signed" | "contract" | "other"

export type TargetType = "monthly" | "quarterly"

export type ContractUrgency = "critical" | "warning" | "notice" | "none"

// ── Domain Models ────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  role: Role
  division?: string | null
  isActive: boolean
  isVp: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Client {
  id: string
  name: string
  customerCode?: string | null
  industry?: string | null
  orgSize?: string | null
  engagementType: EngagementType
  contractStart?: Date | null
  contractEnd?: Date | null
  monthlyValue?: number | null
  annualValue?: number | null
  healthStatus: HealthStatus
  clientStatus?: ClientStatus | null
  primaryAe?: string | null
  notes?: string | null
  createdAt: Date
  updatedAt: Date
  ae?: User | null
  contacts?: Contact[]
  upsellOpportunities?: UpsellOpportunity[]
  leads?: Lead[]
}

export interface Contact {
  id: string
  clientId: string
  name: string
  role?: string | null
  email?: string | null
  phone?: string | null
  isPrimary: boolean
  createdAt: Date
}

export interface UpsellOpportunity {
  id: string
  clientId: string
  service: string
  status: UpsellStatus
  estimatedValue?: number | null
  notes?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Lead {
  id: string
  clientId: string
  productLine: ProductLine
  description?: string | null
  projectType: ProjectType
  stage: PipelineStage
  salesId?: string | null
  projectedRevenue?: number | null
  billingPlan?: string | null
  quarter?: string | null
  actualRevenue?: number | null
  lossDealReason?: string | null
  invoiceRequestedAt?: Date | null
  notes?: string | null
  createdAt: Date
  closedAt?: Date | null
  updatedAt: Date
  client?: Pick<Client, "id" | "name" | "customerCode">
  sales?: Pick<User, "id" | "name"> | null
  documents?: PipelineDocument[]
  stageHistory?: LeadStageHistory[]
  fieldHistory?: LeadFieldHistory[]
}

export interface LeadStageHistory {
  id: string
  leadId: string
  fromStage: PipelineStage
  toStage: PipelineStage
  changedBy: string
  changedAt: Date
  changer?: Pick<User, "id" | "name">
}

export interface LeadFieldHistory {
  id: string
  leadId: string
  field: string
  oldValue: string | null
  newValue: string | null
  changedBy: string
  changedAt: Date
  changer?: Pick<User, "id" | "name">
}

export interface PipelineDocument {
  id: string
  leadId: string
  type: DocumentType
  fileUrl: string
  fileName?: string | null
  uploadedAt: Date
  uploadedBy: string
  createdAt: Date
  uploader?: Pick<User, "id" | "name">
}

export interface Target {
  id: string
  periodMonth: number
  periodYear: number
  revenueTarget: number
  newClientTarget: number
  type: TargetType
  createdAt: Date
  updatedAt: Date
}

// ── UI / Display Helpers ─────────────────────────

export interface KPICardData {
  label: string
  value: string
  trend?: {
    direction: "up" | "down" | "neutral"
    value: string
    label: string
  }
}

export interface StageMoveResult {
  success: boolean
  error?: string
}

// ── Gate Validation ──────────────────────────────

export interface GateCheckResult {
  allowed: boolean
  reason?: string
}

// ── Auth / Session ───────────────────────────────

export interface SessionUser {
  id: string
  email: string
  name: string
  role: Role
  isVp: boolean
}

// ── Bulk Lead Creation ───────────────────────────

export interface BulkLeadCreatePayload {
  clientId: string
  productLine: ProductLine
  projectType: ProjectType
  billingPlans: string[]
  description?: string | null
  salesId?: string | null
  projectedRevenue?: number | null
  stage?: PipelineStage
  notes?: string | null
}
