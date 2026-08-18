import { ChevronRight, FileStack, Loader2, Search, Trash2 } from 'lucide-react'
import {
  docTypeLabels,
  docTypeOrder,
  formatCurrencyPrecise,
} from '#/lib/sg-dream'
import type { Document, DocType } from '#/lib/sg-dream'
import { cn } from '#/lib/utils'
import { ExtractedDetail } from './ExtractedDetail'
import { RenameTransform } from './RenameTransform'

type DocumentLibraryProps = {
  documents: ReadonlyArray<Document>
  query: string
  openCategory?: DocType
  /** Enables on-demand "Generate review overlay" on rows missing a review. */
  verificationId?: string
  onQueryChange: (query: string) => void
  onToggleCategory: (docType: DocType) => void
  /**
   * When provided, each row renders a remove control. The parent owns
   * confirmation and the delete mutation; this component stays presentational.
   */
  onDelete?: (doc: Document) => void
  /** Id of the document whose delete is currently in flight (shows a spinner). */
  pendingDeleteId?: string
  /** Client roles: extracted detail renders without the Applied % editor. */
  readOnly?: boolean
}

function filedPill(custody: Document['custodyState']) {
  switch (custody) {
    case 'classified':
    case 'relied':
    case 'locked':
      return { label: 'Filed', cls: 'pill pill-green' }
    case 'ready':
      return { label: 'Ready to file', cls: 'pill pill-brand' }
    case 'processing':
      return { label: 'Filing', cls: 'pill pill-amber' }
    case 'incoming':
      return { label: 'Received', cls: 'pill pill-brand' }
    default:
      return { label: 'Pending', cls: 'pill pill-gray' }
  }
}

/**
 * Pure, URL-driven document library. Filtering and "which category is open"
 * are supplied by the parent via props (they live in URL search params), so
 * this component is stateless. Each row carries the same analyze-level detail
 * as the processing view (via the shared `ExtractedDetail`) so the library is
 * a complete record rather than a filename list.
 */
export function DocumentLibrary({
  documents,
  query,
  openCategory,
  verificationId,
  onQueryChange,
  onToggleCategory,
  onDelete,
  pendingDeleteId,
  readOnly,
}: DocumentLibraryProps) {
  const normalizedQuery = query.trim().toLowerCase()

  const filtered =
    normalizedQuery.length === 0
      ? documents
      : documents.filter((d) => {
          return (
            d.originalName.toLowerCase().includes(normalizedQuery) ||
            d.renamedName.toLowerCase().includes(normalizedQuery) ||
            d.vendorName.toLowerCase().includes(normalizedQuery) ||
            d.vendor.toLowerCase().includes(normalizedQuery) ||
            docTypeLabels[d.docType].toLowerCase().includes(normalizedQuery)
          )
        })

  const presentTypes = docTypeOrder.filter((t) =>
    filtered.some((d) => d.docType === t),
  )

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
        style={{ borderColor: 'var(--color-border-base)' }}
      >
        <div>
          <p className="ops-label m-0">Document library</p>
          <h2 className="font-ops text-base font-semibold text-text-strong">
            All filed documents for this submission
          </h2>
        </div>
        <label
          className="flex h-9 items-center gap-2 rounded-full border bg-white px-3 text-sm"
          style={{ borderColor: 'var(--color-border-base)' }}
        >
          <Search className="size-3.5 text-text-muted" />
          <input
            type="search"
            placeholder="Search name, vendor, type"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="w-40 border-none bg-transparent text-sm outline-none placeholder:text-text-muted focus:w-56"
          />
        </label>
      </header>

      <div>
        {presentTypes.length === 0 ? (
          normalizedQuery.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span
                aria-hidden
                className="inline-flex size-10 items-center justify-center rounded-xl"
                style={{
                  background: 'var(--wf-soft)',
                  color: 'var(--wf-strong)',
                }}
              >
                <FileStack className="size-5" />
              </span>
              <p className="m-0 font-ops text-sm font-semibold text-text-strong">
                No documents filed yet
              </p>
              <p className="m-0 max-w-sm text-xs text-text-muted">
                As you upload pay apps, invoices, and supporting files, they’ll
                be grouped here by document type with their extracted detail.
              </p>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-text-muted">
              No documents match “{normalizedQuery}”.
            </p>
          )
        ) : null}

        {presentTypes.map((docType) => {
          const inType = filtered.filter((d) => d.docType === docType)
          const flagged = inType.filter((d) => d.duplicateFlag !== 'none')
          const isOpen = openCategory === docType
          const panelId = `lib-${docType}`
          return (
            <div
              key={docType}
              className="border-t"
              style={{ borderColor: 'var(--color-border-base)' }}
            >
              <button
                type="button"
                onClick={() => onToggleCategory(docType)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-(--color-surface-muted)"
              >
                <div className="flex items-center gap-3">
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      'size-4 text-text-muted transition-transform',
                      isOpen && 'rotate-90',
                    )}
                  />
                  <span className="font-ops text-sm font-semibold text-text-strong">
                    {docTypeLabels[docType]}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {inType.length} file{inType.length === 1 ? '' : 's'}
                  </span>
                </div>
                {flagged.length > 0 ? (
                  <span className="flag-pill-likely">
                    {flagged.length} flagged
                  </span>
                ) : null}
              </button>

              {isOpen ? (
                <div
                  id={panelId}
                  className="border-t"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  {inType.map((doc) => (
                    <LibraryRow
                      key={doc.id}
                      doc={doc}
                      verificationId={verificationId}
                      onDelete={onDelete}
                      pendingDeleteId={pendingDeleteId}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function LibraryRow({
  doc,
  verificationId,
  onDelete,
  pendingDeleteId,
  readOnly,
}: {
  doc: Document
  verificationId?: string
  onDelete?: (doc: Document) => void
  pendingDeleteId?: string
  readOnly?: boolean
}) {
  const isFlagged = doc.duplicateFlag !== 'none'
  const hasStandardizedName = doc.renamedName !== doc.originalName
  const dupClass =
    doc.duplicateFlag === 'exact'
      ? 'pill-red'
      : doc.duplicateFlag === 'likely'
        ? 'pill-amber'
        : null
  const filed = filedPill(doc.custodyState)

  return (
    <div
      className="queue-row"
      style={
        isFlagged
          ? {
              background:
                doc.duplicateFlag === 'exact'
                  ? 'var(--color-flag-exact-bg)'
                  : 'var(--color-flag-likely-bg)',
            }
          : undefined
      }
    >
      <span className="doc-ico" aria-hidden />
      <div className="qmeta min-w-0">
        {hasStandardizedName ? (
          <RenameTransform
            mode="applied"
            originalName={doc.originalName}
            renamedName={doc.renamedName}
          />
        ) : (
          <p className="qtitle">{doc.renamedName}</p>
        )}
        <div className="qdetail">
          <span>{doc.vendorName}</span>
          <span>{docTypeLabels[doc.docType]}</span>
          {dupClass ? (
            <span className={`pill ${dupClass}`}>
              {doc.duplicateFlag === 'exact' ? 'Exact match' : 'Likely match'}
            </span>
          ) : null}
          {doc.lowConfidence ? (
            <span className="pill pill-amber">Low confidence</span>
          ) : null}
          <span className={filed.cls}>
            <span className="dot" />
            {filed.label}
          </span>
        </div>

        {isFlagged && doc.matchedPreviousName ? (
          <p className="qconf">
            <span className="qk">Matches:</span>{' '}
            <span className="mono">{doc.matchedPreviousName}</span> in{' '}
            <span className="mono">
              {doc.matchedVerificationRef ?? 'prior filing'}
            </span>
          </p>
        ) : null}

        <ExtractedDetail
          doc={doc}
          verificationId={verificationId}
          readOnly={readOnly}
        />

        {doc.egnyteWebUrl ? (
          <a
            href={doc.egnyteWebUrl}
            target="_blank"
            rel="noreferrer"
            className="qlink"
          >
            Filed in Egnyte
          </a>
        ) : null}
      </div>

      <span className="queue-amount mono">
        {doc.amount > 0 ? formatCurrencyPrecise(doc.amount) : '—'}
      </span>

      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(doc)}
          disabled={pendingDeleteId === doc.id}
          aria-label={`Remove ${doc.originalName}`}
          title="Remove document"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-transparent text-text-muted transition-colors hover:border-flag-exact-border hover:bg-flag-exact-bg hover:text-(--color-flag-exact-text) disabled:opacity-50"
        >
          {pendingDeleteId === doc.id ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="size-4" aria-hidden />
          )}
        </button>
      ) : null}
    </div>
  )
}
