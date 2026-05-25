# Password Setup Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the invite flow so new users can set their own password, and add an Account page where any user can change their password.

**Architecture:** Four changes — fix the `redirectTo` URLs in both invite API routes so they point to `/set-password`, create a `/set-password` page (server guard + client form), create an `/account` page inside the dashboard layout, and add an Account nav item to the sidebar.

**Tech Stack:** Next.js 14 App Router, Supabase SSR (`@supabase/ssr`), Prisma, Tailwind CSS, shadcn/ui, sonner (toast), lucide-react

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/app/api/users/route.ts` | Fix `redirectTo` → `/set-password` |
| Modify | `src/app/api/users/[id]/invite/route.ts` | Fix `redirectTo` → `/set-password` |
| Create | `src/app/(auth)/set-password/page.tsx` | Server guard + renders `<SetPasswordForm>` |
| Create | `src/app/(dashboard)/account/page.tsx` | Server fetches user data + renders `<AccountContent>` |
| Modify | `src/components/layout/sidebar.tsx` | Add Account nav item (all users) |

---

## Task 1: Fix `redirectTo` in API routes

**Files:**
- Modify: `src/app/api/users/route.ts:85`
- Modify: `src/app/api/users/[id]/invite/route.ts:70-72`

- [ ] **Step 1: Update `redirectTo` in `POST /api/users`**

In `src/app/api/users/route.ts`, find line 85 and change:

```ts
// Before
const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://vf-erp.vercel.app"}/api/auth/callback?next=/dashboard`

// After
const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://vf-erp.vercel.app"}/api/auth/callback?next=/set-password`
```

- [ ] **Step 2: Update `redirectTo` in `POST /api/users/[id]/invite`**

In `src/app/api/users/[id]/invite/route.ts`, find lines 70-72 and change:

```ts
// Before
const redirectTo = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "https://vf-erp.vercel.app"
}/api/auth/callback?next=/dashboard`

// After
const redirectTo = `${
  process.env.NEXT_PUBLIC_APP_URL ?? "https://vf-erp.vercel.app"
}/api/auth/callback?next=/set-password`
```

- [ ] **Step 3: Verify**

Open both files. Confirm neither contains `next=/dashboard` in any `redirectTo` variable. The string `/set-password` must appear in both.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/users/route.ts src/app/api/users/\[id\]/invite/route.ts
git commit -m "fix: redirect invite/reset links to /set-password"
```

---

## Task 2: Create `/set-password` page

**Files:**
- Create: `src/app/(auth)/set-password/page.tsx`

This page splits into two parts: a server component (auth guard + redirect) and an inline client component (the form). Both live in the same file.

- [ ] **Step 1: Create the file**

Create `src/app/(auth)/set-password/page.tsx` with this content:

```tsx
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SetPasswordForm } from "./set-password-form"

export default async function SetPasswordPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-800">
            vosFoyer
          </h1>
          <p className="mt-1 text-sm text-neutral-500">ERP System — Internal Tool</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-8 shadow-modal">
          <h2 className="mb-2 text-lg font-semibold text-neutral-800">Set your password</h2>
          <p className="mb-6 text-sm text-neutral-500">
            Choose a password to secure your account.
          </p>
          <SetPasswordForm />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create the client form component**

Create `src/app/(auth)/set-password/set-password-form.tsx`:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"

export function SetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="password" className="mb-1.5 block text-sm font-medium text-neutral-700">
          New Password <span className="text-danger-500" aria-hidden>*</span>
        </Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
        />
      </div>

      <div>
        <Label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-neutral-700">
          Confirm Password <span className="text-danger-500" aria-hidden>*</span>
        </Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="••••••••"
          disabled={loading}
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Set Password"
        )}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd execution && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new files.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(auth\)/set-password/
git commit -m "feat: add /set-password page for invite and reset flows"
```

---

## Task 3: Create `/account` page

**Files:**
- Create: `src/app/(dashboard)/account/page.tsx`
- Create: `src/app/(dashboard)/account/account-content.tsx`

The page is a server component that fetches user profile data; `AccountContent` is the client component with the change-password form.

- [ ] **Step 1: Create the server page**

Create `src/app/(dashboard)/account/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Create the client content component**

Create `src/app/(dashboard)/account/account-content.tsx`:

```tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import type { Role } from "@/types"

const ROLE_LABEL: Record<Role, string> = {
  admin: "Super Admin",
  commercial_director: "Commercial Director",
  account_manager: "Account Manager",
  account: "Busdev/AE",
  operation: "Operations",
  hr: "HR",
  finance: "Finance",
}

interface AccountContentProps {
  name: string
  email: string
  role: Role
  division: string | null
}

export function AccountContent({ name, email, role, division }: AccountContentProps) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirm) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    setPassword("")
    setConfirm("")
    toast.success("Password berhasil diubah.")
    setLoading(false)
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 mb-4">Profile</h3>
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-neutral-500">Name</dt>
            <dd className="font-medium text-neutral-800">{name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Email</dt>
            <dd className="text-neutral-700">{email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-500">Role</dt>
            <dd className="text-neutral-700">{ROLE_LABEL[role]}</dd>
          </div>
          {division && (
            <div className="flex justify-between">
              <dt className="text-neutral-500">Division</dt>
              <dd className="text-neutral-700">{division}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Change password card */}
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <h3 className="text-sm font-semibold text-neutral-800 mb-1">Change Password</h3>
        <p className="text-xs text-neutral-500 mb-4">Set a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger-50 border border-danger-500/20 px-3 py-2.5 text-sm text-danger-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger-500" />
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="new-password" className="text-sm font-medium text-neutral-700">
              New Password <span className="text-danger-500" aria-hidden>*</span>
            </Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-password" className="text-sm font-medium text-neutral-700">
              Confirm Password <span className="text-danger-500" aria-hidden>*</span>
            </Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
            />
          </div>

          <Button type="submit" size="sm" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
cd execution && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to the new files.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/account/
git commit -m "feat: add /account page with change password"
```

---

## Task 4: Add Account nav item to sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx`

- [ ] **Step 1: Add `UserCircle` to the lucide-react import**

In `src/components/layout/sidebar.tsx`, the import block at the top currently reads:

```ts
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Target,
  BarChart3,
  Settings,
} from "lucide-react"
```

Change it to:

```ts
import {
  LayoutDashboard,
  KanbanSquare,
  Users,
  Target,
  BarChart3,
  Settings,
  UserCircle,
} from "lucide-react"
```

- [ ] **Step 2: Add Account nav section**

In `src/components/layout/sidebar.tsx`, the `<nav>` block ends after the ADMIN section (around line 139, `</nav>`). Add a new section for Account **before** the closing `</nav>` tag:

```tsx
        {/* Account — all users */}
        <div className="mb-2">
          <p className="mb-1 mt-4 px-4 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
            ACCOUNT
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/account"
                className={cn(
                  "flex items-center gap-2.5 mx-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors duration-100",
                  isActive("/account")
                    ? "bg-accent-50 text-accent-700 font-semibold border-l-2 border-accent-600 pl-[calc(0.75rem_-_2px)]"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800"
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
```

- [ ] **Step 3: Verify build**

```bash
cd execution && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Run dev server and verify visually**

```bash
cd execution && npm run dev
```

Open `http://localhost:3000`. Check:
1. Sidebar shows "ACCOUNT" section with "Account" link for all roles
2. Clicking Account → navigates to `/account`
3. `/account` shows profile info (name, email, role) + change password form
4. Invite a test user (or use "Send Password Reset") → click email link → lands on `/set-password` page (not `/dashboard`)
5. Fill in password on `/set-password` → submits → redirects to `/dashboard`
6. Log out and log back in with the new password → succeeds

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: add Account nav item to sidebar"
```
