import { Link } from '@tanstack/react-router'
import { BellRing, FileWarning } from 'lucide-react'
import { docTypeLabels } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { DuplicateFlagPill } from './DuplicateFlag'

type DuplicateAlertPanelProps = {
  flaggedDocs: ReadonlyArray<Document>
  clientId: string
  verificationId: string
  dupes: number
}

export function DuplicateAlertPanel({
  flaggedDocs,
  clientId,
  verificationId,
  dupes,
}: DuplicateAlertPanelProps) {
  if (flaggedDocs.length === 0) return null

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
              Each flagged document is listed below. Keep, remove, or escalate
              to Schedio Group.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center gap-2 rounded-full border bg-white px-4 text-sm font-semibold text-text-strong hover:bg-[color:var(--color-surface-muted)]"
          style={{ borderColor: 'var(--color-flag-panel-border)' }}
        >
          <BellRing className="size-4" />
          Notify Schedio
        </button>
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
                  {doc.matchedVerificationRef ?? 'previous verification'}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-full border bg-white px-3 text-xs font-semibold text-text-strong hover:bg-[color:var(--color-surface-muted)]"
                style={{ borderColor: 'var(--color-border-strong)' }}
              >
                Keep It
              </button>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-full border bg-white px-3 text-xs font-semibold text-text-strong hover:bg-[color:var(--color-surface-muted)]"
                style={{ borderColor: 'var(--color-border-strong)' }}
              >
                Remove It
              </button>
              <Link
                to="/confirmation"
                search={{
                  client: clientId,
                  verification: verificationId,
                  dupes,
                  compare: doc.id,
                }}
                className="inline-flex h-8 items-center rounded-full border bg-white px-3 text-xs font-semibold text-text-strong no-underline hover:bg-[color:var(--color-surface-muted)] unstyled-link"
                style={{ borderColor: 'var(--color-border-strong)' }}
              >
                View Previous
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
