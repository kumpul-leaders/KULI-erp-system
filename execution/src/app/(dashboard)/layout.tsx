import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/layout/sidebar"
import { MobileSidebar } from "@/components/layout/mobile-sidebar"
import { ThemeToggle } from "@/components/shared/theme-toggle"
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
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar — hidden on mobile (handled inside sidebar.tsx via hidden md:flex) */}
      <Sidebar user={sessionUser} />

      {/* Right panel — relative so overlay controls work */}
      <div className="relative flex flex-1 flex-col overflow-hidden min-w-0">
        {/*
          Topbar overlay: sits on top of each page's <Topbar> (z-40 > z-20).
          - Left (md:hidden): hamburger that opens MobileSidebar sheet
          - Right: theme toggle + notification bell
          pointer-events-none on wrapper; pointer-events-auto on interactive children.
        */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-14 items-center px-2 md:px-4">
          {/* Mobile hamburger */}
          <div className="pointer-events-auto md:hidden">
            <MobileSidebar user={sessionUser} />
          </div>

          {/* Right controls: theme toggle + bell */}
          <div className="pointer-events-auto ml-auto flex items-center gap-1">
            <ThemeToggle variant="icon" />
            <NotificationBell />
          </div>
        </div>

        {children}
      </div>

      {/* Command palette — global, available on all authenticated pages */}
      <CommandPalette user={sessionUser} />
    </div>
  )
}
