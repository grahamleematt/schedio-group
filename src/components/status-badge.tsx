import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

const statusMap: Record<
  string,
  'neutral' | 'success' | 'warning' | 'error' | 'info' | 'accent'
> = {
  Incoming: 'neutral',
  Processing: 'info',
  Classified: 'accent',
  Available: 'success',
  'Engineering review': 'warning',
  Open: 'info',
  'Approaching cutoff': 'warning',
  'Past cutoff': 'error',
  Expected: 'neutral',
  Optional: 'neutral',
  'Proposed class': 'info',
  'Needs confirmation': 'warning',
  'Ready for review': 'success',
  'Support pending': 'warning',
  'Duplicate watch': 'warning',
  'On time': 'info',
  Draft: 'neutral',
  Reviewed: 'accent',
  Approved: 'success',
  Superseded: 'neutral',
  Relied: 'info',
  Locked: 'success',
  'Drafting capability': 'info',
  'Approval capability': 'accent',
  PLAT_GEOMETRY: 'info',
  SCOPE_INTERPRETATION: 'info',
  ENGINEER_ESTIMATE: 'neutral',
  PLANNING_DOCUMENT: 'info',
  PRELIMINARY_PLAT: 'accent',
  FINAL_PLAT: 'success',
  PLAT_AMENDMENT: 'warning',
  'Governance checked': 'accent',
  'Needs review': 'error',
  'Naming check': 'warning',
  'Needs review / blocked': 'error',
  Published: 'success',
  'Ready to publish': 'success',
  Ready: 'success',
  Blocked: 'error',
  'Needs review / publish': 'warning',
  Mapped: 'info',
  Internal: 'neutral',
}

const variantStyles = {
  neutral: 'border-border-base bg-surface-muted text-text-strong',
  success: 'border-transparent bg-status-success-bg text-status-success-text',
  warning: 'border-transparent bg-status-warning-bg text-status-warning-text',
  error: 'border-transparent bg-status-error-bg text-status-error-text',
  info: 'border-transparent bg-primary-soft text-text-accent',
  accent: 'border-transparent bg-stage-drafting-bg text-text-accent',
}

export function StatusBadge({ label }: { label: string }) {
  const variant = statusMap[label] ?? 'neutral'
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold tracking-[0.02em]',
        variantStyles[variant],
      )}
    >
      {label}
    </Badge>
  )
}
