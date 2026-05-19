import type { ReactNode } from "react"

interface TopbarProps {
  title: string
  children?: ReactNode
}

/**
 * Topbar shell — server component.
 * Height: 56px (h-14) per design spec.
 * Left: page title.
 * Right: actions slot (children).
 */
export function Topbar({ title, children }: TopbarProps) {
  return (
    <header className="flex h-14 flex-shrink-0 items-center border-b border-neutral-200 bg-white px-8">
      <h1 className="text-2xl font-bold tracking-tight text-neutral-800">
        {title}
      </h1>
      {children && (
        <div className="ml-auto flex items-center gap-3">{children}</div>
      )}
    </header>
  )
}
