# VF ERP UX Audit — Sprint Plan 6–9

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 18 UX/access gaps discovered in a full user-journey audit across 3 personas (new user, BizDev/AE, Admin/Director).

**Architecture:** Next.js 14 App Router + Supabase Auth + Prisma + shadcn/ui. Role system: DB-authoritative (`require-role.ts`). All role changes need both API guard updates AND UI show/hide updates. No new pages unless specified — prefer inline edits and extending existing components.

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind v4, shadcn/ui, Supabase SSR, Prisma (PostgreSQL)

**App root:** `/Users/williamsudhana/VF ERP System/execution/`

---

## SPRINT 6 — Critical Auth & Access Fixes

**Scope:** 4 items that break core user flows. All independent — can be done in any order.

---

### Task 6.1: Forgot Password flow

**Problem:** Login page has no "Forgot Password" link. Users who forget their password must ask admin to send a reset from Settings. Completely hidden from users.

**Files:**
- Modify: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/forgot-password/page.tsx`

- [ ] **Step 1: Add "Forgot Password?" link to login page**

In `src/app/(auth)/login/page.tsx`, add below the Password field div (after the `</div>` closing tag for password), before the Submit button:

```tsx
// After the password <div> block, before <Button type="submit"...>
<div className="flex justify-end -mt-1">
  <Link
    href="/forgot-password"
    className="text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
  >
    Forgot password?
  </Link>
</div>
```

Also add `import Link from "next/link"` to the imports at top of login/page.tsx.

- [ ] **Step 2: Create forgot-password page**

Create `src/app/(auth)/forgot-password/page.tsx`:

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    })

    if (resetError) {
      setError(resetError.message)
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">vosFoyer</h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-modal">
          {sent ? (
            <div className="text-center space-y-3">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <h2 className="text-lg font-semibold text-neutral-800">Email terkirim</h2>
              <p className="text-sm text-neutral-500">
                Cek inbox <strong>{email}</strong> dan klik link reset password.
              </p>
              <Link
                href="/login"
                className="inline-block mt-2 text-sm text-accent-600 hover:underline"
              >
                Kembali ke login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-neutral-800">Reset password</h2>
              <p className="mb-6 text-sm text-neutral-500">
                Masukkan email kamu dan kami akan kirimkan link reset password.
              </p>

              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="mb-1.5 block text-sm font-medium text-neutral-700">
                    Email address <span className="text-danger-500" aria-hidden>*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@vosfoyerid.com"
                    disabled={loading}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengirim…</>
                  ) : (
                    "Kirim link reset"
                  )}
                </Button>
              </form>

              <p className="mt-4 text-center text-xs text-neutral-400">
                <Link href="/login" className="hover:text-neutral-600 transition-colors">
                  Kembali ke login
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Test manually**

1. Go to `/login`, confirm "Forgot password?" link appears below password field
2. Click it — should land on `/forgot-password`
3. Enter a valid email → should show "Email terkirim" state
4. Enter invalid format → browser validation should block submit

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/login/page.tsx src/app/\(auth\)/forgot-password/page.tsx
git commit -m "feat: add forgot password flow with email reset"
```

---

### Task 6.2: Invite link expiry graceful error

**Problem:** Supabase invite links expire in 24h. When expired link is clicked, Supabase doesn't create a session. `set-password/page.tsx` currently does `if (!user) redirect("/login")` — user gets bounced to login with zero explanation.

**Files:**
- Modify: `src/app/(auth)/set-password/page.tsx`

- [ ] **Step 1: Handle expired invite in set-password page**

Replace the entire content of `src/app/(auth)/set-password/page.tsx`:

```tsx
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { SetPasswordForm } from "./set-password-form"
import { AlertCircle } from "lucide-react"

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">vosFoyer</h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-modal">
          {!user ? (
            // Expired or invalid invite link
            <div className="text-center space-y-4">
              <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
              <h2 className="text-lg font-semibold text-neutral-800">Link sudah kedaluwarsa</h2>
              <p className="text-sm text-neutral-500">
                Link undangan ini sudah tidak berlaku. Minta admin untuk mengirim ulang
                undangan dari halaman Settings.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-accent-600 hover:underline"
              >
                Kembali ke login
              </Link>
            </div>
          ) : (
            <>
              <h2 className="mb-2 text-lg font-semibold text-neutral-800">Set your password</h2>
              <p className="mb-6 text-sm text-neutral-500">
                Choose a password to secure your account.
              </p>
              <SetPasswordForm />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Test manually**

Go to `/set-password` without a valid Supabase session (e.g., not via an invite link) — should show the expiry error, NOT redirect to /login silently.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(auth\)/set-password/page.tsx
git commit -m "feat: show expiry error instead of silent redirect on set-password"
```

---

### Task 6.3: Fix hr/finance role — add to requireAuthenticated

**Problem:** `requireAuthenticated` in `src/lib/require-role.ts` only includes 5 roles: `admin, commercial_director, account_manager, account, operation`. HR and Finance users can be invited, set their password, and log in — but every API call returns 401 because their role is not in `requireAuthenticated`. They see a blank dashboard.

**Files:**
- Modify: `src/lib/require-role.ts`
- Modify: `src/components/layout/sidebar.tsx` (hide Targets for hr/finance same as operation)

- [ ] **Step 1: Add hr and finance to requireAuthenticated**

In `src/lib/require-role.ts`, change line 48:

```ts
// Before:
export const requireAuthenticated = () =>
  requireRole("admin", "commercial_director", "account_manager", "account", "operation")

// After:
export const requireAuthenticated = () =>
  requireRole("admin", "commercial_director", "account_manager", "account", "operation", "hr", "finance")
```

- [ ] **Step 2: Hide Targets and Pipeline from hr/finance in sidebar**

In `src/components/layout/sidebar.tsx`, update the role filter inside `visibleItems`:

```tsx
// Before:
const visibleItems = group.items.filter((item) => {
  if (item.href === "/targets" && user.role === "operation") return false
  return true
})

// After:
const NON_COMMERCIAL_ROLES = ["operation", "hr", "finance"]
const visibleItems = group.items.filter((item) => {
  if (item.href === "/targets" && NON_COMMERCIAL_ROLES.includes(user.role)) return false
  if (item.href === "/pipeline" && NON_COMMERCIAL_ROLES.includes(user.role)) return false
  return true
})
```

- [ ] **Step 3: Update sidebar role label display**

In `src/components/layout/sidebar.tsx`, update the role label in the bottom user info section to include hr/finance:

```tsx
// Find the <p> that shows user.role label and update:
<p className="text-xs text-neutral-400">
  {user.role === "commercial_director"
    ? "Commercial Director"
    : user.role === "admin"
    ? "Super Admin"
    : user.role === "account"
    ? "Busdev/AE"
    : user.role === "account_manager"
    ? "Account Manager"
    : user.role === "operation"
    ? "Operations"
    : user.role === "hr"
    ? "HR"
    : user.role === "finance"
    ? "Finance"
    : user.role}
</p>
```

- [ ] **Step 4: Test**

Login as an hr/finance user — should see Dashboard, Clients, Analytics, Account in sidebar. Should NOT see Pipeline or Targets.

- [ ] **Step 5: Commit**

```bash
git add src/lib/require-role.ts src/components/layout/sidebar.tsx
git commit -m "fix: add hr and finance roles to requireAuthenticated, hide pipeline/targets in sidebar"
```

---

### Task 6.4: Allow AE (account role) to create clients

**Problem:** `POST /api/clients` uses `requireAdminOrDirector`. An AE cannot create a new client. Since creating a lead requires an existing client, a new prospect cannot enter the pipeline without admin/director involvement. Core BizDev workflow is blocked.

**Decision:** Expand create-client permission to include `account` and `account_manager` roles. Client edit/delete stays admin/director only.

**Files:**
- Modify: `src/app/api/clients/route.ts`
- Modify: `src/components/clients/clients-table.tsx` (pass userRole so Add Client button shows for AE)
- Modify: `src/app/(dashboard)/clients/page.tsx` (fetch current user role, pass to ClientsTable)

- [ ] **Step 1: Update POST /api/clients to allow account roles**

In `src/app/api/clients/route.ts`, find the POST handler and change its guard:

```ts
// At the top, ensure requireCanEditClients is imported (it already covers admin, commercial_director, account_manager)
// But we also need "account" — so either update requireCanEditClients in require-role.ts
// OR use requireCanCreateLeads which already includes "account"

// In require-role.ts, change requireCanEditClients:
// Before:
export const requireCanEditClients = () =>
  requireRole("admin", "commercial_director", "account_manager")

// After:
export const requireCanEditClients = () =>
  requireRole("admin", "commercial_director", "account_manager", "account")
```

- [ ] **Step 2: Apply to POST handler in clients/route.ts**

In `src/app/api/clients/route.ts`, find the POST handler. Change the import line and guard:

```ts
// Change import line at top of file:
// Before:
import { requireAuthenticated, requireAdminOrDirector } from "@/lib/require-role"
// After:
import { requireAuthenticated, requireAdminOrDirector, requireCanEditClients } from "@/lib/require-role"

// In POST handler, change:
// Before:
export async function POST(request: NextRequest) {
  const user = await requireAdminOrDirector()
// After:
export async function POST(request: NextRequest) {
  const user = await requireCanEditClients()
```

- [ ] **Step 3: Pass userRole to ClientsTable so Add Client button shows for AE**

In `src/app/(dashboard)/clients/page.tsx`:

```tsx
// Add to imports:
import { createClient } from "@/lib/supabase/server"
import { prisma } from "@/lib/prisma"

// Add fetchCurrentUserRole function:
async function fetchCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return null
  const dbUser = await prisma.user.findUnique({
    where: { email: user.email },
    select: { role: true },
  })
  return dbUser?.role ?? null
}

// In ClientsContent, fetch alongside clients:
async function ClientsContent({ search, sort, dir }: ClientsContentProps) {
  const [{ clients, total }, aeOptions, userRole] = await Promise.all([
    fetchClients(search, sort, dir),
    fetchAeOptions(),
    fetchCurrentUserRole(),
  ])

  return (
    <ClientsTable
      initialClients={clients}
      initialTotal={total}
      aeOptions={aeOptions}
      searchQuery={search}
      sortCol={sort}
      sortDir={dir}
      userRole={userRole}
    />
  )
}
```

- [ ] **Step 4: Accept userRole prop in ClientsTable and conditionally show Add Client**

In `src/components/clients/clients-table.tsx`, add `userRole` to `ClientsTableProps`:

```tsx
interface ClientsTableProps {
  initialClients: ClientRow[]
  initialTotal: number
  aeOptions: AeOption[]
  searchQuery: string
  sortCol: string
  sortDir: string
  userRole: string | null  // ADD THIS
}
```

Then find where `<Button ... onClick={() => setAddOpen(true)}>Add Client</Button>` is rendered in the toolbar and wrap:

```tsx
// Find the Add Client button and update to:
{["admin", "commercial_director", "account_manager", "account"].includes(userRole ?? "") && (
  <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
    <Plus className="h-4 w-4" />
    Add Client
  </Button>
)}
```

- [ ] **Step 5: Test**

Login as `account` role → go to /clients → "Add Client" button should be visible → fill form and submit → client should be created successfully.

Login as `operation` → "Add Client" button should NOT appear.

- [ ] **Step 6: Commit**

```bash
git add src/lib/require-role.ts src/app/api/clients/route.ts src/app/\(dashboard\)/clients/page.tsx src/components/clients/clients-table.tsx
git commit -m "feat: allow account/account_manager roles to create clients"
```

---

## SPRINT 7 — Pipeline & CRM UX Fixes

**Scope:** 6 medium-priority issues causing friction for BizDev/AE users.

---

### Task 7.1: Fix loading state in PipelineKanbanLoader

**Problem:** `src/components/pipeline/pipeline-kanban-loader.tsx` returns `null` while leads are loading client-side. Users see a blank page briefly.

**Files:**
- Modify: `src/components/pipeline/pipeline-kanban-loader.tsx`

- [ ] **Step 1: Replace null return with skeleton**

Find `if (loading) { return null }` in `pipeline-kanban-loader.tsx` and replace:

```tsx
// Before:
if (loading) {
  return null
}

// After:
if (loading) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-56 rounded-md bg-neutral-100 animate-pulse" />
        <div className="h-9 w-24 rounded-md bg-neutral-100 animate-pulse" />
        <div className="ml-auto h-9 w-24 rounded-md bg-neutral-100 animate-pulse" />
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex w-[280px] flex-shrink-0 flex-col rounded-lg bg-neutral-50 border border-neutral-200">
            <div className="px-3 py-2.5 border-b border-neutral-200">
              <div className="h-4 w-28 rounded bg-neutral-200 animate-pulse" />
            </div>
            <div className="flex flex-col gap-2 p-2">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="rounded-lg border border-neutral-200 bg-white p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-neutral-100 animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-neutral-100 animate-pulse" />
                  <div className="h-5 w-24 rounded bg-neutral-100 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pipeline/pipeline-kanban-loader.tsx
git commit -m "fix: replace null loading state with skeleton in pipeline kanban loader"
```

---

### Task 7.2: Add account_manager to sales filter + fix AE assignment

**Problem 1:** `pipeline-kanban-loader.tsx` filters `salesUsers` by `role === "account" || role === "admin"` — account_manager is missing.

**Problem 2:** Lead detail page `AeCard` shows assigned AE but has no edit capability. AE reassignment requires using the API directly.

**Files:**
- Modify: `src/components/pipeline/pipeline-kanban-loader.tsx`
- Modify: `src/components/pipeline/lead-detail-client.tsx`

- [ ] **Step 1: Fix sales filter in kanban loader**

In `src/components/pipeline/pipeline-kanban-loader.tsx`, find:

```ts
const salesUsers = usersData.users.filter(
  (u) => u.role === "account" || u.role === "admin"
)
```

Replace with:

```ts
const salesUsers = usersData.users.filter(
  (u) => u.role === "account" || u.role === "admin" || u.role === "account_manager"
)
```

- [ ] **Step 2: Add SalesInline component to lead-detail-client.tsx**

In `src/components/pipeline/lead-detail-client.tsx`, find the `AeCard` component (around line 940) and replace it with an editable version:

```tsx
// Replace AeCard component entirely:

interface AeCardProps {
  leadId: string
  sales: { id: string; name: string } | null
  salesOptions: Array<{ id: string; name: string }>
}

function AeCard({ leadId, sales, salesOptions }: AeCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [selectedId, setSelectedId] = useState(sales?.id ?? "")
  const [saving, setSaving] = useState(false)
  const initials = sales ? getInitials(sales.name) : "?"

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salesId: selectedId || null }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update")
      }
      toast.success("Busdev/AE updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-neutral-800">Busdev/AE</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label="Edit AE"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="">Unassigned</option>
            {salesOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => { setSelectedId(sales?.id ?? ""); setEditing(false) }} disabled={saving} className="gap-1 h-7 px-2 text-xs">
              <X className="h-3 w-3" />Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="gap-1 h-7 px-2 text-xs">
              <Check className="h-3 w-3" />{saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-accent-700">{initials}</span>
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-800">{sales?.name ?? "Unassigned"}</p>
            <p className="text-xs text-neutral-500">Busdev/AE</p>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Pass salesOptions to lead detail page**

In `src/app/(dashboard)/pipeline/[id]/page.tsx`, fetch salesOptions and pass to `LeadDetailClient`. Check what the page currently looks like:

```tsx
// Add to page data fetch (in the existing Promise.all or separately):
const salesOptions = await prisma.user.findMany({
  where: { isActive: true, role: { in: ["account", "admin", "account_manager"] } },
  select: { id: true, name: true },
  orderBy: { name: "asc" },
})

// Pass to LeadDetailClient:
<LeadDetailClient lead={serializedLead} salesOptions={salesOptions} />
```

- [ ] **Step 4: Update LeadDetailClient to accept and use salesOptions**

In `src/components/pipeline/lead-detail-client.tsx`, update `LeadDetailClientProps`:

```tsx
export interface LeadDetailClientProps {
  lead: SerializedLead
  salesOptions: Array<{ id: string; name: string }>
}

export function LeadDetailClient({ lead, salesOptions }: LeadDetailClientProps) {
  // ... existing code ...
  // In the right column where AeCard is rendered, update:
  <AeCard leadId={lead.id} sales={lead.sales} salesOptions={salesOptions} />
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/pipeline/pipeline-kanban-loader.tsx src/components/pipeline/lead-detail-client.tsx src/app/\(dashboard\)/pipeline/\[id\]/page.tsx
git commit -m "feat: add AE reassignment on lead detail, fix account_manager in sales filter"
```

---

### Task 7.3: Add "Move to No Response" to lead stage actions

**Problem:** Stage `no_response` exists in the DB schema but has no UI path to set it. It appears in kanban but can only be set via API/data import.

**Files:**
- Modify: `src/components/pipeline/lead-detail-client.tsx`

- [ ] **Step 1: Add No Response option to StageActions popover**

In `src/components/pipeline/lead-detail-client.tsx`, find the `StageActions` component. Inside the `PopoverContent` where "Move to Lost Deal" is rendered, add "Move to No Response":

```tsx
// Inside PopoverContent div.flex.flex-col.gap-1, after Lost Deal button:
{!isLostDeal && (
  <>
    {nextStage && <div className="h-px bg-neutral-200 my-1" />}
    <button
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors text-left"
      onClick={() => {
        setPopoverOpen(false)
        setLostDealOpen(true)
      }}
    >
      Move to Lost Deal
    </button>
    <button
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-neutral-500 hover:bg-neutral-100 transition-colors text-left"
      onClick={() => {
        setPopoverOpen(false)
        void handleAdvanceStage("no_response")
      }}
    >
      Move to No Response
    </button>
  </>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pipeline/lead-detail-client.tsx
git commit -m "feat: add Move to No Response option in lead stage actions"
```

---

### Task 7.4: Remove permanently-disabled MoreHorizontal button

**Problem:** `LeadDetailActions` renders a `<Button disabled aria-disabled>` with `MoreHorizontal` icon. It's a placeholder left in production — confusing to users.

**Files:**
- Modify: `src/components/pipeline/lead-detail-client.tsx`

- [ ] **Step 1: Remove the disabled button**

In `src/components/pipeline/lead-detail-client.tsx`, find in `LeadDetailActions`:

```tsx
// DELETE these lines:
<Button variant="ghost" size="icon" className="h-8 w-8" disabled aria-disabled>
  <MoreHorizontal className="h-4 w-4" />
  <span className="sr-only">More options</span>
</Button>
```

Also remove `MoreHorizontal` from the lucide-react import if it's only used there.

- [ ] **Step 2: Commit**

```bash
git add src/components/pipeline/lead-detail-client.tsx
git commit -m "fix: remove permanently disabled MoreHorizontal placeholder button from lead detail"
```

---

### Task 7.5: Health status editable by account + account_manager

**Problem:** `EditStatusButton` on client detail only shows for `userRole === "admin"`. AEs who manage client relationships can't update health status themselves.

**Files:**
- Modify: `src/app/(dashboard)/clients/[id]/page.tsx`
- Modify: `src/app/api/clients/[id]/route.ts` (PATCH healthStatus permission)

- [ ] **Step 1: Expand EditStatusButton visibility**

In `src/app/(dashboard)/clients/[id]/page.tsx`, find:

```tsx
const isAdmin = userRole === "admin" || userRole === "commercial_director"
```

Change to:

```tsx
const isAdmin = userRole === "admin" || userRole === "commercial_director"
const canEditStatus = isAdmin || userRole === "account_manager" || userRole === "account"
```

Then find where `EditStatusButton` is rendered:

```tsx
// Before:
{userRole === "admin" && (
  <EditStatusButton ... />
)}

// After:
{canEditStatus && (
  <EditStatusButton ... />
)}
```

- [ ] **Step 2: Update PATCH /api/clients/[id] to allow AE to update healthStatus**

The current PATCH uses `requireAdminOrDirector` for ALL fields. We need to allow account/account_manager to PATCH healthStatus only.

In `src/app/api/clients/[id]/route.ts`, update PATCH handler:

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Try admin/director first, fall back to authenticated for health-status-only updates
  const adminUser = await requireAdminOrDirector()
  const authUser = adminUser ?? await requireCanEditClients()
  if (!authUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const user = authUser

  // ... existing body parsing ...

  // Non-admin users can ONLY update healthStatus
  if (!adminUser) {
    const allowedKeys = new Set(["healthStatus"])
    const requestedKeys = Object.keys(body)
    const forbidden = requestedKeys.filter((k) => !allowedKeys.has(k))
    if (forbidden.length > 0) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }
  }

  // ... rest of existing handler unchanged ...
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/clients/\[id\]/page.tsx src/app/api/clients/\[id\]/route.ts
git commit -m "feat: allow account/account_manager roles to update client health status"
```

---

### Task 7.6: Add estimated close date field to leads

**Problem:** No deadline/close date on leads. Directors can't see when deals are expected to close. Needed for pipeline forecasting.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/app/api/leads/route.ts` (POST)
- Modify: `src/app/api/leads/[id]/route.ts` (PATCH)
- Modify: `src/components/pipeline/lead-form-sheet.tsx`
- Modify: `src/components/pipeline/lead-detail-client.tsx`
- Modify: `src/types/index.ts` (if Lead type is defined there)

- [ ] **Step 1: Add expectedCloseDate to Prisma schema**

In `prisma/schema.prisma`, find the `Lead` model and add:

```prisma
model Lead {
  // ... existing fields ...
  expectedCloseDate DateTime?   // ADD THIS
  // ... rest of fields ...
}
```

- [ ] **Step 2: Run prisma db push**

```bash
cd "/Users/williamsudhana/VF ERP System/execution"
npx prisma db push
npx prisma generate
```

Expected: Schema changes applied, client regenerated.

- [ ] **Step 3: Add to POST /api/leads**

In `src/app/api/leads/route.ts`, add to the `prisma.lead.create` data object:

```ts
expectedCloseDate:
  typeof body.expectedCloseDate === "string" && body.expectedCloseDate
    ? new Date(body.expectedCloseDate)
    : null,
```

- [ ] **Step 4: Add to PATCH /api/leads/[id]**

In `src/app/api/leads/[id]/route.ts`, inside the PATCH update data builder, add:

```ts
if ("expectedCloseDate" in body) {
  updateData.expectedCloseDate =
    typeof body.expectedCloseDate === "string" && body.expectedCloseDate
      ? new Date(body.expectedCloseDate)
      : null
}
```

- [ ] **Step 5: Add field to lead-form-sheet.tsx**

In `src/components/pipeline/lead-form-sheet.tsx`, add to `FormState`:

```ts
interface FormState {
  // ... existing fields ...
  expectedCloseDate: string
}

const INITIAL_FORM: FormState = {
  // ... existing ...
  expectedCloseDate: "",
}
```

Add UI field before the Notes section:

```tsx
{/* Expected Close Date */}
<div className="space-y-1.5">
  <Label htmlFor="expectedCloseDate">Expected Close Date</Label>
  <Input
    id="expectedCloseDate"
    type="date"
    value={form.expectedCloseDate}
    onChange={(e) => handleField("expectedCloseDate", e.target.value)}
  />
</div>
```

Add to POST body in `handleSubmit`:

```ts
expectedCloseDate: form.expectedCloseDate || null,
```

- [ ] **Step 6: Add inline edit to lead-detail-client.tsx**

Add `expectedCloseDate` to `SerializedLead` interface:

```ts
interface SerializedLead {
  // ... existing ...
  expectedCloseDate: string | null
}
```

Add a simple inline display in Lead Details grid (similar pattern to `createdAt`):

```tsx
{lead.expectedCloseDate && (
  <div>
    <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-1">
      Expected Close
    </p>
    <p className="text-sm text-neutral-800">{formatDate(lead.expectedCloseDate)}</p>
  </div>
)}
```

Update serializer in `/api/leads/route.ts` to include:

```ts
expectedCloseDate: lead.expectedCloseDate?.toISOString() ?? null,
```

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/app/api/leads/route.ts src/app/api/leads/\[id\]/route.ts src/components/pipeline/lead-form-sheet.tsx src/components/pipeline/lead-detail-client.tsx
git commit -m "feat: add expected close date field to leads"
```

---

## SPRINT 8 — Analytics Improvements

**Scope:** 2 director-facing analytics gaps.

---

### Task 8.1: Revenue by product line chart

**Problem:** Analytics shows win rate by AE and by industry, but no revenue breakdown by product line (Stracomm, SMM, Media Buying, etc.). Directors can't see which services drive the most revenue.

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx`
- Modify: `src/components/analytics/analytics-content.tsx`

- [ ] **Step 1: Add product line revenue query in analytics/page.tsx**

In `src/app/(dashboard)/analytics/page.tsx`, add this query to the existing `Promise.all` fetch block:

```ts
// Add to parallel fetch:
const revenueByProductLine = await prisma.lead.groupBy({
  by: ["productLine"],
  where: {
    stage: { in: ["closed_won", "invoiced", "contract_renewal"] },
    actualRevenue: { not: null },
    ...(from ? { createdAt: { gte: new Date(from) } } : {}),
    ...(to ? { createdAt: { lte: new Date(to) } } : {}),
    ...(aeIdList.length > 0 ? { salesId: { in: aeIdList } } : {}),
  },
  _sum: { actualRevenue: true },
  orderBy: { _sum: { actualRevenue: "desc" } },
})

// Export type:
export type RevenueByProductLine = { productLine: string; revenue: number }
```

Pass to analytics-content:

```tsx
<AnalyticsContent
  // ... existing props ...
  revenueByProductLine={revenueByProductLine.map((r) => ({
    productLine: r.productLine,
    revenue: Number(r._sum.actualRevenue ?? 0),
  }))}
/>
```

- [ ] **Step 2: Add bar chart in analytics-content.tsx**

Add `RevenueByProductLine` to `AnalyticsContentProps`. Add a new section after the Revenue Trend chart:

```tsx
// PRODUCT LINE LABELS map:
const PRODUCT_LINE_LABELS: Record<string, string> = {
  stracomm: "Stracomm",
  smm: "SMM",
  creative_strategy: "Creative Strategy",
  media_buying: "Media Buying",
  ads_management: "Ads Mgmt",
  production: "Production",
  others: "Others",
}

// Chart section (add after Revenue Trend section):
<div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
  <h3 className="text-sm font-semibold text-neutral-800 mb-4">Revenue by Product Line</h3>
  {props.revenueByProductLine.length === 0 ? (
    <p className="text-sm text-neutral-400 py-8 text-center">No won revenue data</p>
  ) : (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={props.revenueByProductLine.map((r) => ({
          name: PRODUCT_LINE_LABELS[r.productLine] ?? r.productLine,
          revenue: r.revenue,
        }))}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v: number) => `${(v / 1_000_000).toFixed(0)}M`}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          formatter={(v: number) => [formatIDR(v), "Revenue"]}
          contentStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/analytics/page.tsx src/components/analytics/analytics-content.tsx
git commit -m "feat: add revenue by product line bar chart to analytics"
```

---

### Task 8.2: Show pipeline value (IDR) per stage in funnel

**Problem:** Pipeline Funnel chart shows only count per stage — not total deal value (IDR). Directors need "how much money is in Negotiation?" not just "how many deals."

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx` (add revenue sum to funnel query)
- Modify: `src/components/analytics/analytics-content.tsx` (show value in tooltip/label)

- [ ] **Step 1: Add revenue sum to funnel query**

In `analytics/page.tsx`, find where `pipelineFunnel` is calculated. Currently it uses `groupBy` on stage for count. Add a parallel query for sum:

```ts
// Find existing funnel groupBy and add actualRevenue + projectedRevenue sum:
const funnelRevenue = await prisma.lead.groupBy({
  by: ["stage"],
  _sum: { projectedRevenue: true, actualRevenue: true },
  where: {
    ...(from ? { createdAt: { gte: new Date(from) } } : {}),
    ...(to ? { createdAt: { lte: new Date(to) } } : {}),
  },
})

// Merge into FunnelStage type:
export type FunnelStage = { stage: string; count: number; revenue: number }

// When building pipelineFunnel array, include:
const revenueMap = new Map(
  funnelRevenue.map((r) => [
    r.stage,
    Number(r._sum.actualRevenue ?? 0) + Number(r._sum.projectedRevenue ?? 0),
  ])
)
const pipelineFunnel: FunnelStage[] = stageGroups.map((g) => ({
  stage: g.stage,
  count: g._count.stage,
  revenue: revenueMap.get(g.stage) ?? 0,
}))
```

- [ ] **Step 2: Update funnel chart tooltip in analytics-content.tsx**

Find the funnel `BarChart` or wherever `pipelineFunnel` is rendered. Update tooltip:

```tsx
<Tooltip
  formatter={(value: number, name: string, props: { payload?: { revenue?: number } }) => {
    if (name === "count") {
      const revenue = props.payload?.revenue ?? 0
      return [`${value} deals · ${formatIDR(revenue)}`, "Pipeline"]
    }
    return [value, name]
  }}
  contentStyle={{ fontSize: 12 }}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/analytics/page.tsx src/components/analytics/analytics-content.tsx
git commit -m "feat: show total deal value (IDR) per stage in pipeline funnel chart"
```

---

## SPRINT 9 — Nice-to-Have

**Scope:** 4 lower-priority improvements. Each independent.

---

### Task 9.1: Redirect after login to original URL

**Problem:** If session expires while user is at `/pipeline/abc`, they're sent to `/login`. After logging in, they're always redirected to `/dashboard` — not back to `/pipeline/abc`.

**Files:**
- Modify: `src/proxy.ts`
- Modify: `src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Add returnTo param in proxy.ts**

In `src/proxy.ts`, when redirecting unauthenticated user to login, append `returnTo`:

```ts
if (!user && isDashboardRoute) {
  const url = request.nextUrl.clone()
  url.pathname = "/login"
  url.searchParams.set("returnTo", pathname)
  return NextResponse.redirect(url)
}
```

- [ ] **Step 2: Read returnTo and redirect after login in login/page.tsx**

In `src/app/(auth)/login/page.tsx`, update `handleSubmit`:

```tsx
// At top of component, read searchParam:
const searchParams = useSearchParams()
const returnTo = searchParams.get("returnTo")

// In handleSubmit, after successful login:
const dest = returnTo && returnTo.startsWith("/") ? returnTo : "/dashboard"
router.push(dest)
```

Also add `import { useSearchParams } from "next/navigation"` and wrap the page in `<Suspense>` if needed (Next.js requires this for `useSearchParams` in client components). Since `LoginPage` is already client-only, just add the import.

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts src/app/\(auth\)/login/page.tsx
git commit -m "feat: redirect user back to original URL after login"
```

---

### Task 9.2: Allow user to edit their own name on Account page

**Problem:** `/account` page shows name/email/role as read-only. User cannot update their own display name.

**Files:**
- Modify: `src/app/(dashboard)/account/account-content.tsx`
- Modify: `src/app/api/users/[id]/route.ts` (PATCH — already exists, accepts name)

- [ ] **Step 1: Add name edit to AccountContent**

In `src/app/(dashboard)/account/account-content.tsx`, add name editing state and inline form. Add to the Profile card:

```tsx
// Add state:
const [editingName, setEditingName] = useState(false)
const [nameValue, setNameValue] = useState(name)
const [nameSaving, setNameSaving] = useState(false)

// Replace the Name row in the <dl>:
<div className="flex justify-between items-center">
  <dt className="text-neutral-500">Name</dt>
  {editingName ? (
    <div className="flex items-center gap-2">
      <Input
        value={nameValue}
        onChange={(e) => setNameValue(e.target.value)}
        className="h-7 text-sm w-40"
        autoFocus
      />
      <Button
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={nameSaving}
        onClick={async () => {
          if (!nameValue.trim()) return
          setNameSaving(true)
          try {
            // We need the user's DB id — pass it as a prop from the page
            const res = await fetch(`/api/users/${userId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: nameValue.trim() }),
            })
            if (!res.ok) throw new Error("Failed to update name")
            toast.success("Name updated")
            setEditingName(false)
          } catch {
            toast.error("Failed to update name")
          } finally {
            setNameSaving(false)
          }
        }}
      >
        Save
      </Button>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setNameValue(name); setEditingName(false) }}>
        Cancel
      </Button>
    </div>
  ) : (
    <div className="flex items-center gap-1.5">
      <dd className="font-medium text-neutral-800">{nameValue}</dd>
      <button onClick={() => setEditingName(true)} className="text-neutral-400 hover:text-neutral-600">
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  )}
</div>
```

Add `userId` and `Pencil` import to AccountContent props and imports.

- [ ] **Step 2: Pass userId from account page**

In `src/app/(dashboard)/account/page.tsx`, pass `id` from `dbUser`:

```tsx
<AccountContent
  name={dbUser.name ?? ""}
  email={sessionUser.email}
  role={sessionUser.role}
  division={dbUser.division ?? null}
  userId={dbUser.id}  // ADD THIS
/>
```

Update `AccountContentProps` to include `userId: string`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/account/account-content.tsx src/app/\(dashboard\)/account/page.tsx
git commit -m "feat: allow user to edit their own name on account page"
```

---

### Task 9.3: Add "Pipeline Value" stat to Analytics summary

**Problem:** Analytics has Overall Win Rate card but no "Total Pipeline Value" KPI — how much total deal value is currently in the active pipeline.

**Files:**
- Modify: `src/app/(dashboard)/analytics/page.tsx`
- Modify: `src/components/analytics/analytics-content.tsx`

- [ ] **Step 1: Query total active pipeline value**

In `analytics/page.tsx`, add:

```ts
const pipelineValue = await prisma.lead.aggregate({
  _sum: { projectedRevenue: true },
  where: {
    stage: { in: ["leads", "pipeline", "negotiation"] },
    ...(aeIdList.length > 0 ? { salesId: { in: aeIdList } } : {}),
  },
})

// Pass to content:
pipelineValue={Number(pipelineValue._sum.projectedRevenue ?? 0)}
```

- [ ] **Step 2: Add KPI card in analytics-content.tsx**

Find where `overallWinRate` card is rendered. Add alongside it:

```tsx
<div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card">
  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">
    Active Pipeline Value
  </p>
  <p className="text-2xl font-bold text-neutral-900 tabular-nums">
    {formatIDR(props.pipelineValue)}
  </p>
  <p className="text-xs text-neutral-400 mt-0.5">Leads + Pipeline + Negotiation</p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/analytics/page.tsx src/components/analytics/analytics-content.tsx
git commit -m "feat: add Active Pipeline Value KPI card to analytics"
```

---

### Task 9.4: Allow admin to edit user email in Settings

**Problem:** Settings user edit sheet only allows changing name and role. If a team member's email changes, admin has no UI path to update it.

**Note:** Changing email in Supabase Auth requires calling `adminClient.auth.admin.updateUserById()` AND updating Prisma DB. The DB email is the auth lookup key in `require-role.ts`.

**Files:**
- Modify: `src/components/settings/settings-content.tsx` (add email field to edit sheet)
- Modify: `src/app/api/users/[id]/route.ts` (PATCH — update both Supabase + Prisma)

- [ ] **Step 1: Add email field to user edit sheet in settings-content.tsx**

Find the Edit User Sheet form. Add email input below the Name field:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="edit-email">Email</Label>
  <Input
    id="edit-email"
    type="email"
    value={editForm.email}
    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
    placeholder="user@vosfoyerid.com"
  />
  <p className="text-xs text-neutral-400">
    Changing email will update Supabase Auth and send a confirmation.
  </p>
</div>
```

Add `email` to `editForm` state shape with initial value from the user being edited.

Pass `email` in the PATCH body when saving.

- [ ] **Step 2: Handle email in PATCH /api/users/[id]/route.ts**

Find the PATCH handler. Add email update logic:

```ts
// Import admin client at top:
import { createAdminClient } from "@/lib/supabase/admin-client"

// In PATCH body processing:
if ("email" in body && typeof body.email === "string" && body.email.trim()) {
  const newEmail = body.email.trim()

  // Update in Supabase Auth (find user by current email)
  const adminClient = createAdminClient()
  if (adminClient) {
    const existing = await prisma.user.findUnique({ where: { id }, select: { email: true } })
    if (existing) {
      // Find Supabase user by email
      const { data: { users } } = await adminClient.auth.admin.listUsers()
      const supabaseUser = users.find((u) => u.email === existing.email)
      if (supabaseUser) {
        await adminClient.auth.admin.updateUserById(supabaseUser.id, { email: newEmail })
      }
    }
  }

  updateData.email = newEmail
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/settings-content.tsx src/app/api/users/\[id\]/route.ts
git commit -m "feat: allow admin to edit user email in settings, syncs to Supabase Auth"
```

---

## Sprint Summary

| Sprint | Items | Priority |
|--------|-------|----------|
| Sprint 6 | Forgot Password, Invite expiry, hr/finance access, AE create client | 🔴 Critical |
| Sprint 7 | Pipeline loading skeleton, AE reassign, No Response stage, remove dead button, health status edit, close date | 🟡 Medium |
| Sprint 8 | Revenue by product line chart, pipeline value in funnel | 🟡 Medium |
| Sprint 9 | Redirect after login, edit name on account, pipeline value KPI, admin edit email | 🟠 Low |

**Recommended order:** Sprint 6 → Sprint 7 → Sprint 8 → Sprint 9. Each sprint is independently deployable.

---

## Known Constraints

- `prisma db push` must use `DIRECT_URL` (port 5432), not pooler (6543)
- After schema changes: `npx prisma generate` + restart dev server
- After schema changes that touch Sprint 7.6: run `seed-system-config.mjs` in prod DB if systemConfig was affected (it wasn't in this sprint)
- `SUPABASE_SERVICE_ROLE_KEY` must be set in `.env.local` for admin client operations (Task 9.4)
- Tailwind v4: CSS-first config in `globals.css`, no `tailwind.config.ts`
- Next.js 16: `params` in dynamic routes = `Promise<{id: string}>` — must be `await`-ed
