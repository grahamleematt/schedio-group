import { FileDown } from 'lucide-react'
import {
  displaySubmissionCycle,
  formatCurrency,
  formatPercent,
  getStatusLabel,
  workflowConfigs,
} from '#/lib/sg-dream'
import type { Verification, Workflow } from '#/lib/sg-dream'

type VerificationSummaryTableProps = {
  workflow: Workflow
  verifications: ReadonlyArray<Verification>
  /** Per-submission live overrides (e.g. current draft submitted total
   * derived from the snapshot rather than static configuration). */
  liveSubmitted?: Readonly<Record<string, number>>
}

const underReviewLabel = 'Under Review'

export function VerificationSummaryTable({
  workflow,
  verifications,
  liveSubmitted,
}: VerificationSummaryTableProps) {
  const config = workflowConfigs[workflow]

  // Sort oldest -> newest so the running total reads naturally.
  const ordered = [...verifications].sort((a, b) => a.number - b.number)

  const approvedTotal = ordered
    .filter((v) => v.status === 'approved')
    .reduce((sum, v) => sum + v.costsVerified, 0)

  const title =
    workflow === 'district_dp'
      ? 'Submission summary'
      : 'Verified public costs summary'
  const hasAnySubmitted = ordered.some(
    (v) => (liveSubmitted?.[v.id] ?? v.costsSubmitted) > 0,
  )

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-white"
        style={{ background: 'var(--wf-base)' }}
      >
        <div>
          <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.12em] opacity-80">
            {config.label}
          </p>
          <h2 className="font-ops text-base font-semibold">{title}</h2>
          <p className="m-0 mt-1 max-w-[40rem] text-xs leading-snug text-white/75">
            {hasAnySubmitted
              ? 'Draft submission totals read from the current upload snapshot.'
              : 'No submission has started yet for this entity.'}
          </p>
        </div>
        <span className="inline-flex h-8 items-center gap-2 rounded-full bg-white/15 px-3 text-xs font-semibold">
          <FileDown className="size-3.5" />
          PDF export after final review
        </span>
      </header>

      <div className="data-table-frame">
        <table className="data-table-min w-full border-collapse text-sm">
          <thead className="text-left">
            <tr
              className="text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-text-muted"
              style={{ background: 'var(--color-surface-muted)' }}
            >
              <th className="px-5 py-3">Submission</th>
              <th className="px-5 py-3">Total submitted</th>
              <th className="px-5 py-3">
                {workflow === 'district_dp'
                  ? 'Total verified'
                  : 'Total public verified'}
              </th>
              <th className="px-5 py-3">
                {workflow === 'district_dp'
                  ? '% verified'
                  : '% verified public'}
              </th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((v) => {
              const isOpen = v.status === 'open'
              const isUnderReview = v.status === 'under_review'
              const submitted = liveSubmitted?.[v.id] ?? v.costsSubmitted
              const pct =
                v.status === 'approved' && v.costsSubmitted > 0
                  ? (v.costsVerified / v.costsSubmitted) * 100
                  : null
              return (
                <tr
                  key={v.id}
                  className="border-t text-sm"
                  style={{
                    borderColor: 'var(--color-border-base)',
                    background: isOpen ? 'rgba(251, 146, 60, 0.08)' : 'white',
                  }}
                >
                  <td className="px-5 py-3 font-mono font-semibold text-text-strong">
                    {isOpen
                      ? `Draft submission · ${displaySubmissionCycle(v)}`
                      : `Closed submission ${v.number} · ${displaySubmissionCycle(v)}`}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-strong">
                    {formatCurrency(submitted)}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-strong">
                    {isUnderReview || isOpen
                      ? 'Pending'
                      : formatCurrency(v.costsVerified)}
                  </td>
                  <td className="px-5 py-3 font-mono text-text-strong">
                    {pct === null ? 'Pending' : formatPercent(pct, 1)}
                  </td>
                  <td className="px-5 py-3">
                    {v.status === 'approved' ? (
                      <span className="status-pill-approved">Approved</span>
                    ) : v.status === 'under_review' ? (
                      <span className="status-pill-review">
                        {underReviewLabel}
                      </span>
                    ) : (
                      <span className="status-pill-open">
                        {isOpen ? 'Draft' : getStatusLabel(v.status)}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}

            <tr className="running-total-row">
              <td className="px-5 py-3 font-mono text-sm uppercase tracking-[0.08em]">
                Running total · approved
              </td>
              <td className="px-5 py-3 font-mono">—</td>
              <td className="px-5 py-3 font-mono">
                {formatCurrency(approvedTotal)}
              </td>
              <td className="px-5 py-3 font-mono">—</td>
              <td className="px-5 py-3 text-xs uppercase tracking-[0.08em] opacity-90">
                Updates as Schedio verifies
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
