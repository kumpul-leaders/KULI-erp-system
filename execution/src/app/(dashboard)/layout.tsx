import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Sidebar } from "@/components/layout/sidebar"
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
  // Supabase user_metadata is only used as fallback for name when no DB record exists.
  const dbUser = user.email
    ? await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, role: true, isVp: true },
      })
    : null

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? "",
    name:
      dbUser?.name ??
      (user.user_metadata?.name as string | undefined) ??
      user.email ??
      "User",
    role: (dbUser?.role as Role | undefined) ?? "account",
    isVp: dbUser?.isVp ?? Boolean(user.user_metadata?.is_vp),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar user={sessionUser} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {children}
      </div>
    </div>
  )
}
