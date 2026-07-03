"use client"

// Justification for "use client":
// - Global keydown listener (Cmd+K / Ctrl+K)
// - Controlled dialog open/close state
// - Debounced fetch to /api/search on keystroke

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Target,
  BarChart3,
  Settings,
  Plus,
  Search,
  Building2,
  UserCircle2,
} from "lucide-react"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import type { Role, SessionUser } from "@/types"
import type { SearchResponse } from "@/app/api/search/route"

// ── Role-gating — mirrors sidebar.tsx logic exactly ─────────────────────────

const NON_COMMERCIAL_ROLES: Role[] = ["operation", "hr", "finance"]
const ADMIN_ROLES: Role[] = ["admin", "commercial_director"]

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

function getNavItems(role: Role): NavItem[] {
  const base: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Clients", href: "/clients", icon: Users },
  ]

  if (!NON_COMMERCIAL_ROLES.includes(role)) {
    base.splice(1, 0, { label: "Pipeline", href: "/pipeline", icon: KanbanSquare })
    base.push({ label: "Targets", href: "/targets", icon: Target })
  }

  base.push({ label: "Analytics", href: "/analytics", icon: BarChart3 })

  if (ADMIN_ROLES.includes(role)) {
    base.push({ label: "Settings", href: "/settings", icon: Settings })
  }

  return base
}

interface QuickAction {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

function getQuickActions(role: Role): QuickAction[] {
  const actions: QuickAction[] = []

  if (!NON_COMMERCIAL_ROLES.includes(role)) {
    actions.push({
      label: "Lead Baru",
      href: "/pipeline?new=1",
      icon: Plus,
    })
  }

  // /clients?new=1 pattern does not exist — link to /clients
  actions.push({
    label: "Client Baru",
    href: "/clients",
    icon: Building2,
  })

  return actions
}

// ── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

// ── Trigger button (for sidebar / topbar) ────────────────────────────────────

interface CommandPaletteTriggerProps {
  onClick: () => void
}

export function CommandPaletteTrigger({ onClick }: CommandPaletteTriggerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-sm text-neutral-500 shadow-sm transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
      aria-label="Open command palette"
    >
      <Search className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Cari...</span>
      <kbd className="hidden rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400 sm:inline-block">
        ⌘K
      </kbd>
    </button>
  )
}

// ── Main palette ─────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  user: SessionUser
}

export function CommandPalette({ user }: CommandPaletteProps) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<SearchResponse | null>(null)
  const [loading, setLoading] = React.useState(false)

  const debouncedQuery = useDebounce(query, 250)

  const navItems = React.useMemo(() => getNavItems(user.role), [user.role])
  const quickActions = React.useMemo(() => getQuickActions(user.role), [user.role])

  // ── Global hotkey ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // ── Fetch search results (debounced, ≥2 chars) ────────────────────────────
  React.useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Search failed")
        return res.json() as Promise<SearchResponse>
      })
      .then((data) => {
        if (!cancelled) {
          setResults(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults(null)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  // ── Reset state on close ──────────────────────────────────────────────────
  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) {
      setQuery("")
      setResults(null)
      setLoading(false)
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function navigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  const hasSearchResults =
    results !== null &&
    (results.clients.length > 0 ||
      results.leads.length > 0 ||
      results.contacts.length > 0)

  const hasNoResults =
    results !== null &&
    results.clients.length === 0 &&
    results.leads.length === 0 &&
    results.contacts.length === 0

  return (
    <>
      <CommandDialog open={open} onOpenChange={handleOpenChange}>
        <CommandInput
          placeholder="Cari client, lead, kontak, atau navigasi..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* Loading state */}
          {loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Mencari...
            </div>
          )}

          {/* Empty state — only when query ≥2 chars and results arrived */}
          {!loading && hasNoResults && (
            <CommandEmpty>Tidak ada hasil untuk &ldquo;{query}&rdquo;</CommandEmpty>
          )}

          {/* Search results — shown when query ≥2 chars */}
          {!loading && hasSearchResults && (
            <>
              {results!.clients.length > 0 && (
                <CommandGroup heading="Clients">
                  {results!.clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={`client-${client.id}-${client.name}`}
                      onSelect={() => navigate(`/clients/${client.id}`)}
                    >
                      <Building2 className="h-4 w-4 text-neutral-400" />
                      <span>{client.name}</span>
                      {client.customerCode && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          {client.customerCode}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results!.leads.length > 0 && (
                <>
                  {results!.clients.length > 0 && <CommandSeparator />}
                  <CommandGroup heading="Leads">
                    {results!.leads.map((lead) => (
                      <CommandItem
                        key={lead.id}
                        value={`lead-${lead.id}-${lead.clientName}-${lead.description ?? ""}`}
                        onSelect={() => navigate(`/pipeline/${lead.id}`)}
                      >
                        <KanbanSquare className="h-4 w-4 text-neutral-400" />
                        <span className="truncate">
                          {lead.description ?? lead.clientName}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {lead.clientName}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              {results!.contacts.length > 0 && (
                <>
                  {(results!.clients.length > 0 || results!.leads.length > 0) && (
                    <CommandSeparator />
                  )}
                  <CommandGroup heading="Kontak">
                    {results!.contacts.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={`contact-${contact.id}-${contact.name}-${contact.email ?? ""}`}
                        onSelect={() => navigate(`/clients/${contact.clientId}`)}
                      >
                        <UserCircle2 className="h-4 w-4 text-neutral-400" />
                        <span>{contact.name}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {contact.clientName}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}

              <CommandSeparator />
            </>
          )}

          {/* Navigation — always visible */}
          {!loading && (
            <CommandGroup heading="Navigasi">
              {navItems.map((item) => (
                <CommandItem
                  key={item.href}
                  value={`nav-${item.href}-${item.label}`}
                  onSelect={() => navigate(item.href)}
                >
                  <item.icon className="h-4 w-4 text-neutral-400" />
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* Quick actions — always visible */}
          {!loading && quickActions.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Aksi Cepat">
                {quickActions.map((action) => (
                  <CommandItem
                    key={action.href}
                    value={`action-${action.href}-${action.label}`}
                    onSelect={() => navigate(action.href)}
                  >
                    <action.icon className="h-4 w-4 text-neutral-400" />
                    <span>{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

// ── Re-export trigger-open hook for sidebar/topbar integration ───────────────

export function useCommandPaletteOpen() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  return { open, setOpen }
}
