import type { Verification } from '#/lib/sg-dream'
import { displaySubmissionCycle, formatCurrency } from '#/lib/sg-dream'
import { VerificationPill } from './VerificationPill'

type VerificationDashboardCardProps = {
  verification: Verification
  docsUploaded: number
  docTypeCount: number
  costsSubmitted: number
  workAuthValue: number
}

export function VerificationDashboardCard({
  verification,
  docsUploaded,
  docTypeCount,
  costsSubmitted,
  workAuthValue,
}: VerificationDashboardCardProps) {
  const reviewCycle = displaySubmissionCycle(verification)
  const stats = [
    { label: 'Documents uploaded', value: docsUploaded.toString() },
    { label: 'Document types', value: docTypeCount.toString() },
    {
      label: 'Costs submitted',
      value: formatCurrency(costsSubmitted),
    },
    {
      label: 'Work authorization',
      value: formatCurrency(workAuthValue),
    },
  ]

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl p-5 sm:p-6"
      style={{
        background:
          'linear-gradient(180deg, var(--wf-softer) 0%, rgba(255,255,255,0.98) 65%)',
        borderColor: 'var(--wf-border)',
      }}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl font-mono text-lg font-semibold"
            style={{
              background: 'var(--wf-base)',
              color: 'var(--color-brand-white)',
            }}
          >
            Σ
          </span>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <VerificationPill
                number={verification.number}
                period={reviewCycle}
              />
              <span className="status-pill-open">Currently open</span>
            </div>
            <h2 className="font-ops text-xl font-semibold tracking-[-0.02em] text-text-strong">
              Draft submission · {reviewCycle}
            </h2>
            <p className="text-sm text-text-muted">
              Cutoff {verification.cutoffDate}. Schedio Group will assign a
              reference number when this submission is finalized.
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border bg-white/95 px-4 py-3"
            style={{ borderColor: 'var(--color-border-base)' }}
          >
            <dt className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
              {s.label}
            </dt>
            <dd className="mt-1 font-ops text-lg font-semibold text-text-strong">
              {s.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
