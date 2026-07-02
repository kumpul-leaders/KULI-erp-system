import type { ReactNode } from "react"

interface TopbarProps {
  title: string
  children?: ReactNode
}

/**
 * Topbar shell — server component.
 * Height: 56px (h-14) per design spec.
 * Left: page title. Right: actions slot (children).
 *
 * Mobile: pl-14 leaves room for hamburger overlay injected by DashboardLayout.
 * Desktop: px-8 standard padding.
 */
export function Topbar({ title, children }: TopbarProps) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 pl-14 pr-4 md:px-8 sticky top-0 z-20">
      <h1 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-100 truncate">
        {title}
      </h1>
      {children && (
        <div className="ml-auto flex items-center gap-2 md:gap-3 flex-shrink-0">{children}</div>
      )}
    </header>
  )
}
