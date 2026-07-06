import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { UploadCloud } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DocumentInventoryTiles } from '#/components/sg-dream/DocumentInventoryTiles'
import { VerificationSummaryTable } from '#/components/sg-dream/VerificationSummaryTable'
import { WhatHappensNext } from '#/components/sg-dream/WhatHappensNext'
import { DashboardActions } from '#/components/sg-dream/DashboardActions'
import {
  computeContractSummary,
  computeVendorUtilization,
  liveSpendByVendor,
  daysUntilCutoff,
  displaySubmissionCycle,
  formatCurrency,
  getClientById,
  getKnownClientById,
  getDuplicateCounts,
  getOpenVerification,
  getVendorsByClient,
  getVerificationById,
  getVerificationsByClient,
  summarizeDocTypes,
  workflowConfigs,
} from '#/lib/sg-dream'
import { portalConfigQuery, verificationSnapshotQuery } from '#/lib/queries'
import { usePortalConfig } from '#/lib/session'
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
    client: typeof s.client === 'string' ? s.client : '',
    verification:
      typeof s.verification === 'string' ? s.verification : undefined,
  }),
  loader: async ({ context, location }) => {
    const search = location.search as DashboardSearch
    const knownClient = getKnownClientById(search.client)
    if (!knownClient) {
      throw redirect({ to: '/clients' })
    }
    const clientId = knownClient.id
    const { verifications } =
      await context.queryClient.ensureQueryData(portalConfigQuery())
    const requested =
      typeof search.verification === 'string' ? search.verification : ''
    if (requested) {
      const verification = getVerificationById(
        verifications,
        requested,
        clientId,
      )
      if (!verification) {
        const open = getOpenVerification(verifications, clientId)
        throw redirect({
          to: '/dashboard',
          search: { client: clientId, verification: open.id },
        })
      }
      return context.queryClient.ensureQueryData(
        verificationSnapshotQuery(verification.id),
      )
    }
    const open = getOpenVerification(verifications, clientId)
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

  const config = usePortalConfig()
  const client = getClientById(clientId)
  const activeVerification =
    (verificationId
      ? getVerificationById(config.verifications, verificationId, client.id)
      : null) ?? getOpenVerification(config.verifications, client.id)

  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(activeVerification.id),
  )
  const snapshot = snapshotQuery.data

  const allVerifications = getVerificationsByClient(
    config.verifications,
    client.id,
  )
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
  const days = daysUntilCutoff(
    activeVerification.cutoffDateISO,
    config.todayISO,
  )
  const daysTone =
    days <= 3 ? 'pill-red' : days <= 14 ? 'pill-amber' : 'pill-green'

  const workflowConfig = workflowConfigs[client.workflow]

  // Contract tracking is a stacked-dashboard (District Direct Pay) concern.
  // The single-column (Developer Reimbursement) dashboard omits it, which also
  // avoids surfacing a $0 "Authorization value" when no vendor contracts exist.
  const isStacked = workflowConfig.dashboardKind === 'stacked'
  const spendByVendor = liveSpendByVendor(docs)
  const contractSummary = computeContractSummary(
    config.vendors,
    client.id,
    spendByVendor,
  )
  const hasContracts = contractSummary.authorized > 0
  const amendCount = getVendorsByClient(config.vendors, client.id).filter(
    (v) =>
      computeVendorUtilization(v, spendByVendor.get(v.code) ?? 0).band ===
      'amend',
  ).length

  return (
    <AppShell active="dashboard" crumbs={[{ label: 'Dashboard' }]}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Entity dashboard</p>
          <h1 className="v2-h1">{client.name}</h1>
          <p className="v2-lede">
            {workflowConfig.label}. Live document inventory, intake status, and
            Schedio review progress for this entity.
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
                  ? liveTotals.payAppTotal > 0 && liveTotals.invoiceTotal > 0
                    ? `Invoices ${formatCurrency(liveTotals.invoiceTotal)} · pay apps ${formatCurrency(liveTotals.payAppTotal)}`
                    : liveTotals.payAppTotal > 0
                      ? 'Sum of pay-app current payment due'
                      : 'Sum of extracted invoice amounts'
                  : 'Awaiting extracted invoice + pay-app amounts'}
              </div>
            </div>
            {hasContracts ? (
              <div className="v2-stat">
                <div className="k">Authorization value</div>
                <div className="v">
                  {formatCurrency(contractSummary.authorized)}
                </div>
                <div className="d">
                  {Math.round(contractSummary.pct)}% committed across vendor
                  contracts
                </div>
              </div>
            ) : null}
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
        <DocumentInventoryTiles
          summaries={summaries}
          clientId={client.id}
          verificationId={activeVerification.id}
        />

        {isStacked && hasContracts ? (
          <section className="v2-card" aria-label="Contract tracking">
            <header className="v2-card-head">
              <h3>Contract tracking</h3>
              {amendCount > 0 ? (
                <span className="pill pill-red ml-auto">
                  <span className="dot" />
                  {amendCount} amendment{amendCount === 1 ? '' : 's'} likely
                </span>
              ) : (
                <span className="pill pill-green ml-auto">
                  <span className="dot" />
                  All contracts healthy
                </span>
              )}
            </header>
            <div className="v2-card-body">
              <div className="v2-stats">
                <div className="v2-stat">
                  <div className="k">Authorized</div>
                  <div className="v mono">
                    {formatCurrency(contractSummary.authorized)}
                  </div>
                  <div className="d">across active vendor contracts</div>
                </div>
                <div className="v2-stat">
                  <div className="k">Spent to date</div>
                  <div className="v mono">
                    {formatCurrency(contractSummary.spent)}
                  </div>
                  <div className="d">
                    {Math.round(contractSummary.pct)}% of authorized
                  </div>
                </div>
                <div className="v2-stat">
                  <div className="k">Remaining</div>
                  <div className="v mono">
                    {formatCurrency(contractSummary.remaining)}
                  </div>
                  <div className="d">runway against open authorizations</div>
                </div>
              </div>
              <div className="mt-4">
                <Link
                  to="/contracts"
                  search={{ client: client.id }}
                  className="v2-btn"
                >
                  Open contract tracking
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <VerificationSummaryTable
          workflow={client.workflow}
          verifications={allVerifications}
          liveSubmitted={{ [activeVerification.id]: liveTotals.costsSubmitted }}
          clientId={client.id}
          openVerificationId={activeVerification.id}
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
