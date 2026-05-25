# Design: Password Setup & Account Settings Flow

**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** Invite flow fix + self-service password change

---

## Problem

Users invited via `inviteUserByEmail` get a one-time magic link session but land on `/dashboard` with no password set. Subsequent `signInWithPassword` logins fail. There is also no way for users to change their own password.

---

## Approach

**A — `/set-password` page + `/account` page** (approved)

Two new pages, each with a single purpose:
- `/(auth)/set-password` — for post-invite / post-reset-link password setup
- `/(dashboard)/account` — for in-app self-service password change

---

## Files

### New
| Path | Purpose |
|------|---------|
| `src/app/(auth)/set-password/page.tsx` | Set password page (post invite/reset link) |
| `src/app/(dashboard)/account/page.tsx` | Account settings page (change password) |

### Modified
| Path | Change |
|------|--------|
| `src/app/api/users/route.ts` | `redirectTo` → `next=/set-password` |
| `src/app/api/users/[id]/invite/route.ts` | `redirectTo` → `next=/set-password` |
| `src/components/layout/sidebar.tsx` | Add "Account" nav item |

---

## Flow 1: Invite / Reset Link

1. Admin adds user or sends invite/reset from Settings → Users
2. Supabase sends email with magic link
3. User clicks link → `/api/auth/callback?code=...&next=/set-password`
4. Callback exchanges code for session → redirects to `/set-password`
5. User sees form: **New Password** + **Confirm Password**
6. On submit: `supabase.auth.updateUser({ password })` (client-side)
7. On success: redirect to `/dashboard`
8. User can now login normally with `email + password`

**Guard:** Server-side session check at page load. No session → redirect to `/login`.

---

## Flow 2: Self-Service Change Password

1. User clicks "Account" in sidebar → `/account`
2. Page shows read-only profile info (name, email, role)
3. "Change Password" section: **New Password** + **Confirm Password**
4. On submit: `supabase.auth.updateUser({ password })` (client-side, user already has session)
5. On success: toast "Password berhasil diubah"

---

## Component Specs

### `/(auth)/set-password/page.tsx`

- **Layout:** `/(auth)/` — no sidebar, no topbar. Centered card, matches `/login` visual style.
- **Server guard:** `createServerClient` → `getUser()` → if no user, `redirect('/login')`
- **Client component:** Password + Confirm Password inputs
- **Validation:** Both fields required, min 8 chars, must match
- **Submit:** `supabase.auth.updateUser({ password })` from `createClient()`
- **Success:** `router.push('/dashboard')`
- **Error:** Inline banner (same pattern as login page error banner)

### `/(dashboard)/account/page.tsx`

- **Layout:** `/(dashboard)/` — uses existing sidebar + topbar
- **Server component:** Fetch current user from session + Prisma for name/role/division
- **Client component:** Read-only profile card + change password form
- **Validation:** Both fields required, min 8 chars, must match
- **Submit:** `supabase.auth.updateUser({ password })` from `createClient()`
- **Success:** `toast.success("Password berhasil diubah")`
- **Error:** Inline error below form

### Sidebar update

- Add nav item: icon `UserCircle`, label `Account`, href `/account`
- Position: bottom of nav list, above any logout/auth controls

---

## API Changes

**No new API routes needed.** Both pages use `supabase.auth.updateUser({ password })` directly from the client — the user's active session authorizes the call.

### `redirectTo` update (both routes)

```
Before: .../api/auth/callback?next=/dashboard
After:  .../api/auth/callback?next=/set-password
```

Applies to:
- `src/app/api/users/route.ts` line 85
- `src/app/api/users/[id]/invite/route.ts` line 70–72

---

## Validation Rules (both pages)

- Password: required, min 8 characters
- Confirm Password: must match Password exactly
- Client-side validation before submit (show inline error, do not call Supabase)

---

## Edge Cases

| Case | Handling |
|------|---------|
| User hits `/set-password` with no session | Server redirect → `/login` |
| User hits `/set-password` already logged in with password set | Show form anyway — harmless, lets them reset if needed |
| Supabase `updateUser` error | Show error message inline |
| Passwords don't match | Client-side error, no Supabase call |
| Password too short | Client-side error, no Supabase call |
