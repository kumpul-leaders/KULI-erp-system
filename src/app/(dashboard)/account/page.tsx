import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { Topbar } from "@/components/layout/topbar"
import { AccountContent } from "./account-content"
import type { Role } from "@/types"

export const metadata: Metadata = { title: "Account" }

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const dbUser = user.email
    ? await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true, name: true, role: true, division: true },
      })
    : null

  if (!dbUser) redirect("/login")

  return (
    <>
      <Topbar title="Account" />
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6">
        <AccountContent
          name={dbUser.name ?? user.email ?? ""}
          email={user.email ?? ""}
          role={dbUser.role as Role}
          division={dbUser.division ?? null}
          userId={dbUser.id}
        />
      </main>
    </>
  )
}
