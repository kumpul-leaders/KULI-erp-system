import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { ActivitiesView } from "@/components/activities/activities-view"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import type { Role } from "@/types"

export const metadata: Metadata = {
  title: "My Activities",
}

// ── Serialized activity shape ─────────────────────────────────────────────────

export interface SerializedPageActivity {
  id: string
  type: "call" | "email" | "meeting" | "todo" | "deadline"
  subject: string
  note: string | null
  dueDate: string // YYYY-MM-DD
  status: "open" | "done" | "canceled"
  doneAt: string | null
  leadId: string | null
  clientId: string | null
  assignedTo: string
  createdAt: string
  updatedAt: string
  lead: { id: string; client: { name: string } } | null
  client: { id: string; name: string } | null
  assignee: { id: string; name: string }
}

// ── Data fetching ────────────────────────────────────────────────────────────

async function fetchMyActivities(userId: string): Promise<SerializedPageActivity[]> {
  const activities = await prisma.activity.findMany({
    where: { assignedTo: userId, status: "open" },
    include: {
      lead: { select: { id: true, client: { select: { name: true } } } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  return activities.map((a) => ({
    id: a.id,
    type: a.type as SerializedPageActivity["type"],
    subject: a.subject,
    note: a.note,
    dueDate: a.dueDate.toISOString().slice(0, 10),
    status: a.status as SerializedPageActivity["status"],
    doneAt: a.doneAt?.toISOString() ?? null,
    leadId: a.leadId,
    clientId: a.clientId,
    assignedTo: a.assignedTo,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    lead: a.lead
      ? { id: a.lead.id, client: { name: a.lead.client.name } }
      : null,
    client: a.client ? { id: a.client.id, name: a.client.name } : null,
    assignee: { id: a.assignee.id, name: a.assignee.name },
  }))
}

async function fetchAllActivities(): Promise<SerializedPageActivity[]> {
  const activities = await prisma.activity.findMany({
    where: { status: "open" },
    include: {
      lead: { select: { id: true, client: { select: { name: true } } } },
      client: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
    orderBy: { dueDate: "asc" },
  })

  return activities.map((a) => ({
    id: a.id,
    type: a.type as SerializedPageActivity["type"],
    subject: a.subject,
    note: a.note,
    dueDate: a.dueDate.toISOString().slice(0, 10),
    status: a.status as SerializedPageActivity["status"],
    doneAt: a.doneAt?.toISOString() ?? null,
    leadId: a.leadId,
    clientId: a.clientId,
    assignedTo: a.assignedTo,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    lead: a.lead
      ? { id: a.lead.id, client: { name: a.lead.client.name } }
      : null,
    client: a.client ? { id: a.client.id, name: a.client.name } : null,
    assignee: { id: a.assignee.id, name: a.assignee.name },
  }))
}

// ── Roles that can view "all team" toggle ─────────────────────────────────────

const ALL_TEAM_ROLES: Role[] = ["admin", "commercial_director"]

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const dbUser = user
    ? await prisma.user.findUnique({
        where: { email: user.email! },
        select: { id: true, role: true },
      })
    : null

  const currentUserId = dbUser?.id ?? ""
  const userRole = (dbUser?.role ?? "account") as Role
  const canViewAllTeam = ALL_TEAM_ROLES.includes(userRole)

  const { team } = await searchParams
  const showAllTeam = canViewAllTeam && team === "1"

  const [activities, assigneeOptions] = await Promise.all([
    showAllTeam ? fetchAllActivities() : fetchMyActivities(currentUserId),
    prisma.user.findMany({
      where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <>
      <Topbar title="My Activities" />
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <ActivitiesView
          activities={activities}
          currentUserId={currentUserId}
          assigneeOptions={assigneeOptions}
          canViewAllTeam={canViewAllTeam}
          showAllTeam={showAllTeam}
        />
      </main>
    </>
  )
}
