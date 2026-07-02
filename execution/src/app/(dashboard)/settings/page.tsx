import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SettingsContent } from "@/components/settings/settings-content"
import type { SerializedUser } from "@/components/settings/settings-content"
import { getStageConfig } from "@/lib/stage-config.server"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  const [allUsers, currentDbUser, leadGroups, clientGroups, initialStageConfig] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    supabaseUser?.email
      ? prisma.user.findUnique({
          where: { email: supabaseUser.email },
          select: { role: true },
        })
      : null,
    // Count of leads per salesId across all leads (no stage filter — full ownership map)
    prisma.lead.groupBy({
      by: ["salesId"],
      _count: { id: true },
    }),
    // Count of clients per primaryAe across all clients
    prisma.client.groupBy({
      by: ["primaryAe"],
      _count: { id: true },
    }),

    // Pipeline stage config for the Pipeline tab
    getStageConfig(),
  ])

  const serializedUsers: SerializedUser[] = allUsers.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    division: u.division,
    isActive: u.isActive,
    isVp: u.isVp,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }))

  // Build Record<userId, count> maps — filter out null keys from groupBy
  const leadCountMap: Record<string, number> = {}
  for (const row of leadGroups) {
    if (row.salesId) {
      leadCountMap[row.salesId] = row._count.id
    }
  }

  const clientCountMap: Record<string, number> = {}
  for (const row of clientGroups) {
    if (row.primaryAe) {
      clientCountMap[row.primaryAe] = row._count.id
    }
  }

  const canManageUsers =
    currentDbUser?.role === "admin" || currentDbUser?.role === "commercial_director"

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <SettingsContent
          users={serializedUsers}
          isAdmin={canManageUsers}
          leadCountMap={leadCountMap}
          clientCountMap={clientCountMap}
          initialStageConfig={initialStageConfig}
        />
      </main>
    </>
  )
}
