import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Topbar } from "@/components/layout/topbar"
import {
  LeadDetailClient,
  LeadDetailActions,
} from "@/components/pipeline/lead-detail-client"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { ProductLine } from "@/types"

// ── Product line label map ───────────────────────────────────────────────────

const PRODUCT_LINE_LABELS: Record<ProductLine, string> = {
  stracomm: "Stracomm",
  smm: "Social Media",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Management",
  production: "Production",
  others: "Others",
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchLead(id: string) {
  return prisma.lead.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, name: true, customerCode: true } },
      sales: { select: { id: true, name: true } },
      documents: {
        include: { uploader: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
      stageHistory: {
        include: { changer: { select: { id: true, name: true } } },
        orderBy: { changedAt: "desc" },
      },
      fieldHistory: {
        include: { changer: { select: { id: true, name: true } } },
        orderBy: { changedAt: "desc" },
      },
    },
  })
}

// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  })
  if (!lead) return { title: "Lead Detail" }
  const productLabel = PRODUCT_LINE_LABELS[lead.productLine as ProductLine] ?? lead.productLine
  return { title: `${lead.client.name} — ${productLabel}` }
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface LeadDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function LeadDetailPage({ params }: LeadDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  const [lead, currentDbUser, salesOptions] = await Promise.all([
    fetchLead(id),
    supabaseUser?.email
      ? prisma.user.findUnique({
          where: { email: supabaseUser.email },
          select: { role: true },
        })
      : null,
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  if (!lead) notFound()

  const userRole = currentDbUser?.role === "admin" ? "admin" : "account"

  // Serialize: Date → ISO string, Decimal → number
  const serializedLead = {
    id: lead.id,
    clientId: lead.clientId,
    productLine: lead.productLine as ProductLine,
    description: lead.description,
    projectType: lead.projectType,
    stage: lead.stage,
    salesId: lead.salesId,
    projectedRevenue: lead.projectedRevenue ? Number(lead.projectedRevenue) : null,
    billingPlan: lead.billingPlan,
    quarter: lead.quarter,
    actualRevenue: lead.actualRevenue ? Number(lead.actualRevenue) : null,
    lossDealReason: lead.lossDealReason,
    invoiceRequestedAt: lead.invoiceRequestedAt?.toISOString() ?? null,
    notes: lead.notes,
    createdAt: lead.createdAt.toISOString(),
    closedAt: lead.closedAt?.toISOString() ?? null,
    updatedAt: lead.updatedAt.toISOString(),
    client: {
      id: lead.client.id,
      name: lead.client.name,
      customerCode: lead.client.customerCode,
    },
    sales: lead.sales ? { id: lead.sales.id, name: lead.sales.name } : null,
    documents: lead.documents.map((doc) => ({
      id: doc.id,
      leadId: doc.leadId,
      type: doc.type,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      uploadedAt: doc.uploadedAt.toISOString(),
      uploadedBy: doc.uploadedBy,
      createdAt: doc.createdAt.toISOString(),
      uploader: doc.uploader ?? undefined,
    })),
    stageHistory: lead.stageHistory.map((h) => ({
      id: h.id,
      leadId: h.leadId,
      fromStage: h.fromStage,
      toStage: h.toStage,
      changedBy: h.changedBy,
      changedAt: h.changedAt.toISOString(),
      changer: h.changer ?? undefined,
    })),
    fieldHistory: lead.fieldHistory.map((h) => ({
      id: h.id,
      leadId: h.leadId,
      field: h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      changedBy: h.changedBy,
      changedAt: h.changedAt.toISOString(),
      changer: h.changer ?? undefined,
    })),
  }

  return (
    <>
      <Topbar title={lead.client.name}>
        <LeadDetailActions leadId={lead.id} stage={lead.stage} userRole={userRole} />
      </Topbar>
      <LeadDetailClient lead={serializedLead} salesOptions={salesOptions} />
    </>
  )
}
