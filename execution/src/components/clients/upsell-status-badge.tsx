import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { UpsellStatus } from "@/types"

interface UpsellStatusBadgeProps {
  status: UpsellStatus
  className?: string
}

const upsellConfig: Record<UpsellStatus, { label: string; className: string }> = {
  identified: {
    label: "Identified",
    className: "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-100",
  },
  pitched: {
    label: "Pitched",
    className: "border-transparent bg-info-50 text-info-700 hover:bg-info-50",
  },
  won: {
    label: "Won",
    className: "border-transparent bg-success-50 text-success-700 hover:bg-success-50",
  },
  lost: {
    label: "Lost",
    className: "border-transparent bg-danger-50 text-danger-700 hover:bg-danger-50",
  },
}

export function UpsellStatusBadge({ status, className }: UpsellStatusBadgeProps) {
  const config = upsellConfig[status]
  if (!config) return <Badge className={cn("border-transparent bg-neutral-100 text-neutral-500", className)}>—</Badge>
  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
