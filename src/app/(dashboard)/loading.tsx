// Route-level loading skeleton for all (dashboard) routes.
// Uses the .shimmer utility from globals.css and theme-token classes only.

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full min-h-screen bg-background">
      {/* Topbar placeholder */}
      <div className="h-14 border-b border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card flex items-center px-6 gap-4 shrink-0">
        <div className="shimmer h-5 w-32 rounded" />
        <div className="flex-1" />
        <div className="shimmer h-8 w-8 rounded-full" />
        <div className="shimmer h-8 w-8 rounded-full" />
      </div>

      {/* Page body */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Page title */}
        <div className="shimmer h-7 w-48 rounded" />

        {/* KPI card row */}
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card space-y-3"
            >
              <div className="shimmer h-4 w-24 rounded" />
              <div className="shimmer h-8 w-32 rounded" />
              <div className="shimmer h-3 w-20 rounded" />
            </div>
          ))}
        </div>

        {/* Content cards */}
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-200 dark:border-neutral-100 bg-white dark:bg-card p-5 shadow-card space-y-4"
            >
              <div className="shimmer h-5 w-36 rounded" />
              <div className="shimmer h-40 w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
