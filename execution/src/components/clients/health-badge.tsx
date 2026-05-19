import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { HealthStatus } from "@/types"

interface HealthBadgeProps {
  status: HealthStatus
  className?: string
}

const healthConfig: Record<HealthStatus, { label: string; className: string }> = {
  healthy: {
    label: "Healthy",
    className:
      "border-transparent bg-success-50 text-success-700 hover:bg-success-50",
  },
  at_risk: {
    label: "At Risk",
    className:
      "border-transparent bg-warning-50 text-warning-700 hover:bg-warning-50",
  },
  churned: {
    label: "Churned",
    className:
      "border-transparent bg-danger-50 text-danger-700 hover:bg-danger-50",
  },
}

export function HealthBadge({ status, className }: HealthBadgeProps) {
  const config = healthConfig[status]
  if (!config) return <Badge className={cn("border-transparent bg-neutral-100 text-neutral-500", className)}>—</Badge>
  return (
    <Badge className={cn(config.className, className)}>
      {config.label}
    </Badge>
  )
}
