import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"
import { AccountContent } from "./account-content"
import type { Role } from "@/types"

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const dbUser = user.email
    ? await prisma.user.findUnique({
        where: { email: user.email },
        select: { name: true, role: true, division: true },
      })
    : null

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      <div className="border-b border-neutral-200 bg-white px-6 py-4">
        <h1 className="text-base font-semibold text-neutral-800">Account</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Manage your profile and password.</p>
      </div>
      <div className="p-6">
        <AccountContent
          name={dbUser?.name ?? user.email ?? "User"}
          email={user.email ?? ""}
          role={(dbUser?.role as Role | undefined) ?? "account"}
          division={dbUser?.division ?? null}
        />
      </div>
    </div>
  )
}
