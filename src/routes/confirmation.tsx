import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, FolderOpen } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DuplicateAlertPanel } from '#/components/sg-dream/DuplicateAlertPanel'
import {
  clients,
  displayRef,
  formatCurrency,
  getClientById,
  getOpenVerification,
  getVerificationById,
  summarizeDocTypes,
  workflowConfigs,
} from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'

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
    const requestedClient =
      typeof search.client === 'string' ? search.client : 'srcab'
    const knownClient = clients.find((c) => c.id === requestedClient)
    if (!knownClient) {
      const open = getOpenVerification('srcab')
      throw redirect({
        to: '/confirmation',
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

type AuditEvent = {
  ts: string
  label: string
  detail?: string
}

function timeOnly(iso: string | undefined): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Denver',
    }).format(d)
  } catch {
    return null
  }
}

function buildAuditTrail(input: {
  docs: ReturnType<typeof storedListToDisplay>
  flaggedCount: number
  ref: string
  reviewNeeded: boolean
}): ReadonlyArray<AuditEvent> {
  const { docs, flaggedCount, ref, reviewNeeded } = input
  const events: Array<AuditEvent> = []

  const uploadedAt = docs
    .map((d) => d.uploadedAt)
    .filter((s): s is string => Boolean(s))
    .sort()[0]
  const firstUploadTs = timeOnly(uploadedAt) ?? '—'

  events.push({
    ts: firstUploadTs,
    label: 'Files received',
    detail: `${docs.length}`,
  })

  if (docs.some((d) => d.docType !== 'UNK')) {
    events.push({
      ts: firstUploadTs,
      label: 'Classification complete',
    })
  }

  if (flaggedCount > 0) {
    events.push({
      ts: firstUploadTs,
      label: 'Duplicates flagged',
      detail: `${flaggedCount}`,
    })
  }

  if (reviewNeeded) {
    events.push({
      ts: firstUploadTs,
      label: 'Reference held for duplicate review',
      detail: ref,
    })
  } else {
    events.push({
      ts: firstUploadTs,
      label: 'Reference issued',
      detail: ref,
    })
  }

  if (docs.some((d) => d.egnyteClassifiedPath)) {
    events.push({
      ts: firstUploadTs,
      label: 'Filed to Egnyte',
    })
  }

  return events
}

function ConfirmationPage() {
  const { client: clientId, verification: verificationId } = Route.useSearch()
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
  const reviewNeeded = flaggedCount > 0

  const totalSubmitted = docs
    .filter((d) => d.docType === 'INV')
    .reduce((sum, d) => sum + d.amount, 0)

  const ref = displayRef({
    snapshotRef: snapshot?.verification.ref ?? null,
    client,
    verification,
  })
  const config = workflowConfigs[client.workflow]

  const classifiedFolder = (() => {
    const classified = docs.find((d) => d.egnyteClassifiedPath)
    if (!classified?.egnyteClassifiedPath) return undefined
    const parts = classified.egnyteClassifiedPath.split('/')
    return parts.slice(0, -2).join('/') + '/Classified/'
  })()

  const auditTrail = buildAuditTrail({ docs, flaggedCount, ref, reviewNeeded })

  const notifySubject = encodeURIComponent(
    reviewNeeded
      ? `Duplicate review needed for ${ref}`
      : `Submission summary for ${ref}`,
  )
  const notifyBody = encodeURIComponent(
    reviewNeeded
      ? `${flaggedCount} duplicate flag${
          flaggedCount === 1 ? '' : 's'
        } need review before acceptance.\n\n${flaggedDocs
          .map(
            (doc) =>
              `${doc.originalName} matched ${
                doc.matchedPreviousName ?? 'a prior filing'
              }`,
          )
          .join('\n')}`
      : `Submission ${ref} is ready for Schedio review.`,
  )

  const rail = (
    <>
      <section className="v2-card">
        <header className="v2-card-head">
          <h3>Audit trail</h3>
        </header>
        <div className="v2-card-body">
          <div className="text-[12px] leading-[1.6]">
            {auditTrail.map((e, i) => (
              <div
                key={`${e.label}-${i}`}
                className={
                  i < auditTrail.length - 1
                    ? 'border-line-2 border-b border-dashed py-1.5'
                    : 'py-1.5'
                }
              >
                <span className="mono text-[11px] text-muted-1">{e.ts}</span>
                {' · '}
                {e.label}
                {e.detail ? (
                  <>
                    {' '}
                    <span className="mono">{e.detail}</span>
                  </>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      {classifiedFolder ? (
        <section className="v2-card">
          <header className="v2-card-head">
            <h3>Egnyte location</h3>
          </header>
          <div className="v2-card-body">
            <p className="m-0 text-[12.5px] text-ink-2">
              <FolderOpen className="mr-1 inline size-3.5" aria-hidden />
              <span className="mono break-all">{classifiedFolder}</span>
            </p>
            <p className="text-muted-1 mt-2 m-0 text-[11.5px]">
              All standardized files were filed under this folder. Originals
              remain in the upload location.
            </p>
          </div>
        </section>
      ) : null}
    </>
  )

  return (
    <AppShell
      active="submit"
      crumbs={[{ label: 'Submitted' }]}
      rail={rail}
    >
      <header className="mb-3">
        <p className="v2-eyebrow">
          Touch Point 3 · {reviewNeeded ? 'Review needed' : 'Submitted'}
        </p>
        <h1 className="v2-h1">
          {reviewNeeded
            ? `V${verification.number} needs duplicate review`
            : `V${verification.number} is in Schedio's review queue`}
        </h1>
        <p className="v2-lede">
          {reviewNeeded
            ? 'The documents finished processing, but duplicate flags must be reviewed before this package is accepted into the submission queue.'
            : "Your submission has been accepted and assigned the reference below. Schedio's project manager reviews submissions within 3-5 business days of the cutoff."}
        </p>
      </header>

      <section className="confirm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="ops-label m-0 text-(--wf-ink)">
              {reviewNeeded ? 'Review reference' : 'Submission reference'}
            </p>
            <p className="ref-mono mt-1">{ref}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="pill pill-wf">
              <span className="dot" />
              {config.label}
            </span>
            <span className="chip mono">
              V{verification.number} · {verification.period}
            </span>
          </div>
        </div>

        <div
          className="v2-stats mt-4"
          style={{ borderColor: 'var(--wf-border)' }}
        >
          <div className="v2-stat">
            <div className="k">Files submitted</div>
            <div className="v">{docs.length}</div>
          </div>
          <div className="v2-stat">
            <div className="k">Doc types</div>
            <div className="v">{summaries.length}</div>
          </div>
          <div className="v2-stat">
            <div className="k">Invoice costs extracted</div>
            <div className="v mono">{formatCurrency(totalSubmitted)}</div>
          </div>
          <div className="v2-stat">
            <div className="k">Flagged</div>
            <div
              className="v"
              style={{
                color:
                  flaggedCount > 0
                    ? 'var(--color-amber-base)'
                    : 'var(--color-ink)',
              }}
            >
              {flaggedCount}
            </div>
          </div>
        </div>

        {classifiedFolder ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="pill pill-green">
              <span className="dot" />
              Filed to Egnyte · Classified/
            </span>
            <span className="chip mono break-all text-[11px]">
              {classifiedFolder}
            </span>
            <span className="pill pill-ink">
              DocuPipe · standardization.processed.success
            </span>
          </div>
        ) : null}

        {reviewNeeded ? (
          <div className="errbar amber mt-4" role="status">
            <span className="icn">!</span>
            <div className="min-w-0">
              <p className="m-0 font-semibold">
                Acceptance paused for duplicate review
              </p>
              <p className="m-0 text-[12.5px]">
                The field detector found exact or likely matches using vendor,
                document number, amount, and date. Review the items below
                before treating this package as submitted.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          <a
            href={`mailto:?subject=${notifySubject}&body=${notifyBody}`}
            className="v2-btn"
          >
            {reviewNeeded ? 'Email review note' : 'Email me this summary'}
          </a>
          <a
            href={`mailto:?subject=${notifySubject}&body=${notifyBody}`}
            className="v2-btn"
          >
            Notify Schedio PM
          </a>
          <Link
            to={reviewNeeded ? '/processing' : '/dashboard'}
            search={
              reviewNeeded
                ? { client: client.id, verification: verification.id }
                : {
                    client: client.id,
                    verification: verification.id,
                    libraryQuery: undefined,
                    libraryOpen: undefined,
                  }
            }
            className="v2-btn primary"
          >
            {reviewNeeded ? 'Back to processing' : 'Back to dashboard'}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {flaggedDocs.length > 0 ? (
        <div className="mt-4">
          <DuplicateAlertPanel
            flaggedDocs={flaggedDocs}
            clientId={client.id}
            verificationId={verification.id}
          />
        </div>
      ) : null}

      <section className="v2-card mt-4">
        <header className="v2-card-head">
          <h3>What happens next</h3>
        </header>
        <div className="v2-card-body">
          <ol className="v2-tl m-0 list-none p-0">
            <li className="step">
              <span className="n">Today</span>
              <h5>
                {reviewNeeded ? 'Duplicate review' : 'Confirmation emailed'}
              </h5>
              <p>
                {reviewNeeded
                  ? 'Schedio reviews the flagged matches and decides whether each document stays in the package.'
                  : 'You, the Schedio PM, and your Entity Owner receive the reference and this summary.'}
              </p>
            </li>
            <li className="step">
              <span className="n">Within 5 days</span>
              <h5>Schedio verifies</h5>
              <p>
                SG reviews invoices against contracts and posts verified
                amounts to your dashboard.
              </p>
            </li>
            <li className="step">
              <span className="n">Within 10 days</span>
              <h5>Funds released</h5>
              <p>
                Approved vendors receive direct payment per the program's
                disbursement policy.
              </p>
            </li>
          </ol>
        </div>
      </section>
    </AppShell>
  )
}
