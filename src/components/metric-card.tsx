import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'

type MetricCardProps = {
  label: string
  value: string
  note: string
  tone?: 'trust' | 'operations' | 'review'
}

export function MetricCard({
  label,
  value,
  note,
  tone = 'trust',
}: MetricCardProps) {
  const isOperations = tone === 'operations'

  return (
    <Card className="brand-panel min-w-0 rounded-[1.5rem] shadow-none border-border-base transition-colors">
      <CardHeader
        className={isOperations ? 'space-y-2 pb-2' : 'space-y-2 pb-3'}
      >
        <CardTitle
          className={cn(
            'text-sm font-semibold',
            isOperations ? 'ops-label' : 'text-text-muted',
          )}
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={isOperations ? 'space-y-2.5 pt-0' : 'space-y-3'}>
        <p
          className={cn(
            'leading-none tabular-nums tracking-tight',
            isOperations
              ? 'font-ops text-[2.35rem] font-semibold text-text-strong'
              : 'font-heading text-[2.35rem] font-bold text-text-strong',
          )}
        >
          {value}
        </p>
        <p
          className={cn(
            'text-sm leading-6',
            isOperations ? 'text-text-base' : 'text-text-muted',
          )}
        >
          {note}
        </p>
      </CardContent>
    </Card>
  )
}
