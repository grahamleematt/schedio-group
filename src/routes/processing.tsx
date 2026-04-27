import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, FileQuestion, Loader2, UploadCloud } from 'lucide-react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { ProcessingLog } from '#/components/sg-dream/ProcessingLog'
import {
  formatRef,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'

type ProcessingSearch = {
  client: string
  verification: string
}

export const Route = createFileRoute('/processing')({
  validateSearch: (s: Record<string, unknown>): ProcessingSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : 'srcab-v4',
  }),
  loader: ({ context, location }) => {
    const search = location.search as ProcessingSearch
    const clientId = typeof search.client === 'string' ? search.client : 'srcab'
    const requested =
      typeof search.verification === 'string' ? search.verification : ''
    const verification = getVerificationById(requested, clientId)
    if (!verification) {
      const open = getOpenVerification(clientId)
      throw redirect({
        to: '/processing',
        search: { client: clientId, verification: open.id },
      })
    }
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(verification.id),
    )
  },
  head: () => ({ meta: [{ title: 'Processing | SG DREAM' }] }),
  component: ProcessingPage,
})

function ProcessingPage() {
  const { client: clientId, verification: verificationId } = Route.useSearch()
  const client = getClientById(clientId)
  // Loader has already redirected on cross-client URL drift, so the
  // non-null assertion here is safe at runtime.
  const verification =
    getVerificationById(verificationId, clientId) ??
    getOpenVerification(clientId)
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )

  const docs = snapshotQuery.data?.verification.documents ?? []
  const isEmpty = docs.length === 0
  const allCompleted =
    docs.length > 0 && docs.every((d) => d.status === 'completed')
  const anyError = docs.some((d) => d.status === 'error')

  const previewRef = formatRef({
    workflow: client.workflow,
    number: verification.number,
    year: verification.year,
    seq: verification.seq,
  })

  return (
    <WorkflowChrome
      workflow={client.workflow}
      eyebrow="Step 4 · Analyzing documents"
      title="Running duplicate detection & classification"
      description="SG DREAM streams each upload through DocuPipe for classification, field extraction, and comparison against every prior filing for this entity."
      aside={
        <div className="space-y-2 text-sm">
          <VerificationPill
            number={verification.number}
            period={verification.period}
          />
          <p className="font-ops text-base font-semibold text-text-strong">
            {client.name}
          </p>
          <p className="text-xs text-text-muted">
            Preview reference{' '}
            <span className="font-mono text-text-strong">{previewRef}</span>.
          </p>
          <p className="flex items-center gap-2 text-xs text-text-muted">
            {allCompleted ? null : (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            {allCompleted
              ? 'Extraction complete. Ready for review.'
              : 'Touch point 2 · automated duplicate check'}
          </p>
        </div>
      }
      actions={
        isEmpty ? (
          <Link
            to="/upload"
            search={{ client: client.id, verification: verification.id }}
            className="wf-button-primary"
          >
            <UploadCloud className="size-4" />
            Upload documents
          </Link>
        ) : allCompleted ? (
          <Link
            to="/confirmation"
            search={{ client: client.id, verification: verification.id }}
            className="wf-button-primary"
          >
            View confirmation
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button type="button" className="wf-button-primary" disabled>
            {anyError ? 'Check errors above' : 'Waiting for DocuPipe…'}
            <ArrowRight className="size-4" />
          </button>
        )
      }
    >
      <WorkflowBanner workflow={client.workflow} />
      {isEmpty ? (
        <ProcessingEmptyState
          clientId={client.id}
          verificationId={verification.id}
        />
      ) : (
        <ProcessingLog docs={docs} />
      )}
    </WorkflowChrome>
  )
}

function ProcessingEmptyState({
  clientId,
  verificationId,
}: {
  clientId: string
  verificationId: string
}) {
  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl p-6 text-center sm:p-10"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <span
        aria-hidden
        className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl"
        style={{
          background: 'var(--wf-softer)',
          color: 'var(--wf-strong)',
        }}
      >
        <FileQuestion className="size-6" />
      </span>
      <h2 className="mt-3 font-ops text-lg font-semibold text-text-strong">
        No documents yet for this verification
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Nothing has been queued for DocuPipe. Upload one or more files to kick
        off classification, extraction, and duplicate detection.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link
          to="/upload"
          search={{ client: clientId, verification: verificationId }}
          className="wf-button-primary"
        >
          <UploadCloud className="size-4" />
          Upload documents
        </Link>
        <Link
          to="/dashboard"
          search={{
            client: clientId,
            verification: verificationId,
            libraryQuery: undefined,
            libraryOpen: undefined,
          }}
          className="wf-button-secondary"
        >
          Back to dashboard
        </Link>
      </div>
    </section>
  )
}
