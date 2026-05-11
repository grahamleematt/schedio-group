import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, FileQuestion, UploadCloud } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import {
  clients,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import type { StoredDocument } from '#/server/store'

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
    const requestedClient =
      typeof search.client === 'string' ? search.client : 'srcab'
    const knownClient = clients.find((c) => c.id === requestedClient)
    if (!knownClient) {
      const open = getOpenVerification('srcab')
      throw redirect({
        to: '/processing',
        search: { client: 'srcab', verification: open.id },
      })
    }
    const clientId = knownClient.id
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

type StepState = 'idle' | 'running' | 'done' | 'paused' | 'error'
type Step = {
  label: string
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
  const totalBytes = docs
    .map((d) => d.extractedFields?.amount ?? 0)
    .reduce((a, b) => a + b, 0)

  // Step 1 — Receiving (always considered done if at least one doc exists).
  const receiving: Step = {
    label: 'Receiving files',
    detail: `Secure upload received · ${total} / ${total} files`,
    state: 'done',
  }

  // Step 2 — Apply SG DREAM naming convention. Marked done as soon as every
  // row has a renamed name; pre-extraction this stays pending.
  const naming: Step = {
    label: 'Applying naming convention',
    detail: `Standard filing names prepared · ${renamedCount} / ${total}`,
    state:
      renamedCount === total
        ? 'done'
        : renamedCount > 0
          ? 'running'
          : 'idle',
  }

  // Step 3 — Classification.
  const classifiedAll = docs.every(
    (d) => statusOrder[d.status] >= 2 || d.docType !== 'UNK',
  )
  const classification: Step = {
    label: 'Classifying document types',
    detail: `Document types identified · ${classified} / ${total}`,
    state: classifiedAll ? 'done' : maxRank >= 2 ? 'running' : 'idle',
  }

  // Step 4 — Extraction (standardization).
  const extractionRunning = docs.some((d) => d.status === 'standardizing')
  const inFlight = docs.filter((d) => d.status === 'standardizing').length
  const extraction: Step = {
    label: 'Extracting vendor and cost details',
    detail:
      completed === total
        ? `${completed} / ${total} documents checked${
            totalBytes > 0
              ? ` · $${totalBytes.toLocaleString()} captured`
              : ''
          }`
        : `${completed} / ${total} documents checked${
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
    completed === total
      ? flaggedCount > 0
        ? 'paused'
        : 'done'
      : 'idle'
  const duplicate: Step = {
    label: 'Checking against previously submitted documents',
    detail:
      flaggedCount > 0
        ? `Matched against prior filings · ${flaggedCount} need review`
        : completed === total
          ? `Duplicate check complete · no exact or likely matches`
          : 'Duplicate check waits for vendor, document number, amount, and date',
    state: duplicateState,
  }

  // Step 6 — Final assembly. Only completes once everything is done AND no
  // duplicates remain unresolved.
  const packageState: StepState =
    completed === total && flaggedCount === 0 ? 'done' : 'idle'
  const packageStep: Step = {
    label: 'Assembling submission package',
    detail:
      completed === total
        ? flaggedCount > 0
          ? 'Awaiting duplicate decisions before issuing reference'
          : 'Reference number issued, Schedio notified'
        : 'Final reference waits for all documents and duplicate decisions',
    state: packageState,
  }

  if (errored > 0) {
    extraction.state = extraction.state === 'done' ? 'done' : 'error'
  }

  return [
    receiving,
    naming,
    classification,
    extraction,
    duplicate,
    packageStep,
  ]
}

function statusPill(status: StoredDocument['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', cls: 'pill pill-green' }
    case 'standardizing':
      return { label: 'Extracting', cls: 'pill pill-brand' }
    case 'classifying':
      return { label: 'Classifying', cls: 'pill pill-brand' }
    case 'queued':
      return { label: 'Queued', cls: 'pill pill-gray' }
    case 'error':
      return { label: 'Needs review', cls: 'pill pill-red' }
  }
}

function duplicateCheckPill(doc: StoredDocument) {
  switch (doc.duplicateFlag) {
    case 'exact':
      return { label: 'Exact match', cls: 'pill pill-red' }
    case 'likely':
      return { label: 'Likely match', cls: 'pill pill-amber' }
    case 'none':
      return { label: 'No match', cls: 'pill pill-green' }
  }
}

function filedStatusPill(custody: StoredDocument['custodyState']) {
  switch (custody) {
    case 'classified':
    case 'relied':
    case 'locked':
      return { label: 'Filed', cls: 'pill pill-green' }
    case 'processing':
      return { label: 'Filing', cls: 'pill pill-amber' }
    case 'incoming':
      return { label: 'Received', cls: 'pill pill-brand' }
    default:
      return { label: 'Pending', cls: 'pill pill-gray' }
  }
}

function ProcessingPage() {
  const { client: clientId, verification: verificationId } = Route.useSearch()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(verificationId, clientId) ??
    getOpenVerification(clientId)
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data
  const docs = snapshot?.verification.documents ?? []
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
        <header className="mb-4">
          <p className="v2-eyebrow">Step 4 · Analyzing documents</p>
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
              No documents queued for V{verification.number}
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
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="v2-eyebrow">Step 4 · Analyzing documents</p>
          <h1 className="v2-h1">
            {allCompleted
              ? 'Analysis complete'
              : 'Checking submitted documents'}
          </h1>
          <p className="v2-lede">
            Schedio is identifying file types, extracting cost details, and
            comparing this submission against prior filings for {client.name}.
            Original filenames stay visible while standardized filing names are
            prepared.
          </p>
        </div>
        {allCompleted && !paused ? (
          <Link
            to="/confirmation"
            search={{ client: client.id, verification: verification.id }}
            className="v2-btn primary"
          >
            View confirmation
            <ArrowRight className="size-4" />
          </Link>
        ) : paused ? (
          <Link
            to="/confirmation"
            search={{ client: client.id, verification: verification.id }}
            className="v2-btn primary"
          >
            Review flagged documents
            <ArrowRight className="size-4" />
          </Link>
        ) : (
          <button type="button" className="v2-btn primary" disabled>
            {anyError ? 'Check errors below' : 'Processing documents'}
            <ArrowRight className="size-4" />
          </button>
        )}
      </header>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="chip mono">Secure upload received</span>
        <span className="chip mono">Document classification</span>
        <span className="chip mono">Duplicate check</span>
        <span className="pill pill-green">
          <span className="dot" />
          Original filenames preserved
        </span>
      </div>

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

      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Review checks · {docs.length} files</h3>
          <span className="sub">
            Each step updates as submitted documents move toward review.
          </span>
        </header>
        <ol className="plog">
          {steps.map((step, i) => (
            <PlogStep key={i} step={step} />
          ))}
        </ol>
      </section>

      <section className="v2-card mt-4">
        <header className="v2-card-head">
          <h3>Per-document status</h3>
          <span className="sub">
            Original upload names stay visible for auditability.
          </span>
        </header>
        <div className="v2-table-scroll">
          <table className="v2-tbl">
            <thead>
              <tr>
                <th>Original file</th>
                <th>Document type</th>
                <th>Processing status</th>
                <th>Duplicate check</th>
                <th>Filed status</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc) => {
                const status = statusPill(doc.status)
                const duplicate = duplicateCheckPill(doc)
                const filed = filedStatusPill(doc.custodyState)
                return (
                  <tr key={doc.id}>
                    <td className="mono break-all text-[11.5px]">
                      {doc.originalName}
                    </td>
                    <td>
                      <span className="pill pill-ink">{doc.docType}</span>
                    </td>
                    <td>
                      <span className={status.cls}>
                        <span className="dot" />
                        {status.label}
                      </span>
                    </td>
                    <td>
                      <span className={duplicate.cls}>
                        <span className="dot" />
                        {duplicate.label}
                      </span>
                    </td>
                    <td>
                      <span className={filed.cls}>
                        <span className="dot" />
                        {filed.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  )
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
