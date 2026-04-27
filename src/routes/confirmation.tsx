import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleCheck,
  FolderOpen,
  Lock,
  X,
} from 'lucide-react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { DuplicateAlertPanel } from '#/components/sg-dream/DuplicateAlertPanel'
import { DuplicateFlagPill } from '#/components/sg-dream/DuplicateFlag'
import {
  docTypeLabels,
  getClientById,
  getOpenVerification,
  getVerificationById,
  summarizeDocTypes,
  workflowConfigs,
} from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'

const LOW_CONFIDENCE_UI_THRESHOLD = 0.85

type ConfirmationSearch = {
  client: string
  verification: string
  compare?: string
}

export const Route = createFileRoute('/confirmation')({
  validateSearch: (s: Record<string, unknown>): ConfirmationSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : 'srcab-v4',
    compare:
      typeof s.compare === 'string' && s.compare.length > 0
        ? s.compare
        : undefined,
  }),
  loader: ({ context, location }) => {
    const search = location.search as ConfirmationSearch
    const clientId = typeof search.client === 'string' ? search.client : 'srcab'
    const requested =
      typeof search.verification === 'string' ? search.verification : ''
    const verification = getVerificationById(requested, clientId)
    if (!verification) {
      const open = getOpenVerification(clientId)
      throw redirect({
        to: '/confirmation',
        search: { client: clientId, verification: open.id },
      })
    }
    return context.queryClient.ensureQueryData(
      verificationSnapshotQuery(verification.id),
    )
  },
  head: () => ({ meta: [{ title: 'Submission confirmed | SG DREAM' }] }),
  component: ConfirmationPage,
})

function ConfirmationPage() {
  const { client: clientId, verification: verificationId, compare } =
    Route.useSearch()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(verificationId, clientId) ??
    getOpenVerification(clientId)
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data

  const storedDocs = snapshot?.verification.documents ?? []
  const docs = storedListToDisplay(storedDocs)
  const summaries = summarizeDocTypes(docs).filter((s) => s.count > 0)
  const flaggedDocs = docs.filter((d) => d.duplicateFlag !== 'none')
  const flaggedCount = flaggedDocs.length
  const lowConfidenceDocs = docs.filter((d) => d.lowConfidence)
  const classifiedFolder = (() => {
    const classified = docs.find((d) => d.egnyteClassifiedPath)
    if (!classified?.egnyteClassifiedPath) return undefined
    const parts = classified.egnyteClassifiedPath.split('/')
    // Trim filename and DocType folder to show the per-verification Classified/.
    return parts.slice(0, -2).join('/') + '/Classified/'
  })()
  const compareDoc = compare
    ? docs.find((d) => d.id === compare)
    : undefined

  const refNumber =
    snapshot?.verification.ref ?? `${workflowConfigs[client.workflow].refPrefix}-V${verification.number}-${verification.year}`
  const config = workflowConfigs[client.workflow]

  return (
    <WorkflowChrome
      workflow={client.workflow}
      eyebrow="Step 5 · Submission confirmed"
      title="Your submission has been received"
      description="Schedio Group has logged the submission. Review any flagged items, then head to the dashboard to track approval."
      actions={
        <Link
          to="/dashboard"
          search={{
            client: client.id,
            verification: verification.id,
            libraryQuery: undefined,
            libraryOpen: undefined,
          }}
          className="wf-button-primary"
        >
          Continue to dashboard
          <ArrowRight className="size-4" />
        </Link>
      }
    >
      <section
        className="brand-panel overflow-hidden rounded-2xl p-6"
        style={{
          background:
            'linear-gradient(180deg, var(--wf-softer), rgba(255,255,255,0.98))',
          borderColor: 'var(--wf-border)',
        }}
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="inline-flex size-12 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--wf-base)',
                color: 'var(--color-brand-white)',
              }}
            >
              <CheckCircle2 className="size-6" />
            </span>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <VerificationPill
                  number={verification.number}
                  period={verification.period}
                />
                <span className="workflow-pill">{config.label}</span>
              </div>
              <p className="font-ops text-xl font-semibold tracking-[-0.02em] text-text-strong">
                Reference{' '}
                <span className="font-mono text-[color:var(--wf-strong)]">
                  {refNumber}
                </span>
              </p>
              <p className="text-sm text-text-muted">
                {client.name} · Submitted just now · Schedio PM will begin
                review shortly.
              </p>
              {classifiedFolder ? (
                <p className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-2.5 py-1 font-mono text-[0.72rem] text-text-muted"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  <FolderOpen className="size-3.5" aria-hidden />
                  Filed to Egnyte: <span className="text-text-strong">{classifiedFolder}</span>
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Documents"
            value={docs.length.toString()}
            tone="default"
          />
          <StatTile
            label="Flagged"
            value={flaggedCount.toString()}
            tone={flaggedCount > 0 ? 'alert' : 'default'}
          />
          <StatTile
            label="Document types"
            value={summaries.length.toString()}
            tone="default"
          />
          <StatTile label="Workflow" value={config.shortLabel} tone="default" />
        </dl>
      </section>

      <WorkflowBanner
        workflow={client.workflow}
        headline="What's included in this submission"
      >
        {summaries.map((s) => `${s.count} ${docTypeLabels[s.docType]}`).join(
          ' · ',
        )}
      </WorkflowBanner>

      {compareDoc ? (
        <CompareDuplicatePanel
          doc={compareDoc}
          clientId={client.id}
          verificationId={verification.id}
        />
      ) : flaggedDocs.length > 0 ? (
        <DuplicateAlertPanel
          flaggedDocs={flaggedDocs}
          clientId={client.id}
          verificationId={verification.id}
        />
      ) : null}

      {docs.some((d) => d.visualReviewUrl || d.fieldConfidence) ? (
        <VerificationEvidence
          docs={docs}
          lowConfidenceCount={lowConfidenceDocs.length}
        />
      ) : null}

      <section
        className="brand-panel overflow-hidden rounded-2xl p-5"
        style={{ borderColor: 'var(--color-border-base)' }}
      >
        <p className="ops-label m-0">Keep it moving</p>
        <p className="mt-1 text-sm text-text-muted">
          Head to the entity dashboard to review the full verification, the
          contract tracking table, and the searchable document library.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/dashboard"
            search={{
              client: client.id,
              verification: verification.id,
              libraryQuery: undefined,
              libraryOpen: undefined,
            }}
            className="wf-button-primary"
          >
            View dashboard
            <ArrowRight className="size-4" />
          </Link>
          <Link
            to="/upload"
            search={{ client: client.id, verification: verification.id }}
            className="wf-button-secondary"
          >
            Upload more documents
          </Link>
        </div>
      </section>
    </WorkflowChrome>
  )
}

function CompareDuplicatePanel({
  doc,
  clientId,
  verificationId,
}: {
  doc: Document
  clientId: string
  verificationId: string
}) {
  const matchedRef =
    doc.matchedVerificationRef ?? 'Previous verification reference'
  const matchedName = doc.matchedPreviousName ?? doc.originalName

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl"
      style={{ borderColor: 'var(--color-flag-panel-border)' }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{
          borderColor: 'var(--color-flag-panel-border)',
          background: 'var(--color-flag-panel-bg)',
        }}
      >
        <div>
          <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-flag-likely-text)]">
            Side-by-side compare
          </p>
          <h2 className="font-ops text-base font-semibold text-text-strong">
            Review this submission against its matched prior filing
          </h2>
        </div>
        <Link
          to="/confirmation"
          search={{
            client: clientId,
            verification: verificationId,
            compare: undefined,
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border bg-white px-3 text-xs font-semibold text-text-strong no-underline hover:bg-[color:var(--color-surface-muted)] unstyled-link"
          style={{ borderColor: 'var(--color-border-strong)' }}
        >
          <X className="size-4" />
          Close compare
        </Link>
      </header>

      <div className="grid gap-px bg-[color:var(--color-border-base)] md:grid-cols-2">
        <ComparePane
          heading="This submission"
          tone="current"
          docType={doc.docType}
          vendor={`${doc.vendorName} (${doc.vendor})`}
          originalName={doc.originalName}
          renamedName={doc.renamedName}
          verificationRef="This submission — not yet referenced"
          flag={doc.duplicateFlag}
        />
        <ComparePane
          heading="Matched prior filing"
          tone="prior"
          docType={doc.docType}
          vendor={`${doc.vendorName} (${doc.vendor})`}
          originalName={matchedName}
          renamedName={doc.renamedName}
          verificationRef={matchedRef}
          flag={doc.duplicateFlag}
        />
      </div>

      <footer
        className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4"
        style={{ borderColor: 'var(--color-flag-panel-border)' }}
      >
        <p className="inline-flex items-center gap-2 text-xs text-text-muted">
          <Lock className="size-3.5" />
          You can only remove the current submission. Prior filings are locked
          in Schedio Group's records.
        </p>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-text-strong hover:bg-[color:var(--color-surface-muted)]"
          style={{ borderColor: 'var(--color-border-strong)' }}
        >
          Remove current submission
        </button>
      </footer>
    </section>
  )
}

function ComparePane({
  heading,
  tone,
  docType,
  vendor,
  originalName,
  renamedName,
  verificationRef,
  flag,
}: {
  heading: string
  tone: 'current' | 'prior'
  docType: Document['docType']
  vendor: string
  originalName: string
  renamedName: string
  verificationRef: string
  flag: Document['duplicateFlag']
}) {
  return (
    <article
      className="space-y-3 bg-white px-5 py-4"
      style={
        tone === 'prior'
          ? { background: 'var(--color-surface-muted)' }
          : undefined
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-text-muted">
          {heading}
        </p>
        {tone === 'prior' ? (
          <span className="inline-flex items-center gap-1 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
            <Lock className="size-3" />
            Locked
          </span>
        ) : flag !== 'none' ? (
          <DuplicateFlagPill flag={flag} />
        ) : null}
      </div>

      <dl className="space-y-2.5 text-sm">
        <Field label="Document type" value={docTypeLabels[docType]} />
        <Field label="Vendor" value={vendor} />
        <Field label="Original file" value={originalName} mono />
        <Field label="Standardized name" value={renamedName} mono />
        <Field label="Verification ref" value={verificationRef} mono />
      </dl>
    </article>
  )
}

function Field({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="font-mono text-[0.64rem] font-semibold uppercase tracking-[0.1em] text-text-muted">
        {label}
      </dt>
      <dd
        className={
          mono
            ? 'break-words font-mono text-sm text-text-strong'
            : 'text-sm text-text-strong'
        }
      >
        {value}
      </dd>
    </div>
  )
}

function VerificationEvidence({
  docs,
  lowConfidenceCount,
}: {
  docs: ReadonlyArray<Document>
  lowConfidenceCount: number
}) {
  const evidenceDocs = docs.filter(
    (d) => d.visualReviewUrl || d.fieldConfidence,
  )
  if (evidenceDocs.length === 0) return null
  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border-base)' }}
      >
        <div>
          <p className="ops-label m-0">Verification evidence</p>
          <h2 className="font-ops text-base font-semibold text-text-strong">
            Visual review and per-field confidence from DocuPipe
          </h2>
        </div>
        {lowConfidenceCount > 0 ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
            style={{
              background: 'var(--color-flag-likely-bg)',
              color: 'var(--color-flag-likely-text)',
            }}
          >
            <AlertTriangle className="size-3.5" aria-hidden />
            {lowConfidenceCount} doc{lowConfidenceCount === 1 ? '' : 's'} below
            confidence threshold
          </span>
        ) : null}
      </header>
      <ul
        className="divide-y"
        style={{ borderColor: 'var(--color-border-base)' }}
      >
        {evidenceDocs.map((doc) => (
          <li key={doc.id} className="flex flex-col gap-3 px-5 py-4 md:flex-row">
            <div className="flex-shrink-0 md:w-40">
              {doc.visualReviewUrl ? (
                <a
                  href={doc.visualReviewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border bg-[color:var(--color-surface-muted)]"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  <img
                    src={doc.visualReviewUrl}
                    alt={`Visual review overlay for ${doc.originalName}`}
                    loading="lazy"
                    className="h-32 w-full object-cover"
                  />
                </a>
              ) : (
                <div
                  className="flex h-32 items-center justify-center rounded-lg border bg-[color:var(--color-surface-muted)] text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-text-muted"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  No visual review
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="truncate font-mono text-sm font-semibold text-text-strong">
                  {doc.renamedName || doc.originalName}
                </p>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-text-muted">
                  {docTypeLabels[doc.docType]} · {doc.vendorName}
                </p>
              </div>
              <ConfidenceChips fieldConfidence={doc.fieldConfidence} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ConfidenceChips({
  fieldConfidence,
}: {
  fieldConfidence: Record<string, number> | undefined
}) {
  if (!fieldConfidence || Object.keys(fieldConfidence).length === 0) {
    return (
      <p className="text-xs text-text-muted">
        No per-field confidence reported by DocuPipe.
      </p>
    )
  }
  const entries = Object.entries(fieldConfidence).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  return (
    <ul className="flex flex-wrap gap-1.5">
      {entries.map(([field, conf]) => {
        const low = conf < LOW_CONFIDENCE_UI_THRESHOLD
        return (
          <li
            key={field}
            className="inline-flex items-center gap-1 rounded-full border bg-white px-2.5 py-1 font-mono text-[0.68rem]"
            style={{
              borderColor: low
                ? 'var(--color-flag-panel-border)'
                : 'var(--color-border-base)',
              background: low ? 'var(--color-flag-likely-bg)' : undefined,
              color: low ? 'var(--color-flag-likely-text)' : undefined,
            }}
          >
            {low ? (
              <AlertTriangle className="size-3" aria-hidden />
            ) : (
              <CircleCheck className="size-3 text-text-muted" aria-hidden />
            )}
            <span className="uppercase tracking-[0.06em]">
              {field.replace(/_/g, ' ')}
            </span>
            <span className="text-text-muted">{Math.round(conf * 100)}%</span>
          </li>
        )
      })}
    </ul>
  )
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'default' | 'alert'
}) {
  const isAlert = tone === 'alert'
  return (
    <div
      className="rounded-xl border bg-white/95 px-4 py-3"
      style={{
        borderColor: isAlert
          ? 'var(--color-flag-panel-border)'
          : 'var(--color-border-base)',
        background: isAlert ? 'var(--color-flag-panel-bg)' : undefined,
      }}
    >
      <p
        className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.1em]"
        style={{
          color: isAlert ? 'var(--color-flag-likely-text)' : 'var(--color-text-muted)',
        }}
      >
        {label}
      </p>
      <p
        className="mt-0.5 font-ops text-lg font-semibold"
        style={{
          color: isAlert ? 'var(--color-flag-likely-text)' : 'var(--color-text-strong)',
        }}
      >
        {value}
      </p>
    </div>
  )
}
