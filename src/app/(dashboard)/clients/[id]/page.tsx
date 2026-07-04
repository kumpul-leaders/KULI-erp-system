import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { Topbar } from "@/components/layout/topbar"
import { Badge } from "@/components/ui/badge"
import { HealthScorePopover, type HealthSnapshot } from "@/components/clients/health-score-popover"
import { ClientStatusBadge } from "@/components/clients/client-status-badge"
import { ClientAlertsBanner } from "@/components/clients/client-alerts-banner"
import { ContactsCard } from "@/components/clients/contacts-card"
import { UpsellsCard } from "@/components/clients/upsells-card"
import { NotesCard } from "@/components/clients/notes-card"
import { AeCard } from "@/components/clients/ae-card"
import { ClientDetailActions } from "@/components/clients/client-detail-actions"
import { EditStatusButton } from "@/components/clients/edit-status-button"
import { SmartButtons, type SmartButtonConfig } from "@/components/shared/smart-buttons"
import { ActivityPanel } from "@/components/activities/activity-panel"
import { RecordTimeline } from "@/components/chatter/record-timeline"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { formatIDR } from "@/lib/utils"
import { Layers, Users, TrendingUp, DollarSign, ClipboardList, MessageSquare } from "lucide-react"
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
    where: { id, deletedAt: null },
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
    select: { id: true, role: true },
  }) : null
  const userRole = dbUser?.role ?? null
  const currentUserId = dbUser?.id ?? ""
  const isAdmin = userRole === "admin" || userRole === "commercial_director"
  const canEditStatus = isAdmin || userRole === "account_manager" || userRole === "account"

  const [client, aeOptions, clientLeads, openAlerts, latestSnapshot] = await Promise.all([
    fetchClient(id),
    fetchAeOptions(),
    prisma.lead.findMany({
      where: { clientId: id, deletedAt: null },
      include: {
        sales: { select: { name: true } },
        renewedFromLead: { select: { id: true, client: { select: { name: true } } } },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    // Open alerts for this client
    prisma.alert.findMany({
      where: { clientId: id, status: "open" },
      orderBy: { triggeredAt: "desc" },
    }),
    // Latest health snapshot
    prisma.clientHealthSnapshot.findFirst({
      where: { clientId: id },
      orderBy: { computedAt: "desc" },
    }),
  ])

  if (!client) notFound()

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

  // Normalized field history — shape matches RecordTimeline's FieldHistoryEntry
  const fieldHistory = client.fieldHistory.map((entry) => ({
    id: entry.id,
    field: entry.field,
    oldValue: entry.oldValue,
    newValue: entry.newValue,
    changedAt: entry.changedAt.toISOString(),
    changer: { id: "", name: entry.changer.name },
  }))

  // Serialize health snapshot
  const healthSnapshot: HealthSnapshot | null = latestSnapshot
    ? {
        score: latestSnapshot.score,
        band: latestSnapshot.band,
        signalActivity: latestSnapshot.signalActivity,
        signalRenewal: latestSnapshot.signalRenewal,
        signalRevenue: latestSnapshot.signalRevenue,
        signalEngagement: latestSnapshot.signalEngagement,
        computedAt: latestSnapshot.computedAt.toISOString(),
      }
    : null

  // Serialize open alerts for banner
  const serializedAlerts = openAlerts.map((a) => ({
    id: a.id,
    type: a.type as "health_drop" | "stale_deal",
    triggeredAt: a.triggeredAt.toISOString(),
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
    renewedFromLead: { id: string; clientName: string } | null
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
    renewedFromLead: l.renewedFromLead
      ? { id: l.renewedFromLead.id, clientName: l.renewedFromLead.client.name }
      : null,
  }))

  const wonLeads = serializedLeads.filter((l) => WON_STAGES_CLIENT.includes(l.stage))
  const inProgressLeads = serializedLeads.filter((l) => IN_PROGRESS_STAGES.includes(l.stage))
  const closedLeads = serializedLeads.filter((l) => CLOSED_STAGES.includes(l.stage))

  // KPI values (Sprint 6.6)
  const cumulativeValue = wonLeads.reduce((sum, l) => sum + (l.actualRevenue ?? 0), 0)
  const opportunityValue = inProgressLeads.reduce((sum, l) => sum + (l.projectedRevenue ?? 0), 0)

  // Client data for edit sheet
  const clientForEdit = {
    id: client.id,
    name: client.name,
    customerCode: client.customerCode,
    industry: client.industry,
    orgSize: client.orgSize,
    officeAddress: client.officeAddress,
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
      brand_placement: "Brand Placement", speakership: "Speakership",
      community_event: "Community Event", commissioned_event: "Commissioned Event", others: "Others",
    }
    const quarter = lead.billingPlan
      ? `Q${Math.ceil(parseInt(lead.billingPlan.split("-")[1]) / 3)} '${lead.billingPlan.split("-")[0]}`
      : null

    return (
      <div className="rounded-md border border-neutral-100 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-50/40">
        <Link
          href={`/pipeline/${lead.id}`}
          className="flex items-center gap-3 px-3 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-100/60 transition-colors group rounded-md"
        >
          <Badge variant="outline" className="text-xs shrink-0">{STAGE_LABELS[lead.stage] ?? lead.stage}</Badge>
          {lead.productLine && (
            <span className="text-xs text-neutral-600 dark:text-neutral-400">{PRODUCT_LABELS[lead.productLine] ?? lead.productLine}</span>
          )}
          {quarter && <span className="text-xs text-neutral-400">{quarter}</span>}
          <span className="ml-auto text-xs font-medium tabular-nums text-neutral-700 dark:text-neutral-300">
            {lead.actualRevenue ? formatIDR(lead.actualRevenue) : lead.projectedRevenue ? formatIDR(lead.projectedRevenue) : "—"}
          </span>
        </Link>
        {lead.renewedFromLead && (
          <div className="px-3 pb-2 pt-0">
            <Link
              href={`/pipeline/${lead.renewedFromLead.id}`}
              className="inline-flex items-center gap-1 text-xs text-accent-600 hover:text-accent-700 hover:underline"
            >
              <span>&#8635;</span>
              renewal dari {lead.renewedFromLead.clientName}
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Topbar title={client.name}>
        <ClientDetailActions client={clientForEdit} aeOptions={aeOptions} isAdmin={isAdmin} />
      </Topbar>

      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        {/* Back link */}
        <Link
          href="/clients"
          className="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Clients
        </Link>

        {/* Alert banner — only when open alerts exist */}
        {serializedAlerts.length > 0 && (
          <div className="mb-6">
            <ClientAlertsBanner alerts={serializedAlerts} />
          </div>
        )}

        {/* Smart Buttons row */}
        {(() => {
          // Build pipeline filter URL — clientId enum condition encoded as base64 FilterCondition[]
          const clientFilterConditions = [
            { id: "client-filter", field: "clientId", operator: "is", value: id },
          ]
          const clientFilterParam = Buffer.from(JSON.stringify(clientFilterConditions)).toString("base64")

          const clientSmartButtons: SmartButtonConfig[] = [
            {
              type: "link",
              icon: <Layers />,
              count: serializedLeads.length,
              label: serializedLeads.length === 1 ? "Lead" : "Leads",
              href: `/pipeline?filter=${clientFilterParam}`,
              title: `Lihat semua leads dari ${client.name} di Pipeline`,
            },
            {
              type: "scroll",
              icon: <Users />,
              count: client.contacts.length,
              label: client.contacts.length === 1 ? "Contact" : "Contacts",
              targetId: "section-contacts",
              title: "Lihat daftar contacts",
            },
            {
              type: "scroll",
              icon: <TrendingUp />,
              count: client.upsellOpportunities.length,
              label: "Upsells",
              targetId: "section-upsells",
              title: "Lihat upsell opportunities",
            },
            {
              type: "scroll",
              icon: <ClipboardList />,
              label: "Activities",
              targetId: "section-client-activities",
              title: "Lihat planned activities",
            },
            {
              type: "scroll",
              icon: <MessageSquare />,
              label: "Chatter",
              targetId: "section-client-chatter",
              title: "Lihat timeline dan chatter",
            },
            ...(cumulativeValue > 0
              ? ([
                  {
                    type: "badge",
                    icon: <DollarSign />,
                    label: `Cumulative: ${formatIDR(cumulativeValue)}`,
                    title: "Total actual revenue dari won projects",
                  },
                ] satisfies SmartButtonConfig[])
              : []),
          ]
          return <SmartButtons buttons={clientSmartButtons} className="mb-6" />
        })()}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">{client.name}</h1>
            {client.customerCode && (
              <code className="px-2 py-0.5 rounded text-xs font-mono bg-neutral-100 text-neutral-600 border border-neutral-200 tracking-wider">
                {client.customerCode}
              </code>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <ClientStatusBadge status={client.clientStatus} />
            <HealthScorePopover status={client.healthStatus} snapshot={healthSnapshot} />
            <Badge className="border-transparent bg-accent-100 text-accent-700 hover:bg-accent-100">
              {engagementLabel(client.engagementType)}
            </Badge>
            {client.industry && (
              <Badge variant="outline" className="text-neutral-600">
                {client.industry}
              </Badge>
            )}
            {canEditStatus && (
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
              <p className="text-lg font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
                {cumulativeValue > 0 ? formatIDR(cumulativeValue) : "—"}
              </p>
              <p className="text-xs text-neutral-400">{wonLeads.length} won project{wonLeads.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="border-l border-neutral-200 pl-6">
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Opportunity Value</p>
              <p className="text-lg font-bold text-success-700 dark:text-success-500 tabular-nums">
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
            {/* Client Info */}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
              <h2 className="font-semibold text-neutral-800 dark:text-neutral-700 mb-4">Client Info</h2>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {client.officeAddress && (
                  <div className="col-span-2">
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                      Office Address
                    </p>
                    <p className="text-sm text-neutral-800 dark:text-neutral-700">{client.officeAddress}</p>
                  </div>
                )}
                {client.orgSize && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                      Org Size
                    </p>
                    <p className="text-sm text-neutral-800 dark:text-neutral-700">{client.orgSize}</p>
                  </div>
                )}
                {client.industry && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">
                      Industry
                    </p>
                    <p className="text-sm text-neutral-800 dark:text-neutral-700">{client.industry}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contacts */}
            <div id="section-contacts">
              <ContactsCard clientId={client.id} contacts={contacts} />
            </div>

            {/* Notes */}
            <NotesCard clientId={client.id} notes={client.notes} />

            {/* Linked Projects (Sprint 6.4) */}
            {serializedLeads.length > 0 && (
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card">
                <h2 className="font-semibold text-neutral-800 dark:text-neutral-700 mb-4">Linked Projects</h2>

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
            <div id="section-upsells">
              <UpsellsCard clientId={client.id} upsells={upsells} />
            </div>

            {/* Planned Activities */}
            <div id="section-client-activities">
              <ActivityPanel
                clientId={client.id}
                currentUserId={currentUserId}
                assigneeOptions={aeOptions}
              />
            </div>

          </div>
        </div>

        {/* Timeline & Chatter — full-width below the 3-col grid */}
        <div id="section-client-chatter" className="mt-6">
          <RecordTimeline
            clientId={client.id}
            currentUserId={currentUserId}
            fieldHistory={fieldHistory}
          />
        </div>
      </main>
    </>
  )
}
