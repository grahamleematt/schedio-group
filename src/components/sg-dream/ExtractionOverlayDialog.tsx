/**
 * Modal shell for the in-app extraction overlay. Owns the open state, fetches
 * the overlay payload (DocuPipe review fields + file availability) only once
 * opened, and lazy-loads the react-pdf viewer so pdf.js stays out of the
 * initial bundle and the SSR pass.
 *
 * Also owns the corrections flow: field edits typed in the viewer's rail are
 * tracked here, and Finalize/Reject submit them through
 * `submitReviewCorrections`, which updates the DocuPipe review and mirrors
 * accepted values onto the stored document (so costs submitted and the
 * confirmation gate reflect corrected truth).
 */

import { lazy, Suspense, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { extractionOverlayQuery, verificationSnapshotQuery } from '#/lib/queries'
import { submitReviewCorrections } from '#/server/fns/reviewCorrections'
import type { ReviewCorrectionsResult } from '#/server/fns/reviewCorrections'
import type { ExtractionOverlayField } from '#/server/fns/extractionOverlay'
import type { ReviewEdit } from '#/server/docupipe'
import type { ReviewState } from '#/server/store'

const ExtractionOverlayViewer = lazy(
  () => import('#/components/sg-dream/ExtractionOverlayViewer'),
)

function hostedViewerHref(reviewId: string): string {
  return `/api/docupipe/review-url?review=${encodeURIComponent(reviewId)}`
}

/** Raw editable representation of a field value (round-trips through Number). */
export function rawFieldValue(field: ExtractionOverlayField): string {
  return String(field.value ?? '')
}

/**
 * Coerce a typed correction back to the field's original scalar type: numeric
 * fields accept currency formatting ("$1,234.56"), everything else stays a
 * trimmed string.
 */
export function coerceEdit(
  field: ExtractionOverlayField,
  raw: string,
): ReviewEdit {
  const trimmed = raw.trim()
  if (typeof field.value === 'number') {
    const n = Number(trimmed.replace(/[$,\s]/g, ''))
    if (Number.isFinite(n) && trimmed.length > 0) {
      return { path: field.path, value: n }
    }
  }
  return { path: field.path, value: trimmed }
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

export function ExtractionOverlayDialog({
  verificationId,
  documentId,
  docupipeReviewId,
  documentName,
}: {
  verificationId: string
  documentId: string
  docupipeReviewId: string
  documentName: string
}) {
  const [open, setOpen] = useState(false)
  // Pending corrections keyed by field path; values are the raw input text.
  const [edits, setEdits] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()
  const overlayQuery = useQuery({
    ...extractionOverlayQuery(verificationId, documentId),
    enabled: open,
  })
  const overlay = overlayQuery.data

  const correctionsMut = useMutation({
    mutationFn: (input: {
      action: 'verify' | 'reject'
      edits?: Array<ReviewEdit>
    }) =>
      submitReviewCorrections({
        data: { verificationId, documentId, ...input },
      }),
    onSuccess: (result: ReviewCorrectionsResult) => {
      if (result.snapshot) {
        queryClient.setQueryData(
          verificationSnapshotQuery(verificationId).queryKey,
          result.snapshot,
        )
      }
      void queryClient.invalidateQueries({
        queryKey: extractionOverlayQuery(verificationId, documentId).queryKey,
      })
      if (result.ok) setEdits({})
    },
  })

  const fieldsByPath = new Map(
    (overlay?.fields ?? []).map((f) => [f.path, f] as const),
  )
  const dirtyEdits: Array<ReviewEdit> = Object.entries(edits)
    .map(([path, raw]) => {
      const field = fieldsByPath.get(path)
      return field ? coerceEdit(field, raw) : null
    })
    .filter((e): e is ReviewEdit => e !== null)
  const dirtyCount = dirtyEdits.length

  const onEdit = (field: ExtractionOverlayField, raw: string) => {
    setEdits((prev) => {
      if (raw === rawFieldValue(field)) {
        if (!(field.path in prev)) return prev
        const { [field.path]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [field.path]: raw }
    })
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setEdits({})
      correctionsMut.reset()
    }
  }

  const reviewState =
    correctionsMut.data?.reviewState ?? overlay?.reviewState ?? undefined
  const submitError = correctionsMut.isError
    ? 'Couldn’t save — try again.'
    : correctionsMut.data && !correctionsMut.data.ok
      ? (correctionsMut.data.error ?? 'Couldn’t save — try again.')
      : null

  return (
    <>
      <button type="button" className="qlink" onClick={() => setOpen(true)}>
        View extraction overlay
      </button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="ovl-dialog" showCloseButton>
          <DialogHeader className="ovl-dialog-head">
            <DialogTitle className="ovl-dialog-title">
              Extraction overlay
              <span className="mono">{overlay?.filename ?? documentName}</span>
              <ReviewStatePill state={reviewState} />
            </DialogTitle>
            <DialogDescription className="ovl-dialog-sub">
              Every extracted value is tied to the exact spot it was read from.
              Edit a value in the rail, then finalize to accept the extraction.
              <a
                href={hostedViewerHref(docupipeReviewId)}
                target="_blank"
                rel="noreferrer"
              >
                Open in DocuPipe
                <ExternalLink className="size-3" aria-hidden />
              </a>
            </DialogDescription>
          </DialogHeader>

          {overlayQuery.isPending && open ? (
            <div className="ovl-state ovl-state-fill">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Loading extraction data…
            </div>
          ) : overlayQuery.isError ? (
            <div className="ovl-state ovl-state-fill">
              Couldn’t load the extraction overlay — close and try again.
            </div>
          ) : !overlay || overlay.fields.length === 0 ? (
            <div className="ovl-state ovl-state-fill">
              The overlay for this document is still being generated. Try again
              in a moment, or{' '}
              <a
                href={hostedViewerHref(docupipeReviewId)}
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
                href={hostedViewerHref(docupipeReviewId)}
                target="_blank"
                rel="noreferrer"
              >
                View the overlay in DocuPipe instead
              </a>
              .
            </div>
          ) : (
            <div className="ovl-body">
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
                    verificationId,
                  )}&doc=${encodeURIComponent(documentId)}`}
                  fields={overlay.fields}
                  mimeType={overlay.mimeType}
                  corrections={{
                    edits,
                    onEdit,
                    disabled: correctionsMut.isPending,
                  }}
                />
              </Suspense>

              <div className="ovl-footer">
                <span className="ovl-footer-note">
                  {submitError ??
                    (dirtyCount > 0
                      ? `${dirtyCount} correction${dirtyCount === 1 ? '' : 's'} pending — finalize to apply`
                      : 'Finalize to confirm the extraction is correct.')}
                </span>
                <div className="ovl-footer-actions">
                  <button
                    type="button"
                    className="ovl-button"
                    disabled={correctionsMut.isPending}
                    onClick={() => correctionsMut.mutate({ action: 'reject' })}
                  >
                    Reject extraction
                  </button>
                  <button
                    type="button"
                    className="ovl-button ovl-button-primary"
                    disabled={correctionsMut.isPending}
                    onClick={() =>
                      correctionsMut.mutate({
                        action: 'verify',
                        edits: dirtyEdits,
                      })
                    }
                  >
                    {correctionsMut.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : null}
                    {dirtyCount > 0
                      ? 'Save corrections & finalize'
                      : 'Finalize extraction'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
