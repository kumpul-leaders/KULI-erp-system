"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

export function LogoutButton() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  async function handleLogout() {
    setIsLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-100",
        "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
      aria-label="Log out"
    >
      <LogOut className="h-4 w-4 flex-shrink-0" />
      <span>Log out</span>
    </button>
  )
}
