import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ClientStatus } from "@/types"

interface ClientStatusBadgeProps {
  status: ClientStatus | null | undefined
  className?: string
}

const clientStatusConfig: Record<ClientStatus, { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "border-transparent bg-success-50 text-success-700 hover:bg-success-50",
  },
  inactive: {
    label: "Inactive",
    className:
      "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-100",
  },
  lead: {
    label: "Lead",
    className:
      "border-transparent bg-accent-100 text-accent-700 hover:bg-accent-100",
  },
}

export function ClientStatusBadge({ status, className }: ClientStatusBadgeProps) {
  const config = status ? clientStatusConfig[status] : undefined
  if (!config) return <Badge className={cn("border-transparent bg-neutral-100 text-neutral-500", className)}>—</Badge>
  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
