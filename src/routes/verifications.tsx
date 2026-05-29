import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, UploadCloud } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  clients,
  daysUntilCutoff,
  displayRef,
  displaySubmissionCycle,
  formatCurrency,
  getClientById,
  getOpenVerification,
  getStatusLabel,
  getVerificationsByClient,
} from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { liveVerificationTotals } from '#/lib/sg-dream-adapter'

type VerificationsSearch = {
  client: string
}

export const Route = createFileRoute('/verifications')({
  validateSearch: (s: Record<string, unknown>): VerificationsSearch => ({
    client: typeof s.client === 'string' ? s.client : 'dawson-trails-md1',
  }),
  loader: ({ context, location }) => {
    const search = location.search as VerificationsSearch
    const requested =
      typeof search.client === 'string' ? search.client : 'dawson-trails-md1'
    const known = clients.find((c) => c.id === requested)
    if (!known) {
      throw redirect({
        to: '/verifications',
        search: { client: 'dawson-trails-md1' },
      })
    }
    const open = getOpenVerification(known.id)
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(open.id),
    )
  },
  head: () => ({ meta: [{ title: 'Submissions | SG DREAM' }] }),
  component: VerificationsPage,
})

function VerificationsPage() {
  const { client: clientId } = Route.useSearch()
  const client = getClientById(clientId)
  const all = getVerificationsByClient(client.id)
  const open = getOpenVerification(client.id)
  const previous = all.filter((v) => v.id !== open.id)
  const snapshotQuery = useQuery(verificationSnapshotQuery(open.id))
  const snapshot = snapshotQuery.data
  const liveTotals = liveVerificationTotals({
    snapshot,
    fallbackDocsCount: open.docsCount,
    fallbackCostsSubmitted: open.costsSubmitted,
  })
  const docsCount = liveTotals.docsCount
  const reviewCycle = displaySubmissionCycle(open)
  const hasDraftSubmission = docsCount > 0
  const submissionLabel = hasDraftSubmission
    ? `Draft submission · ${docsCount} document${docsCount === 1 ? '' : 's'}`
    : 'No active submission'
  const referenceStatus = hasDraftSubmission
    ? 'Assigned after Schedio review'
    : 'Pending first upload'
  const lowConfidenceFieldCount =
    snapshot?.verification.documents.reduce((sum, d) => {
      if (!d.lowConfidence || !d.fieldConfidence) return sum
      let lowCount = 0
      for (const v of Object.values(d.fieldConfidence)) {
        if (v < 0.85) lowCount += 1
      }
      return sum + lowCount
    }, 0) ?? 0

  const days = daysUntilCutoff(open.cutoffDateISO)
  const daysTone =
    days <= 3 ? 'pill-red' : days <= 14 ? 'pill-amber' : 'pill-green'

  const rail = (
    <>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Schedule</h3>
        </header>
        <div className="v2-card-body">
          <div className="kv">
            <span className="k">Period</span>
            <span className="v">{reviewCycle}</span>
          </div>
          <div className="kv">
            <span className="k">Cutoff</span>
            <span className="v">{open.cutoffDate}</span>
          </div>
          <div className="kv">
            <span className="k">Days remaining</span>
            <span className="v">
              <span className={`pill ${daysTone}`}>
                {days <= 0
                  ? 'Cutoff passed'
                  : `${days} day${days === 1 ? '' : 's'}`}
              </span>
            </span>
          </div>
          <div className="kv">
            <span className="k">Submission</span>
            <span className="v">{submissionLabel}</span>
          </div>
          <div className="kv">
            <span className="k">Reference status</span>
            <span className="v">{referenceStatus}</span>
          </div>
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Submission policies</h3>
        </header>
        <div className="v2-card-body space-y-2 text-[12.5px] text-ink-2">
          <p className="m-0">
            Files should land before <strong>{open.cutoffDate}</strong> for this
            review cycle. Schedio Group reviews accepted submissions within five
            business days.
          </p>
          <p className="m-0 text-muted-1">
            Engineer review is required when DocuPipe field confidence falls
            below 85%. The current submission has{' '}
            <strong className="text-ink">{lowConfidenceFieldCount}</strong>{' '}
            low-confidence field
            {lowConfidenceFieldCount === 1 ? '' : 's'} flagged.
          </p>
        </div>
      </section>
    </>
  )

  return (
    <AppShell
      active="verifications"
      crumbs={[{ label: 'Submissions' }]}
      rail={rail}
    >
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Step 2 · Submissions</p>
          <h1 className="v2-h1">{client.name}</h1>
          <p className="v2-lede">
            Start a submission by uploading or importing documents. Once the
            draft is accepted, Schedio assigns the official reference.
          </p>
        </div>
        <Link
          to="/upload"
          search={{ client: client.id, verification: open.id }}
          className="v2-btn primary"
        >
          <UploadCloud className="size-4" />
          {hasDraftSubmission ? 'Continue submission' : 'Start submission'}
        </Link>
      </header>

      <section className="v2-card mb-4">
        <header className="v2-card-head">
          <span className="pill pill-wf">
            <span className="dot" />
            {hasDraftSubmission ? 'Draft' : 'Not started'} · {reviewCycle}
          </span>
          <h3>
            {hasDraftSubmission
              ? `Draft submission · cutoff ${open.cutoffDate}`
              : `No active submission yet · cutoff ${open.cutoffDate}`}
          </h3>
          <span className="pill pill-gray ml-auto">
            {hasDraftSubmission ? 'Draft' : 'Empty'}
          </span>
        </header>
        <div className="v2-card-body">
          <div className="v2-stats">
            <div className="v2-stat">
              <div className="k">Documents so far</div>
              <div className="v">{docsCount}</div>
              <div className="d">
                {liveTotals.hasLiveDocs
                  ? 'Live count from queue'
                  : 'Awaiting first upload'}
              </div>
            </div>
            <div className="v2-stat">
              <div className="k">Costs submitted</div>
              <div className="v">
                {formatCurrency(liveTotals.costsSubmitted)}
              </div>
              <div className="d">
                {liveTotals.hasLiveAmounts
                  ? 'Sum of extracted invoice amounts'
                  : 'Awaiting extracted invoice amounts'}
              </div>
            </div>
            <div className="v2-stat">
              <div className="k">Work authorization</div>
              <div className="v">{formatCurrency(open.workAuthValue)}</div>
              <div className="d">Total authorized to date</div>
            </div>
            <div className="v2-stat">
              <div className="k">Low-confidence fields</div>
              <div className="v">{lowConfidenceFieldCount}</div>
              <div className="d">DocuPipe extraction signal</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/dashboard"
              search={{ client: client.id, verification: open.id }}
              className="v2-btn"
            >
              Open dashboard
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/processing"
              search={{ client: client.id, verification: open.id }}
              className="v2-btn"
            >
              See pipeline
            </Link>
          </div>
        </div>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Closed submissions</h3>
          <span className="sub">
            Amounts and status assigned by Schedio Group
          </span>
        </header>
        {previous.length === 0 ? (
          <div className="v2-card-body text-center text-[13px] text-muted-1">
            No closed submissions yet for this entity.
          </div>
        ) : (
          <div className="v2-table-scroll">
            <table className="v2-tbl">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th className="num">Submitted</th>
                  <th className="num">Verified</th>
                </tr>
              </thead>
              <tbody>
                {previous.map((v) => {
                  const statusPill =
                    v.status === 'approved'
                      ? 'pill pill-green'
                      : v.status === 'under_review'
                        ? 'pill pill-amber'
                        : 'pill pill-gray'
                  const previousRef = displayRef({
                    snapshotRef: null,
                    client,
                    verification: v,
                  })
                  return (
                    <tr key={v.id}>
                      <td>
                        <span className="mono">{previousRef}</span>
                      </td>
                      <td>{displaySubmissionCycle(v)}</td>
                      <td>
                        <span className={statusPill}>
                          <span className="dot" />
                          {getStatusLabel(v.status)}
                        </span>
                      </td>
                      <td className="num">
                        {formatCurrency(v.costsSubmitted)}
                      </td>
                      <td className="num">
                        {v.status === 'approved'
                          ? formatCurrency(v.costsVerified)
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AppShell>
  )
}
