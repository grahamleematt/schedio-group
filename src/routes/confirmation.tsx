import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { ArrowRight, FolderOpen, Loader2, UploadCloud } from 'lucide-react'
import { AppShell } from '#/components/sg-dream/AppShell'
import { DuplicateAlertPanel } from '#/components/sg-dream/DuplicateAlertPanel'
import { FinalizeSubmissionPanel } from '#/components/sg-dream/FinalizeSubmissionPanel'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import {
  clients,
  displayRef,
  displaySubmissionCycle,
  docTypeLabels,
  docTypeOrder,
  formatCurrency,
  formatCurrencyPrecise,
  getClientById,
  getOpenVerification,
  getVerificationById,
  summarizeDocTypes,
  workflowConfigs,
} from '#/lib/sg-dream'
import { portalConfigQuery, verificationSnapshotQuery } from '#/lib/queries'
import { usePortalConfig } from '#/lib/session'
import { storedListToDisplay } from '#/lib/sg-dream-adapter'
import { fileSubmissionToEgnyte } from '#/server/fns/fileSubmission'
import type { DreamSnapshot } from '#/server/store'

type ConfirmationSearch = {
  client: string
  verification: string
  compare?: string
}

export const Route = createFileRoute('/confirmation')({
  validateSearch: (s: Record<string, unknown>): ConfirmationSearch => ({
    client: typeof s.client === 'string' ? s.client : '',
    verification:
      typeof s.verification === 'string'
        ? s.verification
        : 'dawson-trails-md1-v1',
    compare:
      typeof s.compare === 'string' && s.compare.length > 0
        ? s.compare
        : undefined,
  }),
  loader: async ({ context, location }) => {
    const search = location.search as ConfirmationSearch
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
  const portalConfig = usePortalConfig()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(portalConfig.verifications, verificationId, clientId) ??
    getOpenVerification(portalConfig.verifications, clientId)
  const queryClient = useQueryClient()
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data
  const snapshotKey = verificationSnapshotQuery(verification.id).queryKey

  const fileMut = useMutation({
    mutationFn: () =>
      fileSubmissionToEgnyte({ data: { verificationId: verification.id } }),
    onSuccess: (next: DreamSnapshot | null) => {
      queryClient.setQueryData(snapshotKey, next)
    },
  })

  const storedDocs = snapshot?.verification.documents ?? []
  const docs = storedListToDisplay(storedDocs)
  const readyDocs = docs.filter((d) => d.custodyState === 'ready')
  const filedCount = docs.filter((d) => Boolean(d.egnyteClassifiedPath)).length
  const summaries = summarizeDocTypes(docs).filter((s) => s.count > 0)
  const flaggedDocs = docs.filter((d) => d.duplicateFlag !== 'none')
  const flaggedCount = flaggedDocs.length
  const reviewNeeded = flaggedCount > 0

  // Claim value submitted this period = invoices + pay-app current payment due.
  // POPs / lien waivers evidence the same dollars and contracts are
  // authorization, so they're excluded to avoid double-counting.
  const totalSubmitted = docs
    .filter((d) => d.docType === 'INV' || d.docType === 'PA')
    .reduce((sum, d) => sum + d.amount, 0)

  const ref = displayRef({
    snapshotRef: snapshot?.verification.ref ?? null,
    client,
    verification,
  })
  const config = workflowConfigs[client.workflow]
  const reviewCycle = displaySubmissionCycle(verification)

  // Destination root (`…/Classified/`) for the submission, derived from a
  // filed path when available, otherwise the planned path computed at
  // analysis. Drives both the pre-filing preview and the post-filing chip.
  const destinationRoot = (() => {
    const sample =
      docs.find((d) => d.egnyteClassifiedPath)?.egnyteClassifiedPath ??
      docs.find((d) => d.egnytePlannedPath)?.egnytePlannedPath
    if (!sample) return undefined
    const parts = sample.split('/')
    const idx = parts.lastIndexOf('Classified')
    return idx >= 0
      ? `${parts.slice(0, idx + 1).join('/')}/`
      : `${parts.slice(0, -1).join('/')}/`
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

      {destinationRoot ? (
        <section className="v2-card">
          <header className="v2-card-head">
            <h3>Egnyte location</h3>
          </header>
          <div className="v2-card-body">
            <p className="m-0 text-[12.5px] text-ink-2">
              <FolderOpen className="mr-1 inline size-3.5" aria-hidden />
              <span className="mono break-all">{destinationRoot}</span>
            </p>
            <p className="text-muted-1 mt-2 m-0 text-[11.5px]">
              {readyDocs.length > 0
                ? 'Standardized files will be filed under this folder once you file the submission. Originals remain in the upload location.'
                : 'All standardized files were filed under this folder. Originals remain in the upload location.'}
            </p>
          </div>
        </section>
      ) : null}
    </>
  )

  return (
    <AppShell active="submit" crumbs={[{ label: 'Submitted' }]} rail={rail}>
      <WorkflowBanner workflow={client.workflow} />
      <header className="mb-3">
        <p className="v2-eyebrow">
          Touch Point 3 · {reviewNeeded ? 'Review needed' : 'Submitted'}
        </p>
        <h1 className="v2-h1">
          {reviewNeeded
            ? 'Submission needs duplicate review'
            : "Submission is in Schedio's review queue"}
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
            <p className="ops-label m-0">
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
              {reviewNeeded ? 'Review held' : 'Reference issued'} ·{' '}
              {reviewCycle}
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
            <div className="k">Costs submitted</div>
            <div className="v mono">{formatCurrency(totalSubmitted)}</div>
            <div className="d">Invoices + pay applications only</div>
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

        {readyDocs.length > 0 ? (
          <div
            className="mt-4 rounded-xl border p-4"
            style={{
              borderColor: 'var(--wf-border)',
              background: 'var(--wf-softer, var(--color-surface-muted))',
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 flex items-center gap-2 font-ops text-sm font-semibold text-text-strong">
                  <UploadCloud
                    className="size-4"
                    style={{ color: 'var(--wf-strong)' }}
                    aria-hidden
                  />
                  {portalConfig.egnyteExportEnabled
                    ? `File ${readyDocs.length} document${readyDocs.length === 1 ? '' : 's'} to Egnyte`
                    : `Approve ${readyDocs.length} document${readyDocs.length === 1 ? '' : 's'}`}
                </p>
                <p className="text-muted-1 m-0 mt-1 text-[12.5px]">
                  {portalConfig.egnyteExportEnabled
                    ? 'Review looks good? File the standardized copies into Egnyte. Originals stay in the upload location.'
                    : 'Review looks good? Approve the standardized copies. Egnyte filing is paused right now — copies will move into Egnyte once storage is restored.'}
                </p>
                {destinationRoot ? (
                  <p className="m-0 mt-2 text-[11.5px] text-ink-2">
                    <FolderOpen className="mr-1 inline size-3.5" aria-hidden />
                    <span className="mono break-all">{destinationRoot}</span>
                  </p>
                ) : null}
                {fileMut.isError ? (
                  <p
                    className="m-0 mt-2 text-[12.5px] text-destructive"
                    role="alert"
                  >
                    Filing didn’t complete. Some documents may still be pending
                    — try again.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="v2-btn primary shrink-0"
                disabled={fileMut.isPending}
                onClick={() => fileMut.mutate()}
              >
                {fileMut.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <UploadCloud className="size-4" aria-hidden />
                )}
                {fileMut.isPending
                  ? portalConfig.egnyteExportEnabled
                    ? 'Filing…'
                    : 'Approving…'
                  : portalConfig.egnyteExportEnabled
                    ? 'File to Egnyte'
                    : 'Approve documents'}
              </button>
            </div>
          </div>
        ) : filedCount > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="pill pill-green">
              <span className="dot" />
              {portalConfig.egnyteExportEnabled
                ? 'Filed to Egnyte'
                : 'Approved (Egnyte filing paused)'}{' '}
              · {filedCount} document
              {filedCount === 1 ? '' : 's'}
            </span>
            {destinationRoot ? (
              <span className="chip mono break-all text-[11px]">
                {destinationRoot}
              </span>
            ) : null}
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
                document number, amount, and date. Review the items below before
                treating this package as submitted.
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
                : { client: client.id, verification: verification.id }
            }
            className="v2-btn primary"
          >
            {reviewNeeded ? 'Back to processing' : 'Back to dashboard'}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {!reviewNeeded ? (
        <div className="mt-4">
          <FinalizeSubmissionPanel verification={verification} docs={docs} />
        </div>
      ) : null}

      <section className="v2-card mt-4">
        <header className="v2-card-head flex items-center justify-between gap-3">
          <h3>Submitted documents</h3>
          <Link
            to="/library"
            search={{ client: client.id, verification: verification.id }}
            className="text-xs font-semibold text-text-muted underline-offset-4 hover:text-text-strong hover:underline"
          >
            Open library
          </Link>
        </header>
        <div className="v2-card-body p-0">
          {docTypeOrder
            .map((t) => ({
              type: t,
              items: docs.filter((d) => d.docType === t),
            }))
            .filter((g) => g.items.length > 0)
            .map((group) => {
              const subtotal = group.items.reduce((sum, d) => sum + d.amount, 0)
              // Only claim documents (invoices + pay apps) feed the "Costs
              // submitted" figure — contracts / task orders / change orders
              // are authorization value, so their subtotals are labeled as
              // reference-only to prevent the double-count misread.
              const counted = group.type === 'INV' || group.type === 'PA'
              return (
                <div key={group.type}>
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-2"
                    style={{ background: 'var(--color-surface-muted)' }}
                  >
                    <span className="ops-label m-0">
                      {docTypeLabels[group.type]} · {group.items.length}
                    </span>
                    {subtotal > 0 ? (
                      <span className="mono text-[12px] text-muted-1">
                        {formatCurrencyPrecise(subtotal)}
                        <span className="ml-2 font-sans text-[10.5px] font-semibold uppercase tracking-[0.05em] opacity-80">
                          {counted
                            ? 'in costs submitted'
                            : 'authorization · not counted'}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  {group.items.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 border-b px-4 py-2.5 last:border-b-0"
                      style={{ borderColor: 'var(--color-line-2)' }}
                    >
                      <div className="min-w-0">
                        <p className="m-0 truncate font-mono text-[12.5px] font-semibold text-ink">
                          {doc.renamedName}
                        </p>
                        <p className="text-muted-1 m-0 truncate text-[11.5px]">
                          {doc.vendorName}
                          {doc.extractedFields?.documentNumber
                            ? ` · #${doc.extractedFields.documentNumber}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {doc.duplicateFlag !== 'none' ? (
                          <span
                            className={`pill ${doc.duplicateFlag === 'exact' ? 'pill-red' : 'pill-amber'}`}
                          >
                            {doc.duplicateFlag === 'exact'
                              ? 'Exact match'
                              : 'Likely match'}
                          </span>
                        ) : null}
                        {doc.lowConfidence ? (
                          <span className="pill pill-amber">
                            Low confidence
                          </span>
                        ) : null}
                        <span className="mono w-[88px] text-right text-[12.5px] text-ink">
                          {doc.amount > 0
                            ? formatCurrencyPrecise(doc.amount)
                            : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
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
            {client.workflow === 'developer_reimb' ? (
              <>
                <li className="step">
                  <span className="n">Within 7 days</span>
                  <h5>Public cost review</h5>
                  <p>
                    SG verifies costs against contracts and task orders and
                    issues an Engineer's Report for the district.
                  </p>
                </li>
                <li className="step">
                  <span className="n">After the report</span>
                  <h5>District reimbursement</h5>
                  <p>
                    SG forwards the approved amount to the district for public
                    reimbursement processing.
                  </p>
                </li>
              </>
            ) : (
              <>
                <li className="step">
                  <span className="n">Within 5 days</span>
                  <h5>Schedio verifies</h5>
                  <p>
                    SG reviews pay apps and invoices against contracts and posts
                    verified amounts to your dashboard.
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
              </>
            )}
          </ol>
        </div>
      </section>
    </AppShell>
  )
}
