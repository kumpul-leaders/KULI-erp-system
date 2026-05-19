"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Target,
  BarChart3,
  Settings,
} from "lucide-react"
import { cn, getInitials } from "@/lib/utils"
import type { SessionUser } from "@/types"

// ─── Nav structure ───────────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "COMMERCIAL",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/pipeline", icon: KanbanSquare, label: "Pipeline" },
      { href: "/clients", icon: Users, label: "Clients" },
    ],
  },
  {
    label: "PERFORMANCE",
    items: [
      { href: "/targets", icon: Target, label: "Targets" },
      { href: "/analytics", icon: BarChart3, label: "Analytics" },
    ],
  },
]

const ADMIN_NAV_ITEM = { href: "/settings", icon: Settings, label: "Settings" }

// ─── Component ──────────────────────────────────────────────

interface SidebarProps {
  user: SessionUser
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 sticky top-0">
      {/* Brand */}
      <div className="flex items-center border-b border-neutral-200 px-4 py-3">
        <span className="text-lg font-bold tracking-tight text-neutral-800">
          vosFoyer
        </span>
        <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
          ERP
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-2">
            <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 mx-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-100",
                        active
                          ? "bg-accent-50 text-accent-700 font-semibold border-l-2 border-accent-600 pl-[calc(0.75rem_-_2px)]"
                          : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          active ? "text-accent-600" : "text-neutral-400"
                        )}
                      />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        {/* Admin-only nav item */}
        {user.role === "admin" && (
          <div className="mb-2">
            <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
              ADMIN
            </p>
            <ul className="space-y-0.5">
              <li>
                <Link
                  href={ADMIN_NAV_ITEM.href}
                  className={cn(
                    "flex items-center gap-2.5 mx-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-100",
                    isActive(ADMIN_NAV_ITEM.href)
                      ? "bg-accent-50 text-accent-700 font-semibold border-l-2 border-accent-600 pl-[calc(0.75rem_-_2px)]"
                      : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
                  )}
                >
                  <ADMIN_NAV_ITEM.icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      isActive(ADMIN_NAV_ITEM.href)
                        ? "text-accent-600"
                        : "text-neutral-400"
                    )}
                  />
                  {ADMIN_NAV_ITEM.label}
                </Link>
              </li>
            </ul>
          </div>
        )}
      </nav>

      {/* User info — bottom */}
      <div className="mt-auto border-t border-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-100 text-sm font-semibold text-accent-700">
            {getInitials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-700">
              {user.name}
            </p>
            <p className="text-xs text-neutral-400 capitalize">{user.role}</p>
          </div>
          <Link
            href="/settings"
            className="ml-auto text-neutral-400 hover:text-neutral-600"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </aside>
  )
}
