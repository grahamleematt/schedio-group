import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

type MetricCardProps = {
  label: string
  value: string
  note: string
}

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <Card className="brand-panel rounded-[1.5rem] border-[var(--brand-border)] shadow-none">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-sm font-semibold text-[var(--brand-muted)]">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="metric-value text-[var(--brand-slate)]">{value}</p>
        <p className="text-sm leading-6 text-[var(--brand-muted)]">{note}</p>
      </CardContent>
    </Card>
  )
}
