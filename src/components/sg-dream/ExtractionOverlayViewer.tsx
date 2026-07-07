/**
 * In-app extraction overlay: renders the original document with react-pdf and
 * draws DocuPipe's per-field bounding boxes on top. Owning the render (instead
 * of DocuPipe's hosted viewer) is what lets us fix the two demo complaints:
 * sideways scans get a rotate control, and the boxes stay glued to the page
 * because box coordinates are transformed with the same rotation.
 *
 * Loaded lazily (client-only) from ExtractionOverlayDialog — react-pdf and the
 * pdf.js worker never enter the SSR bundle.
 */

import { Minus, Plus, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { formatCurrencyPrecise } from '#/lib/sg-dream'
import { rotateRect } from '#/lib/overlay-geometry'
import type { ExtractionOverlayField } from '#/server/fns/extractionOverlay'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_SCALE = 0.5
const MAX_SCALE = 3

function boxDomId(path: string): string {
  return `ovl-box-${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

function formatFieldValue(field: ExtractionOverlayField): string {
  if (typeof field.value === 'number') {
    // Money fields dominate the schemas; format anything that looks like a
    // dollar amount and leave small integers (counts, line items) plain.
    const isMoney =
      /amount|due|sum|retainage|payments|finish|stored|earned/i.test(field.path)
    return isMoney
      ? formatCurrencyPrecise(field.value)
      : field.value.toLocaleString()
  }
  if (typeof field.value === 'boolean') return field.value ? 'Yes' : 'No'
  return String(field.value ?? '')
}

function isLowConfidence(field: ExtractionOverlayField): boolean {
  if (typeof field.confidence === 'string') {
    return field.confidence.toLowerCase() === 'low'
  }
  if (typeof field.confidence === 'number') return field.confidence < 0.85
  return false
}

export type OverlayCorrections = {
  /** Pending raw input text keyed by field path (only dirty fields present). */
  edits: Record<string, string>
  onEdit: (field: ExtractionOverlayField, raw: string) => void
  disabled?: boolean
}

export default function ExtractionOverlayViewer({
  fileUrl,
  fields,
  mimeType,
  corrections,
}: {
  fileUrl: string
  fields: ReadonlyArray<ExtractionOverlayField>
  mimeType?: string
  /** When provided, field values in the rail become editable. */
  corrections?: OverlayCorrections
}) {
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(0.9)
  const [extraRotation, setExtraRotation] = useState(0)
  // Inherent /Rotate per page, captured on page load so the rotate control
  // adds to (rather than replaces) the document's own orientation.
  const [inherentRotation, setInherentRotation] = useState<
    Record<number, number>
  >({})
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const localized = fields.filter((f) => f.page && f.rect)
  const unlocalized = fields.filter((f) => !f.page || !f.rect)

  const selectField = (field: ExtractionOverlayField) => {
    setSelectedPath(field.path)
    if (field.page && field.rect) {
      document
        .getElementById(boxDomId(field.path))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const isImage = Boolean(mimeType?.startsWith('image/'))

  return (
    <div className="ovl-layout">
      <aside className="ovl-rail">
        <p className="ovl-rail-hint">
          {corrections
            ? 'Click a field to jump to where it was read. Edit a value to correct it.'
            : 'Click a field to jump to where it was read from the document.'}
        </p>
        <ul className="ovl-field-list">
          {[...localized, ...unlocalized].map((field) => {
            const selected = field.path === selectedPath
            const hasBox = Boolean(field.page && field.rect)
            const dirty = Boolean(corrections && field.path in corrections.edits)
            return (
              <li key={field.path}>
                <div
                  className={`ovl-field${selected ? ' selected' : ''}${dirty ? ' dirty' : ''}`}
                >
                  <button
                    type="button"
                    className="ovl-field-jump"
                    onClick={() => selectField(field)}
                    disabled={!hasBox && !selected}
                  >
                    <span className="ovl-field-label">
                      {field.label}
                      {isLowConfidence(field) ? (
                        <span className="pill pill-amber">Low</span>
                      ) : null}
                      {dirty ? (
                        <span className="pill pill-amber">Edited</span>
                      ) : null}
                    </span>
                    <span className="ovl-field-page">
                      {hasBox ? `Page ${field.page}` : 'Not localized'}
                    </span>
                  </button>
                  {corrections ? (
                    <input
                      className="ovl-field-input mono"
                      value={
                        corrections.edits[field.path] ??
                        String(field.value ?? '')
                      }
                      onChange={(e) =>
                        corrections.onEdit(field, e.target.value)
                      }
                      disabled={corrections.disabled}
                      aria-label={`${field.label} value`}
                      inputMode={
                        typeof field.value === 'number' ? 'decimal' : 'text'
                      }
                    />
                  ) : (
                    <span className="ovl-field-value mono">
                      {formatFieldValue(field)}
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </aside>

      <div className="ovl-viewer">
        <div className="ovl-toolbar">
          <span>{pageCount > 0 ? `${pageCount} pages` : 'Document'}</span>
          <div>
            <button
              type="button"
              className="ovl-icon-button"
              aria-label="Rotate 90 degrees"
              title="Rotate"
              onClick={() => setExtraRotation((r) => (r + 90) % 360)}
            >
              <RotateCw className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="ovl-icon-button"
              aria-label="Zoom out"
              onClick={() => setScale((v) => Math.max(MIN_SCALE, v - 0.15))}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <b>{Math.round(scale * 100)}%</b>
            <button
              type="button"
              className="ovl-icon-button"
              aria-label="Zoom in"
              onClick={() => setScale((v) => Math.min(MAX_SCALE, v + 0.15))}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="ovl-scroll">
          {isImage ? (
            <div className="ovl-page-shell">
              <div
                className="ovl-page"
                style={{
                  transform: extraRotation
                    ? `rotate(${extraRotation}deg)`
                    : undefined,
                }}
              >
                <img
                  src={fileUrl}
                  alt="Submitted document"
                  style={{ width: 760 * scale }}
                />
                {localized
                  .filter((f) => f.page === 1)
                  .map((field) => (
                    <OverlayBox
                      key={field.path}
                      field={field}
                      extraRotation={0}
                      selected={field.path === selectedPath}
                      onSelect={() => setSelectedPath(field.path)}
                    />
                  ))}
              </div>
            </div>
          ) : (
            <Document
              file={fileUrl}
              loading={<div className="ovl-state">Loading document…</div>}
              error={
                <div className="ovl-state">
                  The document preview failed to load.
                </div>
              }
              onLoadSuccess={({ numPages }: { numPages: number }) =>
                setPageCount(numPages)
              }
            >
              {Array.from({ length: pageCount }, (_, index) => {
                const pageNumber = index + 1
                const inherent = inherentRotation[pageNumber] ?? 0
                return (
                  <div className="ovl-page-shell" key={pageNumber}>
                    <div className="ovl-page-label">Page {pageNumber}</div>
                    <div className="ovl-page">
                      <Page
                        pageNumber={pageNumber}
                        width={760 * scale}
                        rotate={(inherent + extraRotation) % 360}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        loading={<div className="ovl-state">Loading page…</div>}
                        onLoadSuccess={(page: { rotate: number }) =>
                          setInherentRotation((prev) =>
                            prev[pageNumber] === page.rotate
                              ? prev
                              : { ...prev, [pageNumber]: page.rotate },
                          )
                        }
                      />
                      {localized
                        .filter((f) => f.page === pageNumber)
                        .map((field) => (
                          <OverlayBox
                            key={field.path}
                            field={field}
                            extraRotation={extraRotation}
                            selected={field.path === selectedPath}
                            onSelect={() => setSelectedPath(field.path)}
                          />
                        ))}
                    </div>
                  </div>
                )
              })}
            </Document>
          )}
        </div>
      </div>
    </div>
  )
}

function OverlayBox({
  field,
  extraRotation,
  selected,
  onSelect,
}: {
  field: ExtractionOverlayField
  extraRotation: number
  selected: boolean
  onSelect: () => void
}) {
  if (!field.rect) return null
  const rect = rotateRect(field.rect, extraRotation)
  return (
    <button
      type="button"
      id={boxDomId(field.path)}
      className={`ovl-mark${selected ? ' selected' : ''}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      }}
      title={`${field.label}: ${formatFieldValue(field)}`}
      aria-label={`${field.label} extracted here`}
      onClick={onSelect}
    />
  )
}
