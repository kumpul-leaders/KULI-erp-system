import type { Metadata } from "next"
import { Suspense } from "react"
import { Topbar } from "@/components/layout/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientsTable } from "@/components/clients/clients-table"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { Prisma } from "@prisma/client"

export const metadata: Metadata = {
  title: "Clients",
}

// ── Data fetching ────────────────────────────────────────────────────────────

type SortDirection = "asc" | "desc"

function buildOrderBy(
  sort: string,
  dir: string
): Prisma.ClientOrderByWithRelationInput {
  const d: SortDirection = dir === "asc" || dir === "desc" ? dir : "desc"

  switch (sort) {
    case "name":
      return { name: d === "asc" ? "asc" : "desc" }
    case "industry":
      return { industry: d }
    case "orgSize":
      return { orgSize: d }
    case "annualValue":
      return { annualValue: d }
    case "ae":
      return { ae: { name: d } }
    case "cumulativeValue":
    case "opportunityValue":
      // Computed in-JS after merge; use name as DB-level fallback
      return { name: "asc" }
    default:
      return { name: "asc" }
  }
}

async function fetchClients(search: string, sort: string, dir: string) {
  const where: Prisma.ClientWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { industry: { contains: search, mode: "insensitive" as const } },
          { customerCode: { contains: search, mode: "insensitive" as const } },
          { ae: { name: { contains: search, mode: "insensitive" as const } } },
        ],
      }
    : {}

  // Computed sort columns are handled in-JS after merging; use name fallback for DB query
  const dbSort = sort === "cumulativeValue" || sort === "opportunityValue" ? "name" : sort
  const orderBy = buildOrderBy(dbSort, dir)

  const clients = await prisma.client.findMany({
    where,
    include: {
      ae: { select: { id: true, name: true } },
      contacts: { select: { id: true } },
    },
    orderBy,
  })

  const [cumulativeGroups, opportunityGroups] = await Promise.all([
    // Cumulative Value: SUM(actualRevenue) from won leads per client
    prisma.lead.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clients.map((c) => c.id) },
        stage: { in: ["closed_won", "invoiced", "contract_renewal"] },
        actualRevenue: { not: null },
      },
      _sum: { actualRevenue: true },
    }),
    // Opportunity Value: SUM(projectedRevenue) from open leads per client
    prisma.lead.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: clients.map((c) => c.id) },
        stage: { in: ["leads", "pipeline", "negotiation"] },
        projectedRevenue: { not: null },
      },
      _sum: { projectedRevenue: true },
    }),
  ])

  const cumulativeMap = new Map(
    cumulativeGroups.map((g) => [g.clientId, Number(g._sum.actualRevenue ?? 0)])
  )
  const opportunityMap = new Map(
    opportunityGroups.map((g) => [g.clientId, Number(g._sum.projectedRevenue ?? 0)])
  )

  let serialized = clients.map((c) => ({
    ...c,
    monthlyValue: c.monthlyValue ? Number(c.monthlyValue) : null,
    annualValue: c.annualValue ? Number(c.annualValue) : null,
    contractStart: c.contractStart?.toISOString() ?? null,
    contractEnd: c.contractEnd?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    _contactCount: c.contacts.length,
    cumulativeValue: cumulativeMap.get(c.id) ?? 0,
    opportunityValue: opportunityMap.get(c.id) ?? 0,
  }))

  // In-JS sort for computed columns
  if (sort === "cumulativeValue") {
    serialized = serialized.sort((a, b) =>
      dir === "asc" ? a.cumulativeValue - b.cumulativeValue : b.cumulativeValue - a.cumulativeValue
    )
  } else if (sort === "opportunityValue") {
    serialized = serialized.sort((a, b) =>
      dir === "asc" ? a.opportunityValue - b.opportunityValue : b.opportunityValue - a.opportunityValue
    )
  }

  return {
    clients: serialized,
    total: serialized.length,
  }
}

async function fetchAeOptions() {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  })
  return users
}

async function fetchCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { role: true },
  })
  return dbUser?.role ?? null
}

// ── Table skeleton (shown during Suspense / navigation) ──────────────────────

function ClientsTableSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 mb-5">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-24 ml-auto" />
        <Skeleton className="h-9 w-28" />
      </div>
      <div className="rounded-lg border border-neutral-200 bg-white shadow-card overflow-hidden">
        <div className="border-b border-neutral-200 px-4 py-3 grid grid-cols-8 gap-4 bg-neutral-50">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-neutral-100 px-4 py-3.5 grid grid-cols-8 gap-4 last:border-0"
          >
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </>
  )
}

// ── Async content (inside Suspense) ─────────────────────────────────────────

interface ClientsContentProps {
  search: string
  sort: string
  dir: string
}

async function ClientsContent({ search, sort, dir }: ClientsContentProps) {
  const [{ clients, total }, aeOptions, userRole] = await Promise.all([
    fetchClients(search, sort, dir),
    fetchAeOptions(),
    fetchCurrentUserRole(),
  ])

  return (
    <ClientsTable
      initialClients={clients}
      initialTotal={total}
      aeOptions={aeOptions}
      searchQuery={search}
      sortCol={sort}
      sortDir={dir}
      userRole={userRole}
    />
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

interface ClientsPageProps {
  searchParams: Promise<{
    search?: string
    sort?: string
    dir?: string
  }>
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const params = await searchParams
  const search = params.search ?? ""
  const sort = params.sort ?? "name"
  const dir = params.dir ?? "asc"

  return (
    <>
      <Topbar title="Clients" />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <Suspense
          key={`${search}-${sort}-${dir}`}
          fallback={<ClientsTableSkeleton />}
        >
          <ClientsContent search={search} sort={sort} dir={dir} />
        </Suspense>
      </main>
    </>
  )
}
