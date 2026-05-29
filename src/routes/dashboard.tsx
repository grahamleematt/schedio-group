import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { UploadCloud } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DocumentInventoryTiles } from '#/components/sg-dream/DocumentInventoryTiles'
import { VerificationSummaryTable } from '#/components/sg-dream/VerificationSummaryTable'
import { WhatHappensNext } from '#/components/sg-dream/WhatHappensNext'
import { DashboardActions } from '#/components/sg-dream/DashboardActions'
import {
  daysUntilCutoff,
  displaySubmissionCycle,
  formatCurrency,
  getClientById,
  getKnownClientById,
  getDuplicateCounts,
  getOpenVerification,
  getVerificationById,
  getVerificationsByClient,
  summarizeDocTypes,
  workflowConfigs,
} from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import {
  liveVerificationTotals,
  storedListToDisplay,
} from '#/lib/sg-dream-adapter'

type DashboardSearch = {
  client: string
  verification?: string
}

export const Route = createFileRoute('/dashboard')({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    client: typeof s.client === 'string' ? s.client : 'dawson-trails-md1',
    verification:
      typeof s.verification === 'string' ? s.verification : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as DashboardSearch
    const requestedClient =
      typeof search.client === 'string' ? search.client : 'dawson-trails-md1'
    const knownClient = getKnownClientById(requestedClient)
    if (!knownClient) {
      const open = getOpenVerification('dawson-trails-md1')
      throw redirect({
        to: '/dashboard',
        search: { client: 'dawson-trails-md1', verification: open.id },
      })
    }
    const clientId = knownClient.id
    const requested =
      typeof search.verification === 'string' ? search.verification : ''
    if (requested) {
      const verification = getVerificationById(requested, clientId)
      if (!verification) {
        const open = getOpenVerification(clientId)
        throw redirect({
          to: '/dashboard',
          search: { client: clientId, verification: open.id },
        })
      }
      return context.queryClient.ensureQueryData(
        verificationSnapshotQuery(verification.id),
      )
    }
    const open = getOpenVerification(clientId)
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(open.id),
    )
  },
  head: () => ({ meta: [{ title: 'Dashboard | SG DREAM' }] }),
  component: DashboardPage,
})

function DashboardPage() {
  return <CustomerIntakeDashboard />
}

function CustomerIntakeDashboard() {
  const { client: clientId, verification: verificationId } = Route.useSearch()

  const client = getClientById(clientId)
  const activeVerification =
    (verificationId ? getVerificationById(verificationId, client.id) : null) ??
    getOpenVerification(client.id)

  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(activeVerification.id),
  )
  const snapshot = snapshotQuery.data

  const allVerifications = getVerificationsByClient(client.id)
  const storedDocs = snapshot?.verification.documents ?? []
  const docs = storedListToDisplay(storedDocs)
  const summaries = summarizeDocTypes(docs)
  const activeSummaries = summaries.filter((s) => s.count > 0)
  const duplicateCounts = getDuplicateCounts(docs)
  const liveTotals = liveVerificationTotals({
    snapshot,
    fallbackDocsCount: activeVerification.docsCount,
    fallbackCostsSubmitted: activeVerification.costsSubmitted,
  })
  const hasDraftSubmission = liveTotals.docsCount > 0
  const reviewCycle = displaySubmissionCycle(activeVerification)
  const days = daysUntilCutoff(activeVerification.cutoffDateISO)
  const daysTone =
    days <= 3 ? 'pill-red' : days <= 14 ? 'pill-amber' : 'pill-green'

  const config = workflowConfigs[client.workflow]

  return (
    <AppShell active="dashboard" crumbs={[{ label: 'Dashboard' }]}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Entity dashboard</p>
          <h1 className="v2-h1">{client.name}</h1>
          <p className="v2-lede">
            {config.label}. Live document inventory, intake status, and Schedio
            review progress for this entity.
          </p>
        </div>
        <Link
          to="/upload"
          search={{
            client: client.id,
            verification: activeVerification.id,
          }}
          className="v2-btn primary"
        >
          <UploadCloud className="size-4" />
          Submit documents
        </Link>
      </header>

      <section className="v2-card" aria-label="Current submission">
        <header className="v2-card-head">
          <span className="pill pill-wf">
            <span className="dot" />
            {hasDraftSubmission
              ? 'Draft submission'
              : 'No active submission'} · {reviewCycle}
          </span>
          <h3>
            {hasDraftSubmission
              ? `Draft submission · cutoff ${activeVerification.cutoffDate}`
              : `Ready for first upload · cutoff ${activeVerification.cutoffDate}`}
          </h3>
          <span className={`pill ${daysTone} ml-auto`}>
            {days <= 0
              ? 'Cutoff passed'
              : `${days} day${days === 1 ? '' : 's'} left`}
          </span>
        </header>
        <div className="v2-card-body">
          <div className="v2-stats">
            <div className="v2-stat">
              <div className="k">Docs uploaded</div>
              <div className="v">{liveTotals.docsCount}</div>
              <div className="d">
                {liveTotals.hasLiveDocs
                  ? `${activeSummaries.length} doc type${activeSummaries.length === 1 ? '' : 's'}`
                  : 'no uploads yet'}
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
              <div className="k">Authorization value</div>
              <div className="v">
                {formatCurrency(activeVerification.workAuthValue)}
              </div>
              <div className="d">Configured for this workflow</div>
            </div>
            <div className="v2-stat">
              <div className="k">Flagged</div>
              <div className="v">{duplicateCounts.total}</div>
              <div className="d">
                {duplicateCounts.exact} exact · {duplicateCounts.likely} likely
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-4 space-y-4">
        <DocumentInventoryTiles summaries={summaries} />

        <VerificationSummaryTable
          workflow={client.workflow}
          verifications={allVerifications}
          liveSubmitted={{ [activeVerification.id]: liveTotals.costsSubmitted }}
        />

        <WhatHappensNext
          workflow={client.workflow}
          hasSubmission={hasDraftSubmission}
        />

        <DashboardActions
          clientId={client.id}
          verificationId={activeVerification.id}
        />
      </div>
    </AppShell>
  )
}
