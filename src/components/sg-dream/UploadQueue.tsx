import { File, FileText, Loader2, UploadCloud } from 'lucide-react'
import { useState } from 'react'
import type { DragEvent } from 'react'
import { docTypeLabels, formatCurrencyPrecise } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { DuplicateFlagDetail, DuplicateFlagPill } from './DuplicateFlag'

type UploadQueueProps = {
  queuedDocs: ReadonlyArray<Document>
  onBrowseClick?: () => void
  isUploading?: boolean
  onDropFiles?: (files: FileList) => void
}

export function UploadQueue({
  queuedDocs,
  onBrowseClick,
  isUploading,
  onDropFiles,
}: UploadQueueProps) {
  const [isDragging, setIsDragging] = useState(false)
  const flaggedCount = queuedDocs.filter(
    (d) => d.duplicateFlag !== 'none',
  ).length

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (onDropFiles && e.dataTransfer.files.length > 0) {
      onDropFiles(e.dataTransfer.files)
    }
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!onDropFiles) return
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }

  const onDragLeave = () => setIsDragging(false)

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors"
        style={{
          borderColor: isDragging ? 'var(--wf-strong)' : 'var(--wf-border)',
          background: isDragging ? 'var(--wf-soft)' : 'var(--wf-softer)',
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
      >
        <span
          aria-hidden
          className="inline-flex size-12 items-center justify-center rounded-2xl"
          style={{
            background: 'var(--wf-soft)',
            color: 'var(--wf-strong)',
          }}
        >
          {isUploading ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <UploadCloud className="size-6" />
          )}
        </span>
        <div className="space-y-1">
          <p className="font-ops text-base font-semibold text-text-strong">
            {isUploading
              ? 'Uploading to DocuPipe…'
              : 'Drag and drop documents here'}
          </p>
          <p className="text-sm text-text-muted">
            PDF, TIFF, or JPG. Each file is streamed to DocuPipe for classify +
            standardize.
          </p>
        </div>
        <button
          type="button"
          className="wf-button-primary"
          onClick={onBrowseClick}
          disabled={isUploading || !onBrowseClick}
        >
          Browse files
        </button>
      </div>

      {flaggedCount > 0 ? (
        <div className="flag-summary-bar">
          <span
            aria-hidden
            className="inline-flex size-6 items-center justify-center rounded-full bg-white/70 text-[0.78rem] font-bold text-[color:var(--color-flag-summary-text)]"
          >
            {flaggedCount}
          </span>
          <span>
            {flaggedCount} file{flaggedCount === 1 ? '' : 's'} flagged for
            possible duplication. Review below before continuing.
          </span>
        </div>
      ) : null}

      {queuedDocs.length > 0 ? (
        <ul
          className="divide-y overflow-hidden rounded-2xl border"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          {queuedDocs.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-col gap-3 bg-white p-4 sm:flex-row sm:items-start sm:gap-4"
            >
              <span
                aria-hidden
                className="inline-flex size-9 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--wf-softer)',
                  color: 'var(--wf-strong)',
                }}
              >
                {doc.docType === 'INV' ||
                doc.docType === 'PA' ||
                doc.docType === 'POP' ? (
                  <FileText className="size-4" />
                ) : (
                  <File className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm font-semibold text-text-strong">
                    {doc.originalName}
                  </p>
                  {doc.duplicateFlag !== 'none' ? (
                    <DuplicateFlagPill flag={doc.duplicateFlag} />
                  ) : null}
                </div>
                <p className="truncate text-xs text-text-muted">
                  {docTypeLabels[doc.docType]} · {doc.vendorName} ·{' '}
                  <span className="font-mono">{doc.renamedName}</span>
                </p>
                {doc.duplicateFlag !== 'none' ? (
                  <DuplicateFlagDetail
                    flag={doc.duplicateFlag}
                    matchedPreviousName={doc.matchedPreviousName}
                    matchedVerificationRef={doc.matchedVerificationRef}
                    actions={['keep', 'remove']}
                  />
                ) : null}
              </div>
              <div className="text-right font-mono text-sm text-text-strong">
                {doc.amount > 0 ? formatCurrencyPrecise(doc.amount) : '—'}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="rounded-2xl border px-4 py-6 text-center text-sm text-text-muted"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          Queue is empty. Drag files onto the drop zone or press Browse files.
        </div>
      )}
    </div>
  )
}
