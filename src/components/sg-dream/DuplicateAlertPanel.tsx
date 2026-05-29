import { Link } from '@tanstack/react-router'
import { BellRing, FileSearch, FileWarning } from 'lucide-react'
import { docTypeLabels } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
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
              and date against prior filings.
            </p>
          </div>
        </div>
        <a
          href={`mailto:?subject=${notifySubject}&body=${notifyBody}`}
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-text-strong hover:bg-[color:var(--color-surface-muted)]"
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
                  nameDisplay: 'both',
                }}
                className="v2-btn ghost h-8 px-3 text-xs"
              >
                <FileSearch className="size-3.5" aria-hidden />
                Open in library
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
