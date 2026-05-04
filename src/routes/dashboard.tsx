import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { UploadCloud } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DocumentInventoryTiles } from '#/components/sg-dream/DocumentInventoryTiles'
import { VerificationSummaryTable } from '#/components/sg-dream/VerificationSummaryTable'
import { ContractTrackingTable } from '#/components/sg-dream/ContractTrackingTable'
import { WhatHappensNext } from '#/components/sg-dream/WhatHappensNext'
import { DashboardActions } from '#/components/sg-dream/DashboardActions'
import {
  computeContractSummary,
  daysUntilCutoff,
  docTypeOrder,
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
import type { DocType } from '#/lib/sg-dream'
import type { NameDisplay } from '#/components/sg-dream/DocumentLibrary'
import { verificationSnapshotQuery } from '#/lib/queries'
import {
  liveVerificationTotals,
  storedListToDisplay,
} from '#/lib/sg-dream-adapter'

type DashboardSearch = {
  client: string
  verification?: string
  libraryQuery?: string
  libraryOpen?: DocType
  nameDisplay?: NameDisplay
  expandedVendor?: string
}

const docTypes = new Set<DocType>(docTypeOrder)
const nameDisplayValues = new Set<NameDisplay>([
  'original',
  'standardized',
  'both',
])

export const Route = createFileRoute('/dashboard')({
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : undefined,
    libraryQuery:
      typeof s.libraryQuery === 'string' && s.libraryQuery.length > 0
        ? s.libraryQuery
        : undefined,
    libraryOpen:
      typeof s.libraryOpen === 'string' &&
      docTypes.has(s.libraryOpen as DocType)
        ? (s.libraryOpen as DocType)
        : undefined,
    nameDisplay:
      typeof s.nameDisplay === 'string' &&
      nameDisplayValues.has(s.nameDisplay as NameDisplay)
        ? (s.nameDisplay as NameDisplay)
        : undefined,
    expandedVendor:
      typeof s.expandedVendor === 'string' && s.expandedVendor.length > 0
        ? s.expandedVendor
        : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as DashboardSearch
    const requestedClient =
      typeof search.client === 'string' ? search.client : 'srcab'
    const knownClient = getKnownClientById(requestedClient)
    if (!knownClient) {
      const open = getOpenVerification('srcab')
      throw redirect({
        to: '/dashboard',
        search: { client: 'srcab', verification: open.id },
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
  const { client: clientId } = Route.useSearch()
  const client = getClientById(clientId)
  if (client.workflow === 'developer_reimb') {
    return <ReimbursementDashboard />
  }
  return <DistrictDashboard />
}

function DistrictDashboard() {
  const navigate = useNavigate()
  const {
    client: clientId,
    verification: verificationId,
    libraryQuery,
    libraryOpen,
    nameDisplay,
    expandedVendor,
  } = Route.useSearch()

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
  const vendors = getVendorsByClient(client.id)
  const contractSummary = computeContractSummary(client.id)
  const duplicateCounts = getDuplicateCounts(docs)
  const liveTotals = liveVerificationTotals({
    snapshot,
    mockDocsCount: activeVerification.docsCount,
    mockCostsSubmitted: activeVerification.costsSubmitted,
  })
  const days = daysUntilCutoff(activeVerification.cutoffDateISO)
  const daysTone =
    days <= 3 ? 'pill-red' : days <= 14 ? 'pill-amber' : 'pill-green'

  const baseSearch = {
    client: client.id,
    verification: activeVerification.id,
    libraryQuery,
    libraryOpen,
    nameDisplay,
    expandedVendor,
  }

  const toggleVendor = (vendorId: string) => {
    void navigate({
      to: '/dashboard',
      search: {
        ...baseSearch,
        expandedVendor: expandedVendor === vendorId ? undefined : vendorId,
      },
      resetScroll: false,
    })
  }

  const config = workflowConfigs[client.workflow]

  return (
    <AppShell active="dashboard" crumbs={[{ label: 'Dashboard' }]}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Entity dashboard</p>
          <h1 className="v2-h1">{client.name}</h1>
          <p className="v2-lede">
            {config.label}. Verification summary, document inventory, and
            contract tracking, scoped to V{activeVerification.number}.
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
          Upload more documents
        </Link>
      </header>

      <section className="v2-card" aria-label="Open verification">
        <header className="v2-card-head">
          <span className="pill pill-wf">
            <span className="dot" />V{activeVerification.number} ·{' '}
            {activeVerification.period}
          </span>
          <h3>Currently open · cutoff {activeVerification.cutoffDate}</h3>
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
                  : 'Mock financial framing'}
              </div>
            </div>
            <div className="v2-stat">
              <div className="k">Work authorization</div>
              <div className="v">
                {formatCurrency(activeVerification.workAuthValue)}
              </div>
              <div className="d">Total authorized to date</div>
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

        <ContractTrackingTable
          vendors={vendors}
          summary={contractSummary}
          expandedVendor={expandedVendor}
          onToggleVendor={toggleVendor}
        />

        <WhatHappensNext workflow={client.workflow} />

        <DashboardActions
          clientId={client.id}
          verificationId={activeVerification.id}
        />
      </div>
    </AppShell>
  )
}

const REIMBURSEMENT_CAP = 2_400_000

function ReimbursementDashboard() {
  const { client: clientId, verification: verificationId } = Route.useSearch()
  const client = getClientById(clientId)
  const activeVerification =
    (verificationId ? getVerificationById(verificationId, client.id) : null) ??
    getOpenVerification(client.id)

  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(activeVerification.id),
  )
  const snapshot = snapshotQuery.data
  const storedDocs = snapshot?.verification.documents ?? []
  const docs = storedListToDisplay(storedDocs)
  const summaries = summarizeDocTypes(docs)
  const activeSummaries = summaries.filter((s) => s.count > 0)
  const liveTotals = liveVerificationTotals({
    snapshot,
    mockDocsCount: activeVerification.docsCount,
    mockCostsSubmitted: activeVerification.costsSubmitted,
  })

  const allVerifications = getVerificationsByClient(client.id)
  const sorted = [...allVerifications].sort((a, b) => a.number - b.number)
  // DR programs reimburse a public-eligible portion (not 1:1 with submitted).
  const eligibleRatio = 0.81
  const cumulativeApprovedSubmitted = sorted
    .filter((v) => v.status === 'approved')
    .reduce((s, v) => s + v.costsSubmitted, 0)
  const cumulativeApprovedEligible = cumulativeApprovedSubmitted * eligibleRatio
  const cumulativeApprovedVerified = sorted
    .filter((v) => v.status === 'approved')
    .reduce((s, v) => s + v.costsVerified, 0)
  const cumulativePct =
    cumulativeApprovedSubmitted > 0
      ? (cumulativeApprovedVerified / cumulativeApprovedSubmitted) * 100
      : 0

  const inReviewSubmitted = sorted
    .filter((v) => v.status === 'under_review')
    .reduce((s, v) => s + v.costsSubmitted, 0)
  const inReviewEligible = inReviewSubmitted * eligibleRatio
  const openSubmitted = liveTotals.costsSubmitted
  const openEligible = openSubmitted * eligibleRatio
  const remainingCap = Math.max(
    0,
    REIMBURSEMENT_CAP - cumulativeApprovedVerified,
  )
  const capPct = (cumulativeApprovedVerified / REIMBURSEMENT_CAP) * 100

  const days = daysUntilCutoff(activeVerification.cutoffDateISO)
  const daysTone =
    days <= 3 ? 'pill-red' : days <= 14 ? 'pill-amber' : 'pill-green'

  const rail = (
    <>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Verification V{activeVerification.number}</h3>
        </header>
        <div className="v2-card-body">
          <div className="kv">
            <span className="k">Cutoff</span>
            <span className="v mono">{activeVerification.cutoffDate}</span>
          </div>
          <div className="kv">
            <span className="k">Days left</span>
            <span className="v">
              <span className={`pill ${daysTone}`}>
                {days <= 0
                  ? 'Cutoff passed'
                  : `${days} day${days === 1 ? '' : 's'}`}
              </span>
            </span>
          </div>
          <div className="kv">
            <span className="k">Eligibility ratio</span>
            <span className="v mono">81% (3-V avg)</span>
          </div>
          <div className="my-3 border-t border-line-2" />
          <Link
            to="/upload"
            search={{
              client: client.id,
              verification: activeVerification.id,
            }}
            className="v2-btn primary w-full justify-center"
          >
            Continue submission
          </Link>
        </div>
      </section>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>How DR works</h3>
        </header>
        <div className="v2-card-body">
          <p className="text-ink-2 m-0 text-[12px] leading-relaxed">
            Developer fronts construction costs. Schedio verifies the
            public-infrastructure portion. The district reimburses on a
            pre-agreed schedule, capped at the master agreement total.
          </p>
        </div>
      </section>
    </>
  )

  return (
    <AppShell active="dashboard" crumbs={[{ label: 'Dashboard' }]} rail={rail}>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Entity workspace · Developer Reimbursement</p>
          <h1 className="v2-h1">{client.name}</h1>
          <p className="v2-lede">
            Single-table layout for blue-flow entities. Costs are submitted by
            the developer; Schedio verifies the public-eligible portion that
            is reimbursed through the district.
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
          Submit Documents
        </Link>
      </header>

      <section className="v2-card mb-4" aria-label="Open verification">
        <header className="v2-card-head">
          <span className="pill pill-brand">
            <span className="dot" />
            Developer Reimbursement
          </span>
          <h3>
            V{activeVerification.number} · {activeVerification.period}
          </h3>
          <span className="sub mono ml-auto">
            Cutoff {activeVerification.cutoffDate} ·{' '}
            <strong style={{ color: 'var(--color-amber-base)' }}>
              {days <= 0
                ? 'cutoff passed'
                : `${days} day${days === 1 ? '' : 's'} left`}
            </strong>
          </span>
        </header>
        <div className="v2-stats">
          <div className="v2-stat">
            <div className="k">Docs uploaded</div>
            <div className="v">{liveTotals.docsCount}</div>
            <div className="d">
              {liveTotals.hasLiveDocs
                ? `across ${activeSummaries.length} doc type${activeSummaries.length === 1 ? '' : 's'}`
                : 'no uploads yet'}
            </div>
          </div>
          <div className="v2-stat">
            <div className="k">Costs submitted</div>
            <div className="v mono">{formatCurrency(openSubmitted)}</div>
            <div className="d">
              {liveTotals.hasLiveAmounts
                ? 'sum of extracted invoice amounts'
                : 'developer-funded'}
            </div>
          </div>
          <div className="v2-stat">
            <div className="k">Public eligible (est.)</div>
            <div className="v mono">{formatCurrency(openEligible)}</div>
            <div className="d">
              {Math.round(eligibleRatio * 100)}% of submitted
            </div>
          </div>
          <div className="v2-stat">
            <div className="k">Reimbursement cap</div>
            <div className="v mono">{formatCurrency(REIMBURSEMENT_CAP)}</div>
            <div className="d">master agreement</div>
          </div>
        </div>
      </section>

      <section className="v2-card mb-4">
        <header className="v2-card-head">
          <h3>Verified public-eligible costs · summary</h3>
          <span className="sub">
            Developer Reimbursement does not track per-vendor contracts
          </span>
        </header>
        <table className="v2-tbl">
          <thead>
            <tr>
              <th>Verification</th>
              <th>Period</th>
              <th className="num">Submitted</th>
              <th className="num">Public eligible</th>
              <th className="num">Verified</th>
              <th className="num">% Eligible</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((v) => {
              const isOpen = v.id === activeVerification.id
              const submitted = isOpen ? openSubmitted : v.costsSubmitted
              const eligible = submitted * eligibleRatio
              const pctEligible =
                v.status === 'approved' && v.costsSubmitted > 0
                  ? (v.costsVerified / v.costsSubmitted) * 100
                  : null
              const pill =
                v.status === 'approved'
                  ? 'pill pill-green'
                  : v.status === 'under_review'
                    ? 'pill pill-amber'
                    : 'pill pill-brand'
              const statusLabel =
                v.status === 'approved'
                  ? 'Approved'
                  : v.status === 'under_review'
                    ? 'Under Review'
                    : 'Open'
              return (
                <tr
                  key={v.id}
                  style={
                    isOpen ? { background: 'var(--wf-soft)' } : undefined
                  }
                >
                  <td className="mono">
                    {isOpen ? <strong>V{v.number}</strong> : `V${v.number}`}
                  </td>
                  <td>{v.period}</td>
                  <td className="num mono">{formatCurrency(submitted)}</td>
                  <td className="num mono">{formatCurrency(eligible)}</td>
                  <td className="num mono">
                    {v.status === 'approved'
                      ? formatCurrency(v.costsVerified)
                      : 'Pending'}
                  </td>
                  <td className="num mono">
                    {pctEligible !== null
                      ? `${pctEligible.toFixed(1)}%`
                      : '—'}
                  </td>
                  <td>
                    <span className={pill}>
                      <span className="dot" />
                      {statusLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
            <tr style={{ background: 'var(--wf-base)' }}>
              <td
                colSpan={2}
                style={{
                  color: '#fff',
                  borderBottom: 'none',
                  fontWeight: 600,
                }}
              >
                Cumulative · approved verifications
              </td>
              <td
                className="num mono"
                style={{ color: '#fff', borderBottom: 'none' }}
              >
                {formatCurrency(cumulativeApprovedSubmitted)}
              </td>
              <td
                className="num mono"
                style={{ color: '#fff', borderBottom: 'none' }}
              >
                {formatCurrency(cumulativeApprovedEligible)}
              </td>
              <td
                className="num mono"
                style={{ color: '#fff', borderBottom: 'none' }}
              >
                {formatCurrency(cumulativeApprovedVerified)}
              </td>
              <td
                className="num mono"
                style={{ color: '#fff', borderBottom: 'none' }}
              >
                {cumulativePct.toFixed(1)}%
              </td>
              <td style={{ borderBottom: 'none' }} />
            </tr>
          </tbody>
        </table>
      </section>

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Reimbursement runway</h3>
          <span className="sub">
            Cap: {formatCurrency(REIMBURSEMENT_CAP)} · approved:{' '}
            {formatCurrency(cumulativeApprovedVerified)}
          </span>
        </header>
        <div className="v2-card-body">
          <div className="text-muted-1 mb-1.5 flex justify-between text-[12px]">
            <span>
              Approved {formatCurrency(cumulativeApprovedVerified)}
            </span>
            <span className="mono">{Math.round(capPct)}% of cap</span>
            <span>Cap {formatCurrency(REIMBURSEMENT_CAP)}</span>
          </div>
          <div className="ubar healthy" style={{ height: '10px' }}>
            <span
              style={{
                width: `${Math.min(100, Math.max(0, capPct))}%`,
                background: 'var(--wf-base)',
              }}
            />
          </div>
          <div className="mt-3.5 grid grid-cols-2 gap-2.5 text-[12px] sm:grid-cols-4">
            <RunwayCell
              label="Approved (cumulative)"
              value={formatCurrency(cumulativeApprovedVerified)}
            />
            <RunwayCell
              label="In review"
              value={formatCurrency(inReviewEligible)}
            />
            <RunwayCell
              label={`Pending (V${activeVerification.number} est.)`}
              value={formatCurrency(openEligible)}
            />
            <RunwayCell
              label="Remaining cap"
              value={formatCurrency(remainingCap)}
            />
          </div>
        </div>
      </section>
    </AppShell>
  )
}

function RunwayCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="ops-label">{label}</div>
      <div className="mono mt-0.5 font-semibold text-ink">{value}</div>
    </div>
  )
}
