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
  const isOperations = tone === 'operations'
  const isReview = tone === 'review'

  return (
    <Card
      className={
        isReview
          ? 'min-w-0 rounded-[1.5rem] border-[rgba(35,31,32,0.18)] bg-[linear-gradient(180deg,rgba(49,54,61,0.98),rgba(33,38,45,0.98))] shadow-[0_18px_36px_rgba(15,23,42,0.14)]'
          : isOperations
          ? 'brand-panel min-w-0 rounded-[1.5rem] border-[rgba(0,61,166,0.16)] shadow-none'
          : 'brand-panel min-w-0 rounded-[1.5rem] border-[var(--brand-border)] shadow-none'
      }
    >
      <CardHeader className={isOperations ? 'space-y-2 pb-2' : 'space-y-2 pb-3'}>
        <CardTitle
          className={
            isReview
              ? 'text-sm font-semibold text-white/62'
              : isOperations
              ? 'ops-label text-[var(--brand-blue)]'
              : 'text-sm font-semibold text-[var(--brand-muted)]'
          }
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className={isOperations ? 'space-y-2.5 pt-0' : 'space-y-3'}>
        <p
          className={
            isReview
              ? 'font-heading text-[2.35rem] leading-none font-bold tracking-[-0.05em] text-white tabular-nums'
              : isOperations
              ? 'font-ops text-[2.35rem] leading-none font-semibold tracking-[-0.055em] text-[var(--brand-slate)] tabular-nums'
              : 'metric-value text-[var(--brand-slate)]'
          }
        >
          {value}
        </p>
        <p
          className={
            isReview
              ? 'text-sm leading-6 text-white/76'
              : isOperations
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
