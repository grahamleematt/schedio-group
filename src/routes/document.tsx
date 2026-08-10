/**
 * Document detail route — the single review surface for one document.
 *
 * Replaces the extraction overlay modal: the PDF with DocuPipe bounding
 * boxes, the editable field rail, the extracted record (facts, pay-app
 * waterfall, line items), and the Finalize/Reject actions all live on one
 * URL-addressable page. The processing list links here per document.
 */

import { Suspense, lazy, useState } from 'react'
import {
  ClientOnly,
  Link,
  createFileRoute,
  redirect,
  useBlocker,
} from '@tanstack/react-router'
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  MoreHorizontal,
  PictureInPicture2,
  RefreshCw,
  Redo2,
  ScanSearch,
  Undo2,
} from 'lucide-react'

import { AppShell } from '#/components/sg-dream/AppShell'
import { WorkflowBanner } from '#/components/sg-dream/WorkflowBanner'
import { ExtractedRecord } from '#/components/sg-dream/ExtractedDetail'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import {
  clients,
  formatCurrencyPrecise,
  getClientById,
  getOpenVerification,
  getVerificationById,
} from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { storedToDisplay } from '#/lib/sg-dream-adapter'
import {
  extractionOverlayQuery,
  portalConfigQuery,
  verificationSnapshotQuery,
} from '#/lib/queries'
import { usePortalConfig } from '#/lib/session'
import { parseEdit, rawFieldValue } from '#/lib/review-edits'
import { submitReviewCorrections } from '#/server/fns/reviewCorrections'
import type { ReviewCorrectionsResult } from '#/server/fns/reviewCorrections'
import { generateVisualReview } from '#/server/fns/visualReview'
import { rerunExtraction } from '#/server/fns/rerunExtraction'
import type { RerunExtractionResult } from '#/server/fns/rerunExtraction'
import type { ExtractionOverlayField } from '#/server/fns/extractionOverlay'
import type { ReviewBoxEdit, ReviewEdit } from '#/server/docupipe'
import type { NormalizedRect } from '#/lib/overlay-geometry'
import type { DreamSnapshot, ReviewState } from '#/server/store'

const ExtractionOverlayViewer = lazy(
  () => import('#/components/sg-dream/ExtractionOverlayViewer'),
)

/**
 * `pane` renders a chrome-less pop-out of one half of the review surface —
 * `doc` (PDF + field rail + Finalize) or `record` (extracted record with
 * the line-item table) — so a reviewer can put each on its own monitor.
 */
type DocumentPane = 'doc' | 'record'

type DocumentSearch = {
  client: string
  verification: string
  doc: string
  pane?: DocumentPane
}

export const Route = createFileRoute('/document')({
  validateSearch: (s: Record<string, unknown>): DocumentSearch => ({
    client: typeof s.client === 'string' ? s.client : '',
    verification:
      typeof s.verification === 'string'
        ? s.verification
        : 'dawson-trails-md1-v1',
    doc: typeof s.doc === 'string' ? s.doc : '',
    ...(s.pane === 'doc' || s.pane === 'record'
      ? { pane: s.pane as DocumentPane }
      : {}),
  }),
  loader: async ({ context, location }) => {
    const search = location.search as DocumentSearch
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
    const snapshot = await context.queryClient.ensureQueryData(
      verificationSnapshotQuery(verification.id),
    )
    const exists = snapshot?.verification.documents.some(
      (d) => d.id === search.doc,
    )
    if (!exists) {
      throw redirect({
        to: '/processing',
        search: { client: clientId, verification: verification.id },
      })
    }
    return snapshot
  },
  head: () => ({ meta: [{ title: 'Document review | SG DREAM' }] }),
  component: DocumentDetailPage,
})

function hostedViewerHref(reviewId: string): string {
  return `/api/docupipe/review-url?review=${encodeURIComponent(reviewId)}`
}

function statusPill(status: Document['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', cls: 'pill pill-green' }
    case 'standardizing':
      return { label: 'Extracting', cls: 'pill pill-brand' }
    case 'classifying':
      return { label: 'Classifying', cls: 'pill pill-brand' }
    case 'error':
      return { label: 'Needs review', cls: 'pill pill-red' }
    default:
      return { label: 'Queued', cls: 'pill pill-gray' }
  }
}

function ReviewStatePill({ state }: { state: ReviewState | undefined }) {
  if (state === 'verified') {
    return (
      <span className="pill pill-green">
        <span className="dot" />
        Verified
      </span>
    )
  }
  if (state === 'rejected') {
    return (
      <span className="pill pill-red">
        <span className="dot" />
        Rejected
      </span>
    )
  }
  return <span className="pill pill-gray">Awaiting review</span>
}

function DocumentDetailPage() {
  const {
    client: clientId,
    verification: verificationId,
    doc: docId,
    pane,
  } = Route.useSearch()
  const config = usePortalConfig()
  const client = getClientById(clientId)
  const verification =
    getVerificationById(config.verifications, verificationId, clientId) ??
    getOpenVerification(config.verifications, clientId)
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(verification.id),
  )
  const snapshot = snapshotQuery.data
  const stored = snapshot?.verification.documents.find((d) => d.id === docId)
  const doc = stored ? storedToDisplay(stored) : null

  const queryClient = useQueryClient()

  // Pending corrections keyed by field path; values are the raw input text.
  const [edits, setEdits] = useState<Record<string, string>>({})
  // Pending box repositions keyed by field path (base page orientation).
  const [boxEdits, setBoxEdits] = useState<Record<string, NormalizedRect>>({})
  // Undo/redo stacks of past/future boxEdits snapshots — every drag, resize,
  // or reset lands here so a stray box move is one visible click to unwind.
  const [boxPast, setBoxPast] = useState<
    Array<Record<string, NormalizedRect>>
  >([])
  const [boxFuture, setBoxFuture] = useState<
    Array<Record<string, NormalizedRect>>
  >([])
  // Reject pressed while corrections are pending — ask before discarding.
  const [confirmReject, setConfirmReject] = useState(false)

  const applyBoxEdits = (next: Record<string, NormalizedRect>) => {
    setBoxPast((past) => [...past, boxEdits])
    setBoxFuture([])
    setBoxEdits(next)
  }
  const undoBoxEdit = () => {
    if (boxPast.length === 0) return
    const prev = boxPast[boxPast.length - 1]
    setBoxPast((past) => past.slice(0, -1))
    setBoxFuture((future) => [...future, boxEdits])
    setBoxEdits(prev)
  }
  const redoBoxEdit = () => {
    if (boxFuture.length === 0) return
    const next = boxFuture[boxFuture.length - 1]
    setBoxFuture((future) => future.slice(0, -1))
    setBoxPast((past) => [...past, boxEdits])
    setBoxEdits(next)
  }
  const clearCorrections = () => {
    setEdits({})
    setBoxEdits({})
    setBoxPast([])
    setBoxFuture([])
  }

  const pendingCount = Object.keys(edits).length + Object.keys(boxEdits).length
  const blocker = useBlocker({
    shouldBlockFn: () => pendingCount > 0,
    withResolver: true,
    enableBeforeUnload: () => pendingCount > 0,
  })

  const hasReview = Boolean(doc?.docupipeReviewId)
  const overlayQuery = useQuery({
    ...extractionOverlayQuery(verification.id, docId),
    enabled: hasReview,
  })
  const overlay = overlayQuery.data

  const correctionsMut = useMutation({
    mutationFn: (input: {
      action: 'verify' | 'reject'
      edits?: Array<ReviewEdit>
      boxEdits?: Array<ReviewBoxEdit>
    }) =>
      submitReviewCorrections({
        data: { verificationId: verification.id, documentId: docId, ...input },
      }),
    onSuccess: (result: ReviewCorrectionsResult) => {
      if (result.snapshot) {
        queryClient.setQueryData(
          verificationSnapshotQuery(verification.id).queryKey,
          result.snapshot,
        )
      }
      void queryClient.invalidateQueries({
        queryKey: extractionOverlayQuery(verification.id, docId).queryKey,
      })
      if (result.ok) {
        clearCorrections()
      }
    },
  })

  const genMut = useMutation({
    mutationFn: () =>
      generateVisualReview({
        data: { verificationId: verification.id, documentId: docId },
      }),
    onSuccess: (next: DreamSnapshot | null) => {
      queryClient.setQueryData(
        verificationSnapshotQuery(verification.id).queryKey,
        next,
      )
    },
  })

  const rerunMut = useMutation({
    mutationFn: () =>
      rerunExtraction({
        data: { verificationId: verification.id, documentId: docId },
      }),
    onSuccess: (result: RerunExtractionResult) => {
      if (result.snapshot) {
        queryClient.setQueryData(
          verificationSnapshotQuery(verification.id).queryKey,
          result.snapshot,
        )
      }
    },
  })

  if (!doc) {
    // Deleted (or cleared) while the page was open — loader handles fresh loads.
    return (
      <AppShell active="submit" crumbs={[{ label: 'Processing' }]}>
        <WorkflowBanner workflow={client.workflow} />
        <section className="v2-card">
          <div className="v2-card-body grid place-items-center gap-3 py-12 text-center">
            <p className="m-0 font-ops text-[15px] font-semibold text-ink">
              This document is no longer part of the submission
            </p>
            <Link
              to="/processing"
              search={{ client: client.id, verification: verification.id }}
              className="v2-btn primary"
            >
              <ArrowLeft className="size-4" />
              Back to processing
            </Link>
          </div>
        </section>
      </AppShell>
    )
  }

  const status = statusPill(doc.status)
  const dupClass =
    doc.duplicateFlag === 'exact'
      ? 'pill-red'
      : doc.duplicateFlag === 'likely'
        ? 'pill-amber'
        : null
  const hasStandardizedName = doc.renamedName !== doc.originalName
  const displayName = hasStandardizedName ? doc.renamedName : doc.originalName
  const inFlight =
    doc.status === 'queued' ||
    doc.status === 'classifying' ||
    doc.status === 'standardizing'

  const canGenerate = !hasReview && doc.status === 'completed'
  // A no-op success (no standardization to base a review on) leaves the row
  // without a review ID — surface that rather than spinning forever.
  const generateUnavailable = genMut.isSuccess && !hasReview
  const canRerun = doc.status === 'completed' || doc.status === 'error'
  const rerunFailed =
    rerunMut.isError || (rerunMut.isSuccess && !rerunMut.data.ok)

  const fieldsByPath = new Map(
    (overlay?.fields ?? []).map((f) => [f.path, f] as const),
  )
  // Split pending inputs into submittable edits and inline validation errors
  // — an unparseable amount blocks Finalize instead of silently becoming a
  // string on the DocuPipe review.
  const dirtyEdits: Array<ReviewEdit> = []
  const editErrors: Record<string, string> = {}
  for (const [path, raw] of Object.entries(edits)) {
    const field = fieldsByPath.get(path)
    if (!field) continue
    const parsed = parseEdit(field, raw)
    if (parsed.ok) dirtyEdits.push(parsed.edit)
    else editErrors[path] = parsed.message
  }
  const errorCount = Object.keys(editErrors).length
  const dirtyBoxEdits: Array<ReviewBoxEdit> = Object.entries(boxEdits)
    .map(([path, rect]): ReviewBoxEdit | null => {
      const field = fieldsByPath.get(path)
      return field ? { path, rect, page: field.page } : null
    })
    .filter((e): e is ReviewBoxEdit => e !== null)
  const dirtyCount = dirtyEdits.length + dirtyBoxEdits.length

  const onEdit = (field: ExtractionOverlayField, raw: string) => {
    // Typing the original value back clears the correction instead of
    // leaving a phantom no-op edit. Amount inputs seed with currency
    // formatting, so numbers compare by parsed value ("$1,234" == 1234);
    // text compares raw so mid-edit whitespace isn't stripped away.
    const parsed = parseEdit(field, raw)
    const clean =
      raw === rawFieldValue(field) ||
      (typeof field.value === 'number' &&
        parsed.ok &&
        parsed.edit.value === field.value)
    setEdits((prev) => {
      if (clean) {
        if (!(field.path in prev)) return prev
        const { [field.path]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [field.path]: raw }
    })
  }

  const onBoxEdit = (
    field: ExtractionOverlayField,
    rect: NormalizedRect | null,
  ) => {
    if (rect === null) {
      if (!(field.path in boxEdits)) return
      const { [field.path]: _removed, ...rest } = boxEdits
      applyBoxEdits(rest)
      return
    }
    applyBoxEdits({ ...boxEdits, [field.path]: rect })
  }

  const reviewState =
    correctionsMut.data?.reviewState ??
    overlay?.reviewState ??
    stored?.docupipeReviewState
  const submitError = correctionsMut.isError
    ? 'Couldn’t save — try again.'
    : correctionsMut.data && !correctionsMut.data.ok
      ? (correctionsMut.data.error ?? 'Couldn’t save — try again.')
      : null
  const canFinalize =
    hasReview && Boolean(overlay) && (overlay?.fields.length ?? 0) > 0
  const justFinalized =
    correctionsMut.isSuccess &&
    correctionsMut.data.ok &&
    correctionsMut.variables.action === 'verify'
  const justRejected =
    correctionsMut.isSuccess &&
    correctionsMut.data.ok &&
    correctionsMut.variables.action === 'reject'

  const isPopout = pane !== undefined
  const showViewer = pane !== 'record'
  const showRecord = pane !== 'doc'
  // Finalize/Reject act on this window's pending corrections, which live
  // with the field rail — so the record pop-out never offers them.
  const showReviewActions = pane !== 'record'

  const openPane = (target: 'doc' | 'record') => {
    const url = `/document?client=${encodeURIComponent(client.id)}&verification=${encodeURIComponent(verification.id)}&doc=${encodeURIComponent(docId)}&pane=${target}`
    window.open(
      url,
      `sg-dream-${target}-${docId}`,
      'popup=yes,width=1280,height=940',
    )
  }

  const viewerToolbarExtra = (
    <>
      <button
        type="button"
        className="ovl-icon-button"
        aria-label="Undo box move"
        title="Undo box move"
        disabled={boxPast.length === 0 || correctionsMut.isPending}
        onClick={undoBoxEdit}
      >
        <Undo2 className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="ovl-icon-button"
        aria-label="Redo box move"
        title="Redo box move"
        disabled={boxFuture.length === 0 || correctionsMut.isPending}
        onClick={redoBoxEdit}
      >
        <Redo2 className="size-4" aria-hidden />
      </button>
      {pane !== 'doc' ? (
        <button
          type="button"
          className="ovl-icon-button"
          aria-label="Open the document in its own window"
          title="Pop out — document in its own window"
          onClick={() => openPane('doc')}
        >
          <PictureInPicture2 className="size-4" aria-hidden />
        </button>
      ) : null}
    </>
  )

  const headNote =
    submitError ??
    (errorCount > 0
      ? `Fix ${errorCount} invalid value${errorCount === 1 ? '' : 's'} before finalizing`
      : rerunFailed
        ? ((rerunMut.data && !rerunMut.data.ok && rerunMut.data.error) ||
          'Couldn’t start the re-run — try again.')
        : rerunMut.isSuccess && rerunMut.data.ok
          ? 'High-effort re-run started — extraction updates below as it lands.'
          : generateUnavailable
            ? 'No standardization on file — a review overlay can’t be generated.'
            : dirtyCount > 0
              ? `${dirtyCount} correction${dirtyCount === 1 ? '' : 's'} pending — finalize to apply`
              : null)

  const body = (
    <>
      <header className="doc-head">
        {!isPopout ? (
          <Link
            to="/processing"
            search={{ client: client.id, verification: verification.id }}
            className="doc-head-back unstyled-link"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            All documents
          </Link>
        ) : null}
        <div className="doc-head-main">
          <div className="doc-head-titles">
            <h1 className="doc-head-title mono">{displayName}</h1>
            {hasStandardizedName ? (
              <p className="doc-head-orig">
                Uploaded as <span className="mono">{doc.originalName}</span>
              </p>
            ) : null}
            <div className="doc-head-pills">
              <span className={status.cls}>
                <span className="dot" />
                {status.label}
              </span>
              {dupClass ? (
                <span className={`pill ${dupClass}`}>
                  {doc.duplicateFlag === 'exact'
                    ? 'Exact match'
                    : 'Likely match'}
                </span>
              ) : null}
              {doc.lowConfidence ? (
                <span className="pill pill-amber">Low confidence</span>
              ) : null}
              {hasReview ? <ReviewStatePill state={reviewState} /> : null}
            </div>
          </div>
          <div className="doc-head-side">
            <span className="doc-head-amount mono">
              {doc.amount > 0 ? formatCurrencyPrecise(doc.amount) : '—'}
            </span>
            {showReviewActions ? (
            <div className="doc-head-actions">
              {hasReview ? (
                <>
                  <button
                    type="button"
                    className="v2-btn"
                    disabled={correctionsMut.isPending || !canFinalize}
                    onClick={() => {
                      if (pendingCount > 0) {
                        setConfirmReject(true)
                        return
                      }
                      correctionsMut.mutate({ action: 'reject' })
                    }}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="v2-btn primary"
                    disabled={
                      correctionsMut.isPending || !canFinalize || errorCount > 0
                    }
                    onClick={() =>
                      correctionsMut.mutate({
                        action: 'verify',
                        edits: dirtyEdits,
                        boxEdits: dirtyBoxEdits,
                      })
                    }
                  >
                    {correctionsMut.isPending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {dirtyCount > 0
                      ? `Finalize · ${dirtyCount} correction${dirtyCount === 1 ? '' : 's'}`
                      : 'Finalize extraction'}
                  </button>
                </>
              ) : canGenerate ? (
                <button
                  type="button"
                  className="v2-btn primary"
                  disabled={genMut.isPending}
                  onClick={() => genMut.mutate()}
                >
                  {genMut.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <ScanSearch className="size-4" aria-hidden />
                  )}
                  {genMut.isPending
                    ? 'Generating overlay…'
                    : 'Generate review overlay'}
                </button>
              ) : null}
              {canRerun || hasReview ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="v2-btn"
                      aria-label="More actions"
                    >
                      <MoreHorizontal className="size-4" aria-hidden />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {canRerun ? (
                      <DropdownMenuItem
                        disabled={rerunMut.isPending}
                        onSelect={() => rerunMut.mutate()}
                      >
                        <RefreshCw className="size-4" aria-hidden />
                        {rerunMut.isPending
                          ? 'Requesting re-run…'
                          : doc.docType === 'UNK'
                            ? 'Re-classify & extract (high effort)'
                            : 'Re-run extraction (high effort)'}
                      </DropdownMenuItem>
                    ) : null}
                    {doc.docupipeReviewId ? (
                      <DropdownMenuItem asChild>
                        <a
                          href={hostedViewerHref(doc.docupipeReviewId)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-4" aria-hidden />
                          Open in DocuPipe
                        </a>
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            ) : null}
          </div>
        </div>
        {headNote ? (
          <p className="doc-head-note" role="status">
            {headNote}
          </p>
        ) : null}
      </header>

      {justFinalized ? (
        <div className="errbar green mb-3" role="status">
          <span className="icn">✓</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 font-semibold">Extraction finalized</p>
            <p className="m-0 text-[12.5px]">
              The reviewed values now drive this submission’s totals and the
              confirmation gate.
            </p>
          </div>
          {!isPopout ? (
            <Link
              to="/processing"
              search={{ client: client.id, verification: verification.id }}
              className="v2-btn"
            >
              Back to all documents
            </Link>
          ) : null}
        </div>
      ) : justRejected ? (
        <div className="errbar amber mb-3" role="status">
          <span className="icn">!</span>
          <div className="min-w-0 flex-1">
            <p className="m-0 font-semibold">Extraction rejected</p>
            <p className="m-0 text-[12.5px]">
              The review is marked rejected — re-run the extraction or contact
              Schedio Group to resolve this document.
            </p>
          </div>
          {!isPopout ? (
            <Link
              to="/processing"
              search={{ client: client.id, verification: verification.id }}
              className="v2-btn"
            >
              Back to all documents
            </Link>
          ) : null}
        </div>
      ) : null}

      {showViewer ? (
      <section className="doc-viewer-card">
        {!hasReview ? (
          <div className="ovl-state ovl-state-fill">
            {inFlight ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Still processing — the review overlay appears once extraction
                completes.
              </>
            ) : canGenerate ? (
              'No review overlay yet — generate one from the header to see every value on the page it was read from.'
            ) : (
              'No review overlay is available for this document.'
            )}
          </div>
        ) : overlayQuery.isPending ? (
          <div className="ovl-state ovl-state-fill">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading extraction data…
          </div>
        ) : overlayQuery.isError ? (
          <div className="ovl-state ovl-state-fill">
            Couldn’t load the extraction overlay — reload the page to try
            again.
          </div>
        ) : !overlay || overlay.fields.length === 0 ? (
          <div className="ovl-state ovl-state-fill">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            The overlay for this document is still being generated — it will
            appear here automatically, or{' '}
            <a
              href={hostedViewerHref(doc.docupipeReviewId as string)}
              target="_blank"
              rel="noreferrer"
            >
              open it in DocuPipe
            </a>
            .
          </div>
        ) : !overlay.fileAvailable ? (
          <div className="ovl-state ovl-state-fill">
            The original file isn’t available for inline preview.{' '}
            <a
              href={hostedViewerHref(doc.docupipeReviewId as string)}
              target="_blank"
              rel="noreferrer"
            >
              View the overlay in DocuPipe instead
            </a>
            .
          </div>
        ) : (
          <ClientOnly
            fallback={
              <div className="ovl-state ovl-state-fill">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Preparing viewer…
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="ovl-state ovl-state-fill">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Preparing viewer…
                </div>
              }
            >
              <ExtractionOverlayViewer
                fileUrl={`/api/documents/file?verification=${encodeURIComponent(
                  verification.id,
                )}&doc=${encodeURIComponent(docId)}`}
                fields={overlay.fields}
                mimeType={overlay.mimeType}
                corrections={{
                  edits,
                  onEdit,
                  boxEdits,
                  onBoxEdit,
                  errors: editErrors,
                  disabled: correctionsMut.isPending,
                }}
                toolbarExtra={viewerToolbarExtra}
              />
            </Suspense>
          </ClientOnly>
        )}
      </section>
      ) : null}

      {showRecord ? (
      <section className={`v2-card${showViewer ? ' mt-4' : ''}`}>
        <header className="v2-card-head">
          <h3>Extracted record</h3>
          <span className="sub">
            What SG DREAM read from this document — facts, pay-app math, and
            line items. Corrections you finalize above update this record.
          </span>
          {!isPopout ? (
            <button
              type="button"
              className="v2-btn"
              title="Pop out — extracted record in its own window"
              onClick={() => openPane('record')}
            >
              <PictureInPicture2 className="size-3.5" aria-hidden />
              Pop out
            </button>
          ) : null}
        </header>
        <div className="v2-card-body">
          <ExtractedRecord doc={doc} verificationId={verification.id} />
          {doc.errorMessage ? (
            <p className="qerror">{doc.errorMessage}</p>
          ) : null}
        </div>
      </section>
      ) : null}

      {blocker.status === 'blocked' ? (
        <DiscardDialog
          count={pendingCount}
          discardLabel="Discard & leave"
          onKeep={() => blocker.reset()}
          onDiscard={() => {
            clearCorrections()
            blocker.proceed()
          }}
        />
      ) : confirmReject ? (
        <DiscardDialog
          count={pendingCount}
          discardLabel="Discard & reject"
          onKeep={() => setConfirmReject(false)}
          onDiscard={() => {
            setConfirmReject(false)
            clearCorrections()
            correctionsMut.mutate({ action: 'reject' })
          }}
        />
      ) : null}
    </>
  )

  if (isPopout) {
    return (
      <div className={`doc-popout${pane === 'record' ? ' record' : ''}`}>
        {body}
      </div>
    )
  }

  return (
    <AppShell
      active="submit"
      crumbs={[{ label: 'Processing' }, { label: displayName }]}
    >
      <WorkflowBanner workflow={client.workflow} />
      {body}
    </AppShell>
  )
}

/**
 * Confirmation prompt shown before pending corrections would be lost —
 * navigating away or rejecting the extraction with unfinalized edits.
 */
function DiscardDialog({
  count,
  discardLabel,
  onKeep,
  onDiscard,
}: {
  count: number
  discardLabel: string
  onKeep: () => void
  onDiscard: () => void
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onKeep()
      }}
    >
      <DialogContent className="doc-discard-dialog" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            Discard {count} correction{count === 1 ? '' : 's'}?
          </DialogTitle>
          <DialogDescription>
            Your edits haven’t been finalized. If you continue, the extracted
            values stay as DocuPipe read them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button type="button" className="v2-btn" onClick={onKeep}>
            Keep editing
          </button>
          <button
            type="button"
            className="v2-btn primary"
            onClick={onDiscard}
          >
            {discardLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
