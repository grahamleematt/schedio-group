import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  FileQuestion,
  UploadCloud,
} from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DocumentRow } from '#/components/sg-dream/DocumentRow'
import { IntakeProgressArc } from '#/components/sg-dream/IntakeProgressArc'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import {
  clients,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'
import { portalConfigQuery, verificationSnapshotQuery } from '#/lib/queries'
import { usePortalConfig } from '#/lib/session'
import type { StoredDocument } from '#/server/store'

type ProcessingSearch = {
  client: string
  verification: string
}

export const Route = createFileRoute('/processing')({
  validateSearch: (s: Record<string, unknown>): ProcessingSearch => ({
    client: typeof s.client === 'string' ? s.client : '',
    verification:
      typeof s.verification === 'string'
        ? s.verification
        : 'dawson-trails-md1-v1',
  }),
  loader: async ({ context, location }) => {
    const search = location.search as ProcessingSearch
    const knownClient = clients.find((c) => c.id === search.client)
    if (!knownClient) {
      throw redirect({ to: '/clients' })
    }
    const clientId = knownClient.id
    const { verifications } =
      await context.queryClient.ensureQueryData(portalConfigQuery())
    const requested =
      typeof search.verification === 'string' ? search.verification : ''
    const verification = getVerificationById(verifications, requested, clientId)
    if (!verification) {
      const open = getOpenVerification(verifications, clientId)
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

type StepState = 'idle' | 'running' | 'done' | 'paused' | 'error'
type Step = {
  label: string
  /** Compact chip label for the progress strip. */
  short: string
  detail: string
  state: StepState
}

const statusOrder: Record<string, number> = {
  queued: 0,
  classifying: 1,
  standardizing: 2,
  completed: 3,
  error: -1,
}

function maxStatusRank(docs: ReadonlyArray<StoredDocument>): number {
  let max = -1
  for (const d of docs) {
    const rank = statusOrder[d.status] ?? 0
    if (rank > max) max = rank
  }
  return max
}

function deriveSteps(docs: ReadonlyArray<StoredDocument>): ReadonlyArray<Step> {
  const total = docs.length
  if (total === 0) return []
  const maxRank = maxStatusRank(docs)
  const errored = docs.filter((d) => d.status === 'error').length
  const completed = docs.filter((d) => d.status === 'completed').length
  const classified = docs.filter(
    (d) => statusOrder[d.status] >= 1 || d.docType !== 'UNK',
  ).length
  const flaggedCount = docs.filter(
    (d) => d.duplicateFlag === 'exact' || d.duplicateFlag === 'likely',
  ).length
  const renamedCount = docs.filter((d) => Boolean(d.renamedName)).length
  // Sum only the claim amounts (invoices + pay-app current-payment-due) so the
  // "$X captured" figure matches the dashboard's "Costs submitted" definition.
  // Proofs of payment and change orders are deliberately excluded — including
  // them here would double-count claims and could even net negative on a
  // deductive CO.
  const capturedTotal = docs
    .filter((d) => d.docType === 'INV' || d.docType === 'PA')
    .map((d) => d.extractedFields?.amount ?? 0)
    .reduce((a, b) => a + b, 0)

  // Step 1 — Receiving (always considered done if at least one doc exists).
  const receiving: Step = {
    label: 'Receiving files',
    short: 'Received',
    detail: `${total} of ${total} documents received securely`,
    state: 'done',
  }

  // Step 2 — Apply SG DREAM naming convention. Marked done as soon as every
  // row has a renamed name; pre-extraction this stays pending.
  const naming: Step = {
    label: 'Applying naming convention',
    short: 'Named',
    detail: `${renamedCount} of ${total} documents renamed to standard filing names`,
    state:
      renamedCount === total ? 'done' : renamedCount > 0 ? 'running' : 'idle',
  }

  // Step 3 — Classification.
  const classifiedAll = docs.every(
    (d) => statusOrder[d.status] >= 2 || d.docType !== 'UNK',
  )
  const classification: Step = {
    label: 'Classifying document types',
    short: 'Classified',
    detail: `${classified} of ${total} documents typed (pay app, invoice, change order…)`,
    state: classifiedAll ? 'done' : maxRank >= 2 ? 'running' : 'idle',
  }

  // Step 4 — Extraction (standardization).
  const extractionRunning = docs.some((d) => d.status === 'standardizing')
  const inFlight = docs.filter((d) => d.status === 'standardizing').length
  const extraction: Step = {
    label: 'Extracting vendor and cost details',
    short: 'Extracted',
    detail:
      completed === total
        ? `${completed} of ${total} documents extracted${
            capturedTotal > 0
              ? ` · $${capturedTotal.toLocaleString()} captured`
              : ''
          }`
        : `${completed} of ${total} documents extracted${
            inFlight > 0 ? ` · ${inFlight} in progress` : ''
          }`,
    state:
      completed === total
        ? 'done'
        : extractionRunning
          ? 'running'
          : maxRank >= 2
            ? 'running'
            : 'idle',
  }

  // Step 5 — Duplicate check. Pauses when any flagged dupes are present.
  const duplicateState: StepState =
    completed === total ? (flaggedCount > 0 ? 'paused' : 'done') : 'idle'
  const duplicate: Step = {
    label: 'Checking against previously submitted documents',
    short: 'Duplicates',
    detail:
      flaggedCount > 0
        ? `${flaggedCount} of ${total} documents match a prior filing — review needed`
        : completed === total
          ? `${total} of ${total} documents checked · no matches to prior filings`
          : 'Documents are checked once vendor, number, amount, and date extract',
    state: duplicateState,
  }

  // Step 6 — Final assembly. Only completes once everything is done AND no
  // duplicates remain unresolved.
  const packageState: StepState =
    completed === total && flaggedCount === 0 ? 'done' : 'idle'
  const packageStep: Step = {
    label: 'Assembling submission package',
    short: 'Package',
    detail:
      completed === total
        ? flaggedCount > 0
          ? 'Held — duplicate decisions come before the reference is issued'
          : 'All documents packaged · reference issued, Schedio notified'
        : 'The package assembles once every document clears its checks',
    state: packageState,
  }

  if (errored > 0) {
    extraction.state = extraction.state === 'done' ? 'done' : 'error'
  }

  return [receiving, naming, classification, extraction, duplicate, packageStep]
}

function ProcessingPage() {
  const { client: clientId, verification: verificationId } = Route.useSearch()
  const config = usePortalConfig()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(config.verifications, verificationId, clientId) ??
    getOpenVerification(config.verifications, clientId)
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data
  const docs = snapshot?.verification.documents ?? []
  const displayDocs = storedListToDisplay(docs)
  const isEmpty = docs.length === 0
  const steps = deriveSteps(docs)
  const flaggedCount = docs.filter(
    (d) => d.duplicateFlag === 'exact' || d.duplicateFlag === 'likely',
  ).length
  const allCompleted =
    docs.length > 0 && docs.every((d) => d.status === 'completed')
  const anyError = docs.some((d) => d.status === 'error')
  const paused = allCompleted && flaggedCount > 0

  if (isEmpty) {
    return (
      <AppShell active="submit" crumbs={[{ label: 'Processing' }]}>
        <WorkflowBanner workflow={client.workflow} />
        <header className="mb-4">
          <IntakeProgressArc
            current="review"
            clientId={client.id}
            verificationId={verification.id}
            enabled={['upload']}
          />
          <h1 className="v2-h1">Nothing to analyze yet</h1>
        </header>
        <section className="v2-card">
          <div className="v2-card-body grid place-items-center gap-3 py-12 text-center">
            <span
              className="grid size-12 place-items-center rounded-2xl"
              style={{
                background: 'var(--wf-soft)',
                color: 'var(--wf-strong)',
              }}
              aria-hidden
            >
              <FileQuestion className="size-6" />
            </span>
            <p className="m-0 font-ops text-[15px] font-semibold text-ink">
              No documents queued for this submission
            </p>
            <p className="m-0 max-w-md text-[13px] text-muted-1">
              Upload one or more files to kick off classification, extraction,
              and duplicate detection.
            </p>
            <Link
              to="/upload"
              search={{ client: client.id, verification: verification.id }}
              className="v2-btn primary mt-2"
            >
              <UploadCloud className="size-4" />
              Upload documents
            </Link>
          </div>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell active="submit" crumbs={[{ label: 'Processing' }]}>
      <WorkflowBanner workflow={client.workflow} />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <IntakeProgressArc
            current="review"
            clientId={client.id}
            verificationId={verification.id}
            enabled={['upload', ...(allCompleted ? (['file'] as const) : [])]}
          />
          <h1 className="v2-h1">
            {allCompleted
              ? 'Analysis complete'
              : anyError
                ? 'Some documents need attention'
                : 'Checking submitted documents'}
          </h1>
          <p className="v2-lede">
            Schedio is identifying file types, extracting cost details, and
            comparing this submission against prior filings for {client.name}.
            Original filenames stay visible while standardized filing names are
            prepared.
          </p>
        </div>
        {allCompleted ? (
          <Link
            to="/confirmation"
            search={{ client: client.id, verification: verification.id }}
            className="v2-btn primary"
          >
            {paused ? 'Review flagged documents' : 'Continue to filing'}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </header>

      {paused ? (
        <div className="errbar amber mb-3" role="status">
          <span className="icn">!</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 font-semibold">
              Pipeline paused — {flaggedCount} duplicate{' '}
              {flaggedCount === 1 ? 'flag' : 'flags'} need review
            </p>
            <p className="m-0 text-[12.5px]">
              Review opens the duplicate evidence page. A submission reference
              is held until the flags are cleared by Schedio.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/confirmation"
              search={{ client: client.id, verification: verification.id }}
              className="v2-btn"
            >
              Review flagged
            </Link>
          </div>
        </div>
      ) : null}

      <ProgressStrip steps={steps} isStatic={allCompleted} />

      <section className="v2-card mt-4">
        <header className="v2-card-head">
          <h3>Documents · {docs.length} files</h3>
          <span className="sub">
            Select a document to see the extraction on the page it was read
            from, correct values, and finalize. Original upload names stay
            visible for auditability.
          </span>
        </header>
        <div>
          {displayDocs.map((doc) => (
            <DocumentRow
              key={doc.id}
              doc={doc}
              clientId={client.id}
              verificationId={verification.id}
            />
          ))}
        </div>
      </section>
    </AppShell>
  )
}

/**
 * Compact pipeline summary: one chip per check, expandable into the full
 * step-by-step log. Keeps the document list as the page's primary content
 * while live progress stays glanceable.
 */
function ProgressStrip({
  steps,
  isStatic,
}: {
  steps: ReadonlyArray<Step>
  isStatic: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const doneCount = steps.filter((s) => s.state === 'done').length
  return (
    <section className="v2-card">
      <button
        type="button"
        className="pstrip"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="pstrip-chips">
          {steps.map((step) => (
            <span key={step.short} className={stepPill(step.state)}>
              <span className="dot" />
              {step.short}
            </span>
          ))}
        </span>
        <span className="pstrip-meta">
          {doneCount} of {steps.length} checks complete
          {expanded ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
        </span>
      </button>
      {expanded ? (
        <ol className={`plog${isStatic ? ' is-static' : ''}`}>
          {steps.map((step, i) => (
            <PlogStep key={i} step={step} />
          ))}
        </ol>
      ) : null}
    </section>
  )
}

function stepPill(state: StepState): string {
  switch (state) {
    case 'done':
      return 'pill pill-green'
    case 'running':
    case 'paused':
      return 'pill pill-amber'
    case 'error':
      return 'pill pill-red'
    case 'idle':
      return 'pill pill-gray'
  }
}

function PlogStep({ step }: { step: Step }) {
  const tickClass =
    step.state === 'done'
      ? 'ptick'
      : step.state === 'paused'
        ? 'ptick amber'
        : step.state === 'error'
          ? 'ptick amber'
          : step.state === 'running'
            ? 'ptick amber'
            : 'ptick idle'
  const tickLabel =
    step.state === 'done'
      ? '✓'
      : step.state === 'paused'
        ? '||'
        : step.state === 'error'
          ? '!'
          : step.state === 'running'
            ? '…'
            : '·'
  const pillClass =
    step.state === 'done'
      ? 'pill pill-green'
      : step.state === 'paused'
        ? 'pill pill-amber'
        : step.state === 'error'
          ? 'pill pill-red'
          : step.state === 'running'
            ? 'pill pill-amber'
            : 'pill pill-gray'
  const pillLabel =
    step.state === 'done'
      ? 'Done'
      : step.state === 'paused'
        ? 'Paused'
        : step.state === 'error'
          ? 'Error'
          : step.state === 'running'
            ? 'Running'
            : 'Waiting'
  return (
    <li>
      <span className={tickClass} aria-hidden>
        {tickLabel}
      </span>
      <div className="min-w-0">
        <p className="t m-0">{step.label}</p>
        <p className="st m-0">{step.detail}</p>
      </div>
      <span className={pillClass}>
        <span className="dot" />
        {pillLabel}
      </span>
    </li>
  )
}
