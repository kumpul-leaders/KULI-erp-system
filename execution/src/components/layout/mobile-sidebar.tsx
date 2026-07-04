"use client"

// Justification for "use client":
// - Sheet open/close state
// - usePathname for active link detection
// - Closes drawer on navigation

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Target,
  BarChart3,
  Settings,
  UserCircle,
  ClipboardList,
  Menu,
  X,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn, getInitials } from "@/lib/utils"
import type { SessionUser } from "@/types"
import { LogoutButton } from "@/components/layout/logout-button"

// ─── Nav structure (mirrors sidebar.tsx) ─────────────────────────────────────

const NAV_GROUPS = [
  {
    label: "COMMERCIAL",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/pipeline", icon: KanbanSquare, label: "Pipeline" },
      { href: "/activities", icon: ClipboardList, label: "Activities" },
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

// ─── Component ───────────────────────────────────────────────────────────────

interface MobileSidebarProps {
  user: SessionUser
}

export function MobileSidebarTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-50 transition-colors"
      aria-label="Open navigation menu"
    >
      <Menu className="h-5 w-5" />
    </button>
  )
}

export function MobileSidebar({ user }: MobileSidebarProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  function close() {
    setOpen(false)
  }

  return (
    <>
      {/* Hamburger trigger */}
      <MobileSidebarTrigger onClick={() => setOpen(true)} />

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="w-64 p-0 flex flex-col bg-neutral-50 dark:bg-card border-r border-neutral-200 dark:border-neutral-100"
        >
          {/* Visually hidden title for accessibility */}
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>

          {/* Brand */}
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-100 px-4 py-3">
            <div className="flex items-center">
              <span className="text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-700">
                KULI ERP
              </span>
            </div>
            <button
              onClick={close}
              className="h-7 w-7 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            {NAV_GROUPS.map((group) => {
              const NON_COMMERCIAL_ROLES = ["operation", "hr", "finance"]
              const visibleItems = group.items.filter((item) => {
                if (item.href === "/targets" && NON_COMMERCIAL_ROLES.includes(user.role)) return false
                if (item.href === "/pipeline" && NON_COMMERCIAL_ROLES.includes(user.role)) return false
                if (item.href === "/activities" && NON_COMMERCIAL_ROLES.includes(user.role)) return false
                return true
              })
              if (visibleItems.length === 0) return null
              return (
                <div key={group.label} className="mb-2">
                  <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                    {group.label}
                  </p>
                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const active = isActive(item.href)
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={close}
                            className={cn(
                              "flex items-center gap-2.5 mx-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-100",
                              active
                                ? "bg-accent-50 dark:bg-accent-50/10 text-accent-700 dark:text-accent-600 font-semibold border-l-2 border-accent-600 pl-[calc(0.75rem_-_2px)]"
                                : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-50 hover:text-neutral-800 dark:hover:text-neutral-100"
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
              )
            })}

            {/* Admin nav */}
            {(user.role === "admin" || user.role === "commercial_director") && (
              <div className="mb-2">
                <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  ADMIN
                </p>
                <ul className="space-y-0.5">
                  <li>
                    <Link
                      href={ADMIN_NAV_ITEM.href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-2.5 mx-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-100",
                        isActive(ADMIN_NAV_ITEM.href)
                          ? "bg-accent-50 dark:bg-accent-50/10 text-accent-700 dark:text-accent-600 font-semibold border-l-2 border-accent-600 pl-[calc(0.75rem_-_2px)]"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-50 hover:text-neutral-800 dark:hover:text-neutral-100"
                      )}
                    >
                      <ADMIN_NAV_ITEM.icon
                        className={cn(
                          "h-4 w-4 flex-shrink-0",
                          isActive(ADMIN_NAV_ITEM.href) ? "text-accent-600" : "text-neutral-400"
                        )}
                      />
                      {ADMIN_NAV_ITEM.label}
                    </Link>
                  </li>
                </ul>
              </div>
            )}

            {/* Account */}
            <div className="mb-2">
              <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                ACCOUNT
              </p>
              <ul className="space-y-0.5">
                <li>
                  <Link
                    href="/account"
                    onClick={close}
                    className={cn(
                      "flex items-center gap-2.5 mx-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-100",
                      isActive("/account")
                        ? "bg-accent-50 dark:bg-accent-50/10 text-accent-700 dark:text-accent-600 font-semibold border-l-2 border-accent-600 pl-[calc(0.75rem_-_2px)]"
                        : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-50 hover:text-neutral-800 dark:hover:text-neutral-100"
                    )}
                  >
                    <UserCircle
                      className={cn(
                        "h-4 w-4 flex-shrink-0",
                        isActive("/account") ? "text-accent-600" : "text-neutral-400"
                      )}
                    />
                    Account
                  </Link>
                </li>
              </ul>
            </div>
          </nav>

          {/* User info — bottom */}
          <div className="mt-auto border-t border-neutral-200 dark:border-neutral-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-50 text-sm font-semibold text-accent-700 dark:text-accent-600">
                {getInitials(user.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-700 dark:text-neutral-700">
                  {user.name}
                </p>
              </div>
            </div>
            <div className="mt-1">
              <LogoutButton />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
