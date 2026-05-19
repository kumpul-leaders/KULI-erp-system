import type { Metadata } from "next"
import { Topbar } from "@/components/layout/topbar"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { SettingsContent } from "@/components/settings/settings-content"
import type { SerializedUser } from "@/components/settings/settings-content"

export const metadata: Metadata = {
  title: "Settings",
}

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser()

  const [allUsers, currentDbUser] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    supabaseUser?.email
      ? prisma.user.findUnique({
          where: { email: supabaseUser.email },
          select: { role: true },
        })
      : null,
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

  const isAdmin = currentDbUser?.role === "admin"

  return (
    <>
      <Topbar title="Settings" />
      <main className="flex-1 overflow-y-auto px-8 py-6">
        <SettingsContent users={serializedUsers} isAdmin={isAdmin} />
      </main>
    </>
  )
}
