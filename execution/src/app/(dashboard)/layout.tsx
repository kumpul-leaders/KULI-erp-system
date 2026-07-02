import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/layout/sidebar"
import { CommandPalette } from "@/components/shared/command-palette"
import { NotificationBell } from "@/components/notifications/notification-bell"
import type { SessionUser, Role } from "@/types"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default async function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    redirect("/login")
  }

  // Prisma DB is single source of truth for role.
  const dbUser = user.email
    ? await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, role: true, isVp: true, isActive: true },
      })
    : null

  // Orphan Supabase accounts (no DB record) and deactivated users are blocked here.
  if (!dbUser || !dbUser.isActive) {
    redirect("/login?error=account_disabled")
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? "",
    name: dbUser.name,
    role: dbUser.role as Role,
    isVp: dbUser.isVp,
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar user={sessionUser} />
      {/* Right panel — relative so bell overlay works */}
      <div className="relative flex flex-1 flex-col overflow-hidden min-w-0">
        {children}
        {/* Bell overlaid on topbar right — h-14 matches topbar height */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-14 items-center justify-end pr-4">
          <div className="pointer-events-auto">
            <NotificationBell />
          </div>
        </div>
      </div>
      {/* Command palette — global, available on all authenticated pages */}
      <CommandPalette user={sessionUser} />
    </div>
  )
}
