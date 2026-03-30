import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'

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
  return (
    <Card
      className={
        tone === 'operations'
          ? 'brand-panel rounded-[1.5rem] border-[rgba(0,61,166,0.16)] shadow-none'
          : 'brand-panel rounded-[1.5rem] border-[var(--brand-border)] shadow-none'
      }
    >
      <CardHeader className={tone === 'operations' ? 'space-y-2 pb-2' : 'space-y-2 pb-3'}>
        <CardTitle
          className={
            tone === 'operations'
              ? 'ops-label text-[var(--brand-blue)]'
              : 'text-sm font-semibold text-[var(--brand-muted)]'
          }
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={tone === 'operations' ? 'space-y-2.5 pt-0' : 'space-y-3'}>
        <p
          className={
            tone === 'operations'
              ? 'font-ops text-[2.35rem] leading-none font-semibold tracking-[-0.055em] text-[var(--brand-slate)] tabular-nums'
              : 'metric-value text-[var(--brand-slate)]'
          }
        >
          {value}
        </p>
        <p
          className={
            tone === 'operations'
              ? 'text-sm leading-6 text-[var(--brand-text)]'
              : 'text-sm leading-6 text-[var(--brand-muted)]'
          }
        >
          {note}
        </p>
      </CardContent>
    </Card>
  )
}
