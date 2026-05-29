import { ChevronRight, Search } from 'lucide-react'
import { docTypeLabels, docTypeOrder } from '#/lib/sg-dream'
import type { Document, DocType } from '#/lib/sg-dream'
import { cn } from '#/lib/utils'
import { DuplicateFlagPill } from './DuplicateFlag'

export type NameDisplay = 'original' | 'standardized' | 'both'

type DocumentLibraryProps = {
  documents: ReadonlyArray<Document>
  query: string
  openCategory?: DocType
  nameDisplay: NameDisplay
  onQueryChange: (query: string) => void
  onToggleCategory: (docType: DocType) => void
  onNameDisplayChange: (value: NameDisplay) => void
}

const nameDisplayOptions: ReadonlyArray<{
  value: NameDisplay
  label: string
}> = [
  { value: 'original', label: 'Original' },
  { value: 'standardized', label: 'Standardized' },
  { value: 'both', label: 'Both' },
]

/**
 * Pure, URL-driven document library. Filtering and "which category is open"
 * are supplied by the parent via props (they live in URL search params),
 * so this component is stateless.
 */
export function DocumentLibrary({
  documents,
  query,
  openCategory,
  nameDisplay,
  onQueryChange,
  onToggleCategory,
  onNameDisplayChange,
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
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="radiogroup"
            aria-label="File name display"
            className="inline-flex rounded-full border bg-white p-0.5"
            style={{ borderColor: 'var(--color-border-base)' }}
          >
            {nameDisplayOptions.map((opt) => {
              const isActive = nameDisplay === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  onClick={() => onNameDisplayChange(opt.value)}
                  className={cn(
                    'inline-flex h-8 items-center rounded-full px-3 text-[0.72rem] font-semibold uppercase tracking-[0.06em] transition-colors',
                    isActive
                      ? 'text-[color:var(--color-brand-white)]'
                      : 'text-text-muted hover:text-text-strong',
                  )}
                  style={
                    isActive ? { background: 'var(--wf-base)' } : undefined
                  }
                >
                  {opt.label}
                </button>
              )
            })}
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
        </div>
      </header>

      <div>
        {presentTypes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-muted">
            {normalizedQuery.length === 0
              ? 'No documents uploaded for this submission yet.'
              : `No documents match "${normalizedQuery}".`}
          </p>
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
                className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[color:var(--color-surface-muted)]"
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
                <ul
                  id={panelId}
                  className="divide-y border-t"
                  style={{ borderColor: 'var(--color-border-base)' }}
                >
                  {inType.map((doc) => {
                    const isFlagged = doc.duplicateFlag !== 'none'
                    const displayedName =
                      nameDisplay === 'standardized'
                        ? doc.renamedName
                        : doc.originalName
                    return (
                      <li
                        key={doc.id}
                        className="flex flex-col gap-2 px-10 py-3"
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
                        <div className="min-w-0 flex-1 space-y-1">
                          {nameDisplay === 'both' ? (
                            <div className="grid gap-2 rounded-md border border-line-2 bg-white/80 p-3 sm:grid-cols-2">
                              <div className="min-w-0">
                                <div className="ops-label mb-1">
                                  Original upload
                                </div>
                                <p className="m-0 break-all font-mono text-[12.5px] font-semibold leading-snug text-ink">
                                  {doc.originalName}
                                </p>
                              </div>
                              <div className="min-w-0">
                                <div className="ops-label mb-1">
                                  Standardized filing name
                                </div>
                                <p className="m-0 break-all font-mono text-[12.5px] font-semibold leading-snug text-ink">
                                  {doc.renamedName}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="m-0 break-all font-mono text-sm font-semibold text-text-strong">
                                {displayedName}
                              </p>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                            <span>{doc.vendorName}</span>
                            <span aria-hidden>·</span>
                            <span>{docTypeLabels[doc.docType]}</span>
                            {isFlagged && doc.duplicateFlag !== 'none' ? (
                              <DuplicateFlagPill flag={doc.duplicateFlag} />
                            ) : null}
                          </div>
                          {isFlagged && doc.matchedPreviousName ? (
                            <p className="text-xs text-text-muted">
                              Matches{' '}
                              <span className="font-mono">
                                {doc.matchedPreviousName}
                              </span>{' '}
                              in{' '}
                              <span className="font-mono">
                                {doc.matchedVerificationRef ?? 'prior filing'}
                              </span>
                            </p>
                          ) : null}
                          {doc.egnyteWebUrl ? (
                            <p className="text-xs">
                              <a
                                href={doc.egnyteWebUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 font-semibold text-text-muted underline-offset-4 hover:text-text-strong hover:underline"
                              >
                                Filed in Egnyte
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
