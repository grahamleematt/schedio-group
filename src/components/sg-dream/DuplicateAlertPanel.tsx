import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BellRing,
  FileSearch,
  FileWarning,
  Loader2,
  Trash2,
} from 'lucide-react'
import { docTypeLabels } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { deleteSubmissionDocument } from '#/server/fns/deleteSubmission'
import type { DreamSnapshot } from '#/server/store'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { DuplicateFlagPill } from './DuplicateFlag'

type DuplicateAlertPanelProps = {
  flaggedDocs: ReadonlyArray<Document>
  clientId: string
  verificationId: string
}

export function DuplicateAlertPanel({
  flaggedDocs,
  clientId,
  verificationId,
}: DuplicateAlertPanelProps) {
  const queryClient = useQueryClient()
  const snapshotKey = verificationSnapshotQuery(verificationId).queryKey
  const [pendingDoc, setPendingDoc] = useState<Document | null>(null)

  const discardMut = useMutation({
    mutationFn: (documentId: string) =>
      deleteSubmissionDocument({ data: { verificationId, documentId } }),
    onSuccess: (next: DreamSnapshot | null) => {
      queryClient.setQueryData(snapshotKey, next)
      setPendingDoc(null)
    },
  })

  if (flaggedDocs.length === 0) return null

  const notifySubject = encodeURIComponent(
    'Duplicate review needed for submission',
  )
  const notifyBody = encodeURIComponent(
    flaggedDocs
      .map(
        (doc) =>
          `${doc.originalName} (${doc.duplicateFlag}) matched ${
            doc.matchedPreviousName ?? 'a prior filing'
          }`,
      )
      .join('\n'),
  )

  return (
    <section className="flag-alert-panel">
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-flag-panel-border)' }}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-9 items-center justify-center rounded-full"
            style={{
              background: 'var(--color-flag-summary-bg)',
              color: 'var(--color-flag-summary-text)',
            }}
          >
            <FileWarning className="size-4" />
          </span>
          <div>
            <p className="font-ops text-sm font-semibold text-text-strong">
              {flaggedDocs.length} duplicate
              {flaggedDocs.length === 1 ? '' : 's'} detected in this submission
            </p>
            <p className="text-xs text-text-muted">
              The field-based detector compares vendor, document number, amount,
              and date against prior filings. Discard an accidental
              re-submission, or hold it for Schedio to review.
            </p>
          </div>
        </div>
        <a
          href={`mailto:?subject=${notifySubject}&body=${notifyBody}`}
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-text-strong hover:bg-(--color-surface-muted)"
          style={{ borderColor: 'var(--color-flag-panel-border)' }}
        >
          <BellRing className="size-4" />
          Notify Schedio
        </a>
      </header>

      <ul
        className="divide-y"
        style={{ borderColor: 'var(--color-flag-panel-border)' }}
      >
        {flaggedDocs.map((doc) => (
          <li
            key={doc.id}
            className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-mono text-sm font-semibold text-text-strong">
                  {doc.originalName}
                </p>
                {doc.duplicateFlag !== 'none' ? (
                  <DuplicateFlagPill flag={doc.duplicateFlag} />
                ) : null}
              </div>
              <p className="text-xs text-text-muted">
                {docTypeLabels[doc.docType]} · {doc.vendorName} · matched{' '}
                <span className="font-mono">
                  {doc.matchedPreviousName ?? 'prior filing'}
                </span>{' '}
                in{' '}
                <span className="font-mono">
                  {doc.matchedVerificationRef ?? 'previous submission'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className="pill pill-amber">
                <span className="dot" />
                Held for Schedio review
              </span>
              <Link
                to="/library"
                search={{
                  client: clientId,
                  verification: verificationId,
                  libraryQuery: doc.originalName,
                  libraryOpen: doc.docType,
                }}
                className="v2-btn ghost h-8 px-3 text-xs"
              >
                <FileSearch className="size-3.5" aria-hidden />
                Open in library
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  discardMut.reset()
                  setPendingDoc(doc)
                }}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Discard
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog
        open={pendingDoc !== null}
        onOpenChange={(next) => {
          if (!next && !discardMut.isPending) {
            setPendingDoc(null)
            discardMut.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard duplicate?</DialogTitle>
            <DialogDescription>
              Removes{' '}
              <span className="font-mono">
                {pendingDoc?.originalName ?? 'this document'}
              </span>{' '}
              from this submission. The matched prior filing and any Egnyte
              original are untouched, and the removal is recorded in the audit
              log.
            </DialogDescription>
          </DialogHeader>
          {discardMut.isError ? (
            <p className="m-0 text-[13px] text-destructive" role="alert">
              Could not discard the document. Try again.
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={discardMut.isPending}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={discardMut.isPending || !pendingDoc}
              onClick={() => {
                if (pendingDoc) discardMut.mutate(pendingDoc.id)
              }}
            >
              {discardMut.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="size-4" aria-hidden />
              )}
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
