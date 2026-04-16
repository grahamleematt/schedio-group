import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Lock, X } from 'lucide-react'
import { WorkflowChrome } from '#/components/sg-dream/WorkflowChrome'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { VerificationPill } from '#/components/sg-dream/VerificationPill'
import { DuplicateAlertPanel } from '#/components/sg-dream/DuplicateAlertPanel'
import { DuplicateFlagPill } from '#/components/sg-dream/DuplicateFlag'
import {
  docTypeLabels,
  formatRef,
  getClientById,
  getDocumentById,
  getDocumentsByVerification,
  getVerificationById,
  summarizeDocTypes,
  workflowConfigs,
} from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'

type ConfirmationSearch = {
  client: string
  verification: string
  dupes: number
  compare?: string
}

export const Route = createFileRoute('/confirmation')({
  validateSearch: (s: Record<string, unknown>): ConfirmationSearch => ({
    client: typeof s.client === 'string' ? s.client : 'srcab',
    verification:
      typeof s.verification === 'string' ? s.verification : 'srcab-v4',
    dupes:
      typeof s.dupes === 'number'
        ? s.dupes
        : Number.parseInt(String(s.dupes ?? '0'), 10) || 0,
    compare:
      typeof s.compare === 'string' && s.compare.length > 0
        ? s.compare
        : undefined,
  }),
  head: () => ({ meta: [{ title: 'Submission confirmed | SG DREAM' }] }),
  component: ConfirmationPage,
})

function ConfirmationPage() {
  const {
    client: clientId,
    verification: verificationId,
    dupes,
    compare,
  } = Route.useSearch()
  const client = getClientById(clientId)
  const verification = getVerificationById(verificationId)
  const docs = getDocumentsByVerification(verification.id)
  const summaries = summarizeDocTypes(docs).filter((s) => s.count > 0)
  const flaggedDocs =
    dupes > 0 ? docs.filter((d) => d.duplicateFlag !== 'none') : []
  const compareDoc = compare ? getDocumentById(compare) : undefined

  const refNumber = formatRef({
    workflow: client.workflow,
    number: verification.number,
    year: verification.year,
    seq: verification.seq,
  })

  const config = workflowConfigs[client.workflow]

  return (
    <WorkflowChrome
      workflow={client.workflow}
      entityName={client.name}
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
            value={dupes.toString()}
            tone={dupes > 0 ? 'alert' : 'default'}
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
          dupes={dupes}
        />
      ) : flaggedDocs.length > 0 ? (
        <DuplicateAlertPanel
          flaggedDocs={flaggedDocs}
          clientId={client.id}
          verificationId={verification.id}
          dupes={dupes}
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
            search={{
              client: client.id,
              verification: verification.id,
              clean: undefined,
            }}
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
  dupes,
}: {
  doc: Document
  clientId: string
  verificationId: string
  dupes: number
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
            dupes,
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
