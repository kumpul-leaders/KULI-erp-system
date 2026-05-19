import { redirect } from "next/navigation"

/**
 * Root route — redirect to /dashboard.
 * Middleware handles auth check before rendering dashboard.
 */
export default function RootPage() {
  redirect("/dashboard")
}
