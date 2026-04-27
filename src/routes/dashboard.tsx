import {
  Link,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { UploadCloud } from 'lucide-react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { VerificationDashboardCard } from '#/components/sg-dream/VerificationDashboardCard'
import { DocumentInventoryTiles } from '#/components/sg-dream/DocumentInventoryTiles'
import { VerificationSummaryTable } from '#/components/sg-dream/VerificationSummaryTable'
import { ContractTrackingTable } from '#/components/sg-dream/ContractTrackingTable'
import { DocumentLibrary } from '#/components/sg-dream/DocumentLibrary'
import { WhatHappensNext } from '#/components/sg-dream/WhatHappensNext'
import { DashboardActions } from '#/components/sg-dream/DashboardActions'
import { CutoffCountdown } from '#/components/sg-dream/CutoffCountdown'
import {
  computeContractSummary,
  docTypeOrder,
  getClientById,
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
import { storedListToDisplay } from '#/lib/sg-dream-adapter'

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
    const clientId = typeof search.client === 'string' ? search.client : 'srcab'
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

  const allVerifications = getVerificationsByClient(client.id)
  const storedDocs = snapshotQuery.data?.verification.documents ?? []
  const docs = storedListToDisplay(storedDocs)
  const summaries = summarizeDocTypes(docs)
  const activeSummaries = summaries.filter((s) => s.count > 0)
  const vendors = getVendorsByClient(client.id)
  const contractSummary = computeContractSummary(client.id)

  const queryValue = libraryQuery ?? ''
  const nameDisplayValue: NameDisplay = nameDisplay ?? 'both'

  const baseSearch = {
    client: client.id,
    verification: activeVerification.id,
    libraryQuery,
    libraryOpen,
    nameDisplay,
    expandedVendor,
  }

  const updateLibrary = (next: {
    query?: string
    open?: DocType | undefined
    nameDisplay?: NameDisplay
  }) => {
    void navigate({
      to: '/dashboard',
      search: {
        ...baseSearch,
        libraryQuery:
          next.query !== undefined
            ? next.query.length > 0
              ? next.query
              : undefined
            : libraryQuery,
        libraryOpen: next.open !== undefined ? next.open : libraryOpen,
        nameDisplay:
          next.nameDisplay !== undefined ? next.nameDisplay : nameDisplay,
      },
      resetScroll: false,
    })
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

  return (
    <WorkflowChrome
      workflow={client.workflow}
      eyebrow="Entity dashboard"
      title={`${client.name} · Dashboard`}
      description={`${workflowConfigs[client.workflow].label}. Verification summary and contract tracking stack below. Everything on this page is scoped to the active verification.`}
      actions={
        <Link
          to="/upload"
          search={{
            client: client.id,
            verification: activeVerification.id,
          }}
          className="wf-button-primary"
        >
          <UploadCloud className="size-4" />
          Upload more documents
        </Link>
      }
      aside={
        <div className="space-y-2 text-sm">
          <VerificationPill
            number={activeVerification.number}
            period={activeVerification.period}
          />
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-ops text-base font-semibold text-text-strong">
              Cutoff {activeVerification.cutoffDate}
            </p>
            <CutoffCountdown
              cutoffDateISO={activeVerification.cutoffDateISO}
              label=""
            />
          </div>
          <p className="text-xs text-text-muted">
            Entity Owner: {client.entityOwnerName}
          </p>
          {allVerifications.length > 1 ? (
            <div
              className="mt-3 rounded-xl border bg-white/90 px-3 py-2"
              style={{ borderColor: 'var(--color-border-base)' }}
            >
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-text-muted">
                Switch verification
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {allVerifications.map((v) => {
                  const isActive = v.id === activeVerification.id
                  return (
                    <Link
                      key={v.id}
                      to="/dashboard"
                      search={{
                        client: client.id,
                        verification: v.id,
                        libraryQuery: undefined,
                        libraryOpen: undefined,
                      }}
                      className="inline-flex h-7 items-center rounded-full border px-2.5 text-[0.72rem] font-semibold no-underline"
                      style={{
                        borderColor: isActive
                          ? 'var(--wf-border)'
                          : 'var(--color-border-base)',
                        background: isActive
                          ? 'var(--wf-soft)'
                          : 'var(--color-surface-panel)',
                        color: isActive
                          ? 'var(--wf-strong)'
                          : 'var(--color-text-strong)',
                      }}
                    >
                      V{v.number}
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}
        </div>
      }
    >
      <WorkflowBanner workflow={client.workflow} />

      <VerificationDashboardCard
        verification={activeVerification}
        docsUploaded={docs.length}
        docTypeCount={activeSummaries.length}
        costsSubmitted={activeVerification.costsSubmitted}
        workAuthValue={activeVerification.workAuthValue}
      />

      <DocumentInventoryTiles summaries={summaries} />

      <VerificationSummaryTable
        workflow={client.workflow}
        verifications={allVerifications}
      />

      <ContractTrackingTable
        vendors={vendors}
        summary={contractSummary}
        expandedVendor={expandedVendor}
        onToggleVendor={toggleVendor}
      />

      <DocumentLibrary
        documents={docs}
        query={queryValue}
        openCategory={libraryOpen}
        nameDisplay={nameDisplayValue}
        onQueryChange={(q) => updateLibrary({ query: q })}
        onToggleCategory={(t) =>
          updateLibrary({ open: libraryOpen === t ? undefined : t })
        }
        onNameDisplayChange={(v) => updateLibrary({ nameDisplay: v })}
      />

      <WhatHappensNext workflow={client.workflow} />

      <DashboardActions
        clientId={client.id}
        verificationId={activeVerification.id}
      />
    </WorkflowChrome>
  )
}
