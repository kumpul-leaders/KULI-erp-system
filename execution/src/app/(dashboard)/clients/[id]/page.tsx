import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Topbar } from "@/components/layout/topbar"
import { Badge } from "@/components/ui/badge"
import { HealthBadge } from "@/components/clients/health-badge"
import { ClientStatusBadge } from "@/components/clients/client-status-badge"
import { ContactsCard } from "@/components/clients/contacts-card"
import { UpsellsCard } from "@/components/clients/upsells-card"
import { NotesCard } from "@/components/clients/notes-card"
import { AeCard } from "@/components/clients/ae-card"
import { ClientDetailActions } from "@/components/clients/client-detail-actions"
import { EditStatusButton } from "@/components/clients/edit-status-button"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { formatIDR, daysUntil, contractUrgency } from "@/lib/utils"
// ── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const client = await prisma.client.findUnique({
    where: { id },
    select: { name: true },
  })
  return { title: client?.name ?? "Client Profile" }
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchClient(id: string) {
  return prisma.client.findUnique({
    where: { id },
    include: {
      ae: { select: { id: true, name: true, email: true } },
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      upsellOpportunities: { orderBy: { createdAt: "desc" } },
      fieldHistory: {
        orderBy: { changedAt: "desc" },
        take: 30,
        include: { changer: { select: { name: true } } },
      },
    },
  })
}

async function fetchAeOptions() {
  return prisma.user.findMany({
    where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(val: Date | null | undefined): string {
  if (!val) return "—"
  return new Date(val).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function engagementLabel(type: string): string {
  const labels: Record<string, string> = {
    retainer: "Retainer",
    project: "Project",
    both: "Retainer + Project",
  }
  return labels[type] ?? type
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface ClientDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const dbUser = user ? await prisma.user.findUnique({
    where: { email: user.email! },
    select: { role: true },
  }) : null
  const userRole = dbUser?.role ?? null
  const isAdmin = userRole === "admin" || userRole === "commercial_director"

  const [client, aeOptions, clientLeads] = await Promise.all([
    fetchClient(id),
    fetchAeOptions(),
    prisma.lead.findMany({
      where: { clientId: id },
      include: { sales: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }],
    }),
  ])

  if (!client) notFound()

  // Normalize Decimal for serialization to client components
  const monthlyValue = client.monthlyValue ? Number(client.monthlyValue) : null
  const annualValue = client.annualValue ? Number(client.annualValue) : null

  // Contract urgency
  const contractDays = client.contractEnd ? daysUntil(client.contractEnd) : null
  const urgency = contractDays !== null ? contractUrgency(contractDays) : "none"
  const isContractUrgent = urgency === "critical" || urgency === "warning"

  // Normalized contacts for client component (serialize Date → string)
  const contacts = client.contacts.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }))

  // Normalized upsells
  const upsells = client.upsellOpportunities.map((u) => ({
    ...u,
    estimatedValue: u.estimatedValue ? Number(u.estimatedValue) : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }))

  // Normalized field history (serialize changedAt)
  const fieldHistory = client.fieldHistory.map((entry) => ({
    id: entry.id,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    changedAt: entry.changedAt.toISOString(),
    changerName: entry.changer.name,
  }))

  // Serialize leads for Linked Projects section
  type SerializedClientLead = {
    id: string
    stage: string
    productLine: string | null
    billingPlan: string | null
    actualRevenue: number | null
    projectedRevenue: number | null
    salesName: string | null
    createdAt: string
  }

  const WON_STAGES_CLIENT = ["closed_won", "invoiced", "contract_renewal"]
  const IN_PROGRESS_STAGES = ["leads", "pipeline", "negotiation"]
  const CLOSED_STAGES = ["lost_deal", "no_response"]

  const serializedLeads: SerializedClientLead[] = clientLeads.map((l) => ({
    id: l.id,
    stage: l.stage,
    productLine: l.productLine,
    billingPlan: l.billingPlan,
    actualRevenue: l.actualRevenue ? Number(l.actualRevenue) : null,
    projectedRevenue: l.projectedRevenue ? Number(l.projectedRevenue) : null,
    salesName: l.sales?.name ?? null,
    createdAt: l.createdAt.toISOString(),
  }))

  const wonLeads = serializedLeads.filter((l) => WON_STAGES_CLIENT.includes(l.stage))
  const inProgressLeads = serializedLeads.filter((l) => IN_PROGRESS_STAGES.includes(l.stage))
  const closedLeads = serializedLeads.filter((l) => CLOSED_STAGES.includes(l.stage))

  // KPI values (Sprint 6.6)
  const cumulativeValue = wonLeads.reduce((sum, l) => sum + (l.actualRevenue ?? 0), 0)
  const opportunityValue = inProgressLeads.reduce((sum, l) => sum + (l.projectedRevenue ?? 0), 0)

  // Client data for edit sheet (serialize dates, include new fields)
  const clientForEdit = {
    id: client.id,
    name: client.name,
    customerCode: client.customerCode,
    industry: client.industry,
    orgSize: client.orgSize,
    engagementType: client.engagementType,
    contractStart: client.contractStart?.toISOString() ?? null,
    contractEnd: client.contractEnd?.toISOString() ?? null,
    monthlyValue,
    annualValue,
    healthStatus: client.healthStatus,
    clientStatus: client.clientStatus,
    primaryAe: client.primaryAe,
    notes: client.notes,
  }

  function LinkedProjectRow({ lead }: { lead: SerializedClientLead }) {
    const STAGE_LABELS: Record<string, string> = {
      leads: "Leads", pipeline: "Pipeline", negotiation: "Negotiation",
      closed_won: "Closed Won", invoiced: "Invoiced", contract_renewal: "Contract Renewal",
      lost_deal: "Lost Deal", no_response: "No Response",
    }
    const PRODUCT_LABELS: Record<string, string> = {
      stracomm: "Stracomm", smm: "SMM", creative_strategy: "Creative Strategy",
      media_buying: "Media Buying", ads_management: "Ads Mgmt", production: "Production", others: "Others",
    }
    const quarter = lead.billingPlan
      ? `Q${Math.ceil(parseInt(lead.billingPlan.split("-")[1]) / 3)} '${lead.billingPlan.split("-")[0]}`
      : null

    return (
      <Link
        href={`/pipeline/${lead.id}`}
        className="flex items-center gap-3 rounded-md border border-neutral-100 bg-neutral-50 px-3 py-2 hover:bg-neutral-100 hover:border-neutral-200 transition-colors group"
      >
        <Badge variant="outline" className="text-xs shrink-0">{STAGE_LABELS[lead.stage] ?? lead.stage}</Badge>
        {lead.productLine && (
          <span className="text-xs text-neutral-600">{PRODUCT_LABELS[lead.productLine] ?? lead.productLine}</span>
        )}
        {quarter && <span className="text-xs text-neutral-400">{quarter}</span>}
        <span className="ml-auto text-xs font-medium tabular-nums text-neutral-700">
          {lead.actualRevenue ? formatIDR(lead.actualRevenue) : lead.projectedRevenue ? formatIDR(lead.projectedRevenue) : "—"}
        </span>
      </Link>
    )
  }

  return (
    <>
      <Topbar title={client.name}>
        <ClientDetailActions client={clientForEdit} aeOptions={aeOptions} isAdmin={isAdmin} />
      </Topbar>

      <main className="flex-1 overflow-y-auto px-8 py-6">
        {/* Back link */}
        <Link
          href="/clients"
          className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Clients
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-neutral-900">{client.name}</h1>
            {client.customerCode && (
              <code className="px-2 py-0.5 rounded text-xs font-mono bg-neutral-100 text-neutral-600 border border-neutral-200 tracking-wider">
                {client.customerCode}
              </code>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <ClientStatusBadge status={client.clientStatus} />
            <HealthBadge status={client.healthStatus} />
            <Badge className="border-transparent bg-accent-100 text-accent-700 hover:bg-accent-100">
              {engagementLabel(client.engagementType)}
            </Badge>
            {client.industry && (
              <Badge variant="outline" className="text-neutral-600">
                {client.industry}
              </Badge>
            )}
            {userRole === "admin" && (
              <EditStatusButton
                clientId={client.id}
                currentHealthStatus={client.healthStatus}
                currentClientStatus={client.clientStatus ?? "lead"}
              />
            )}
          </div>

          {/* KPI Row (Sprint 6.6) */}
          <div className="flex gap-6 mt-4">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Cumulative Value</p>
              <p className="text-lg font-bold text-neutral-900 tabular-nums">
                {cumulativeValue > 0 ? formatIDR(cumulativeValue) : "—"}
              </p>
              <p className="text-xs text-neutral-400">{wonLeads.length} won project{wonLeads.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="border-l border-neutral-200 pl-6">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Opportunity Value</p>
              <p className="text-lg font-bold text-emerald-700 tabular-nums">
                {opportunityValue > 0 ? formatIDR(opportunityValue) : "—"}
              </p>
              <p className="text-xs text-neutral-400">{inProgressLeads.length} open deal{inProgressLeads.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
        </div>

        {/* 3-panel layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left — col-span-2 */}
          <div className="col-span-2 space-y-6">
            {/* Contract Details */}
            <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
              <h2 className="font-semibold text-neutral-800 mb-4">Contract Details</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Contract Start
                  </p>
                  <p className="text-sm text-neutral-800">{formatDate(client.contractStart)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Contract End
                  </p>
                  <p
                    className={`text-sm font-medium ${
                      isContractUrgent ? "text-danger-600" : "text-neutral-800"
                    }`}
                  >
                    {formatDate(client.contractEnd)}
                    {isContractUrgent && contractDays !== null && (
                      <span className="ml-2 text-xs font-normal text-danger-500">
                        ({contractDays}d remaining)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Monthly Value
                  </p>
                  <p className="text-sm text-neutral-800 tabular-nums">
                    {formatIDR(monthlyValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Annual Value
                  </p>
                  <p className="text-sm text-neutral-800 tabular-nums">
                    {formatIDR(annualValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                    Engagement Type
                  </p>
                  <p className="text-sm text-neutral-800">
                    {engagementLabel(client.engagementType)}
                  </p>
                </div>
                {client.orgSize && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                      Org Size
                    </p>
                    <p className="text-sm text-neutral-800">{client.orgSize}</p>
                  </div>
                )}
                {client.industry && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                      Industry
                    </p>
                    <p className="text-sm text-neutral-800">{client.industry}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contacts */}
            <ContactsCard clientId={client.id} contacts={contacts} />

            {/* Notes */}
            <NotesCard clientId={client.id} notes={client.notes} />

            {/* Linked Projects (Sprint 6.4) */}
            {serializedLeads.length > 0 && (
              <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
                <h2 className="font-semibold text-neutral-800 mb-4">Linked Projects</h2>

                {/* Active — Won */}
                {wonLeads.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Active</p>
                    <div className="space-y-2">
                      {wonLeads.map((lead) => (
                        <LinkedProjectRow key={lead.id} lead={lead} />
                      ))}
                    </div>
                  </div>
                )}

                {/* In Progress */}
                {inProgressLeads.length > 0 && (
                  <div className="mb-5">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">In Progress</p>
                    <div className="space-y-2">
                      {inProgressLeads.map((lead) => (
                        <LinkedProjectRow key={lead.id} lead={lead} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Closed */}
                {closedLeads.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Closed</p>
                    <div className="space-y-2">
                      {closedLeads.map((lead) => (
                        <LinkedProjectRow key={lead.id} lead={lead} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — col-span-1 */}
          <div className="space-y-6">
            {/* AE Assigned */}
            <AeCard
              clientId={client.id}
              ae={client.ae ? { id: client.ae.id, name: client.ae.name } : null}
              aeOptions={aeOptions}
            />

            {/* Upsell Opportunities */}
            <UpsellsCard clientId={client.id} upsells={upsells} />

            {/* Field History */}
            {fieldHistory.length > 0 && (
              <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
                <h3 className="text-sm font-semibold text-neutral-700 mb-3">Change History</h3>
                <div className="space-y-2">
                  {fieldHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-xs">
                      <span className="text-neutral-400 whitespace-nowrap mt-0.5">
                        {new Date(entry.changedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </span>
                      <div className="flex-1">
                        <span className="font-medium text-neutral-700 capitalize">
                          {entry.field.replace(/([A-Z])/g, " $1")}
                        </span>
                        {": "}
                        <span className="text-neutral-500 line-through">{entry.oldValue ?? "—"}</span>
                        {" → "}
                        <span className="text-neutral-800">{entry.newValue ?? "—"}</span>
                      </div>
                      <span className="text-neutral-400 whitespace-nowrap">{entry.changerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
