import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Sidebar } from "@/components/layout/sidebar"
import type { SessionUser } from "@/types"

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

  // Build a minimal session user from Supabase user_metadata.
  // In a full implementation, this would be fetched from the users table via Prisma.
  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email ?? "",
    name: (user.user_metadata?.name as string | undefined) ?? user.email ?? "User",
    role: (user.user_metadata?.role as SessionUser["role"] | undefined) ?? "account",
    isVp: Boolean(user.user_metadata?.is_vp),
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
