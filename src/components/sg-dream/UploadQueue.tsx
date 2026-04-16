import { File, FileText, UploadCloud } from 'lucide-react'
import { docTypeLabels, formatCurrencyPrecise } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { DuplicateFlagDetail, DuplicateFlagPill } from './DuplicateFlag'

type UploadQueueProps = {
  queuedDocs: ReadonlyArray<Document>
}

export function UploadQueue({ queuedDocs }: UploadQueueProps) {
  const flaggedCount = queuedDocs.filter(
    (d) => d.duplicateFlag !== 'none',
  ).length

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center"
        style={{
          borderColor: 'var(--wf-border)',
          background: 'var(--wf-softer)',
        }}
      >
        <span
          aria-hidden
          className="inline-flex size-12 items-center justify-center rounded-2xl"
          style={{
            background: 'var(--wf-soft)',
            color: 'var(--wf-strong)',
          }}
        >
          <UploadCloud className="size-6" />
        </span>
        <div className="space-y-1">
          <p className="font-ops text-base font-semibold text-text-strong">
            Drag and drop documents here
          </p>
          <p className="text-sm text-text-muted">
            PDF, TIFF, or JPG. Up to 50 files · 200 MB each. Files are scanned
            for duplicates as they are added.
          </p>
        </div>
        <button type="button" className="wf-button-primary">
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
    </div>
  )
}
