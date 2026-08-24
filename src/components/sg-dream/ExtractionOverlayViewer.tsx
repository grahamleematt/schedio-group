/**
 * In-app extraction overlay: renders the original document with react-pdf and
 * draws DocuPipe's per-field bounding boxes on top. Owning the render (instead
 * of DocuPipe's hosted viewer) is what lets us fix the two demo complaints:
 * sideways scans get a rotate control, and the boxes stay glued to the page
 * because box coordinates are transformed with the same rotation.
 *
 * When corrections are enabled, boxes are also draggable (move) and
 * resizable (bottom-right handle): the reviewer can re-anchor a value to the
 * spot it was actually read from, and Finalize persists the repositioned
 * boxes to the DocuPipe review alongside any value edits.
 *
 * Loaded lazily (client-only) from the document detail route — react-pdf and
 * the pdf.js worker never enter the SSR bundle.
 */

import {
  EyeOff,
  Maximize,
  Minus,
  Plus,
  RotateCw,
  Square,
  SquareDashed,
  StretchHorizontal,
} from 'lucide-react'
import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import type { CSSProperties, ReactNode } from 'react'

import { formatCurrencyPrecise } from '#/lib/sg-dream'
import {
  displayFieldValue,
  isLineItemPath,
  isMoneyPath,
  rawFieldValue,
} from '#/lib/review-edits'
import {
  clampRectToPage,
  rotateRect,
  unrotateRect,
} from '#/lib/overlay-geometry'
import type { NormalizedRect } from '#/lib/overlay-geometry'
import type { ExtractionOverlayField } from '#/server/fns/extractionOverlay'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_SCALE = 0.4
const MAX_SCALE = 4
/** Multiplicative step for the ± buttons — smoother than the old fixed 15%. */
const ZOOM_STEP = 1.2
/** Rendered page width at scale 1 (the react-pdf `width` baseline). */
const BASE_PAGE_WIDTH = 760
/** `.ovl-scroll` padding + a little breathing room, for the fit controls. */
const FIT_MARGIN_PX = 40
/** Pointer must travel this many px before a press counts as a drag. */
const DRAG_THRESHOLD_PX = 3

function boxDomId(path: string): string {
  return `ovl-box-${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}

function formatFieldValue(field: ExtractionOverlayField): string {
  if (typeof field.value === 'number') {
    return isMoneyPath(field.path)
      ? formatCurrencyPrecise(field.value)
      : field.value.toLocaleString()
  }
  if (typeof field.value === 'boolean') return field.value ? 'Yes' : 'No'
  return String(field.value ?? '')
}

/**
 * Configurable box highlight — Tim's ask from the walkthrough: on documents
 * that are already yellow-tinted, the default amber boxes "look like a
 * glob". Each option maps to a set of CSS custom properties that the
 * `.ovl-mark` rules consume; the choice sticks per browser.
 */
const HIGHLIGHT_STORAGE_KEY = 'sg-dream.overlay-highlight'

type HighlightOption = {
  key: string
  label: string
  swatch: string
  vars: CSSProperties
}

const HIGHLIGHT_OPTIONS: Array<HighlightOption> = [
  {
    key: 'amber',
    label: 'Amber highlights',
    swatch: 'rgba(215, 155, 0, 0.9)',
    vars: {
      '--ovl-hl-border': 'rgba(215, 155, 0, 0.9)',
      '--ovl-hl-fill': 'rgba(255, 214, 90, 0.32)',
      '--ovl-hl-fill-hover': 'rgba(255, 214, 90, 0.48)',
      '--ovl-hl-strong-border': 'rgba(176, 108, 0, 0.95)',
      '--ovl-hl-strong-fill': 'rgba(255, 190, 60, 0.4)',
      '--ovl-hl-ring': 'rgba(215, 155, 0, 0.35)',
    } as CSSProperties,
  },
  {
    key: 'blue',
    label: 'Blue highlights',
    swatch: 'rgba(37, 99, 235, 0.9)',
    vars: {
      '--ovl-hl-border': 'rgba(37, 99, 235, 0.9)',
      '--ovl-hl-fill': 'rgba(96, 165, 250, 0.28)',
      '--ovl-hl-fill-hover': 'rgba(96, 165, 250, 0.44)',
      '--ovl-hl-strong-border': 'rgba(29, 78, 216, 0.95)',
      '--ovl-hl-strong-fill': 'rgba(96, 165, 250, 0.42)',
      '--ovl-hl-ring': 'rgba(37, 99, 235, 0.35)',
    } as CSSProperties,
  },
  {
    key: 'green',
    label: 'Green highlights',
    swatch: 'rgba(22, 163, 74, 0.9)',
    vars: {
      '--ovl-hl-border': 'rgba(22, 163, 74, 0.9)',
      '--ovl-hl-fill': 'rgba(74, 222, 128, 0.28)',
      '--ovl-hl-fill-hover': 'rgba(74, 222, 128, 0.44)',
      '--ovl-hl-strong-border': 'rgba(21, 128, 61, 0.95)',
      '--ovl-hl-strong-fill': 'rgba(74, 222, 128, 0.42)',
      '--ovl-hl-ring': 'rgba(22, 163, 74, 0.35)',
    } as CSSProperties,
  },
  {
    key: 'magenta',
    label: 'Magenta highlights',
    swatch: 'rgba(219, 39, 119, 0.9)',
    vars: {
      '--ovl-hl-border': 'rgba(219, 39, 119, 0.9)',
      '--ovl-hl-fill': 'rgba(244, 114, 182, 0.26)',
      '--ovl-hl-fill-hover': 'rgba(244, 114, 182, 0.42)',
      '--ovl-hl-strong-border': 'rgba(190, 24, 93, 0.95)',
      '--ovl-hl-strong-fill': 'rgba(244, 114, 182, 0.4)',
      '--ovl-hl-ring': 'rgba(219, 39, 119, 0.35)',
    } as CSSProperties,
  },
]

function storedHighlightKey(): string {
  if (typeof window === 'undefined') return HIGHLIGHT_OPTIONS[0].key
  try {
    const stored = window.localStorage.getItem(HIGHLIGHT_STORAGE_KEY)
    if (stored && HIGHLIGHT_OPTIONS.some((o) => o.key === stored)) {
      return stored
    }
  } catch {
    // Storage unavailable (private mode) — fall back to the default.
  }
  return HIGHLIGHT_OPTIONS[0].key
}

/**
 * Box style — Andres's ask from the feedback widget: filled highlights can
 * be hard to read through on dense scans. `outline` keeps the anchors
 * without tinting the text underneath; `hidden` clears the page entirely and
 * shows only the selected field's box (hovering still reveals a box, and
 * clicking a rail field still jumps to it). The choice sticks per browser.
 */
const BOX_MODE_STORAGE_KEY = 'sg-dream.overlay-box-mode'

type BoxMode = 'filled' | 'outline' | 'hidden'

const BOX_MODES: Array<{ key: BoxMode; label: string; icon: typeof Square }> = [
  { key: 'filled', label: 'Filled boxes', icon: Square },
  { key: 'outline', label: 'Outlines only', icon: SquareDashed },
  { key: 'hidden', label: 'Hide boxes (selected field still shows)', icon: EyeOff },
]

function storedBoxMode(): BoxMode {
  if (typeof window === 'undefined') return 'filled'
  try {
    const stored = window.localStorage.getItem(BOX_MODE_STORAGE_KEY)
    if (stored && BOX_MODES.some((m) => m.key === stored)) {
      return stored as BoxMode
    }
  } catch {
    // Storage unavailable (private mode) — fall back to the default.
  }
  return 'filled'
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
  /** Pending box repositions keyed by field path (base page orientation). */
  boxEdits: Record<string, NormalizedRect>
  onBoxEdit: (field: ExtractionOverlayField, rect: NormalizedRect | null) => void
  /** Inline validation message per field path (invalid edits block Finalize). */
  errors: Record<string, string>
  disabled?: boolean
}

type RailSection = {
  key: string
  title: string
  fields: Array<ExtractionOverlayField>
}

/**
 * Triage the rail: low-confidence fields first ("Needs review"), then the
 * rest grouped by the page they were read from, unlocalized values last.
 * `line_items.*` leaves are owned by the line-item table, so they never
 * appear in the rail (their boxes stay drawn on the page).
 */
export function buildRailSections(
  fields: ReadonlyArray<ExtractionOverlayField>,
): Array<RailSection> {
  const railFields = fields.filter((f) => !isLineItemPath(f.path))
  const needsReview = railFields.filter(isLowConfidence)
  const rest = railFields.filter((f) => !isLowConfidence(f))
  const byPage = new Map<number, Array<ExtractionOverlayField>>()
  const unlocalized: Array<ExtractionOverlayField> = []
  for (const field of rest) {
    if (field.page && field.rect) {
      const group = byPage.get(field.page)
      if (group) group.push(field)
      else byPage.set(field.page, [field])
    } else {
      unlocalized.push(field)
    }
  }
  const sections: Array<RailSection> = []
  if (needsReview.length > 0) {
    sections.push({ key: 'needs', title: 'Needs review', fields: needsReview })
  }
  for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
    sections.push({
      key: `page-${page}`,
      title: `Page ${page}`,
      fields: byPage.get(page) ?? [],
    })
  }
  if (unlocalized.length > 0) {
    sections.push({
      key: 'unlocalized',
      title: 'Not localized',
      fields: unlocalized,
    })
  }
  return sections
}

export default function ExtractionOverlayViewer({
  fileUrl,
  fields,
  mimeType,
  corrections,
  toolbarExtra,
}: {
  fileUrl: string
  fields: ReadonlyArray<ExtractionOverlayField>
  mimeType?: string
  /** When provided, field values in the rail become editable. */
  corrections?: OverlayCorrections
  /** Extra controls the owner renders into the toolbar (undo, pop-out…). */
  toolbarExtra?: ReactNode
}) {
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(0.9)
  const [extraRotation, setExtraRotation] = useState(0)
  // Inherent /Rotate per page, captured on page load so the rotate control
  // adds to (rather than replaces) the document's own orientation. Values are
  // optional: a page's rotation is unknown until its load callback fires.
  const [inherentRotation, setInherentRotation] = useState<
    Record<number, number | undefined>
  >({})
  // First page's intrinsic (unrotated) size, captured on load — drives the
  // fit-page control's aspect math.
  const [pageDims, setPageDims] = useState<{ w: number; h: number } | null>(
    null,
  )
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  // Mirror of `scale` for the native (non-passive) wheel listener; every
  // zoom change goes through `applyScale`, which keeps both in sync.
  const scaleRef = useRef(scale)

  /**
   * Set the zoom level while keeping the document point under `anchor`
   * (viewport coords, defaulting to the viewer center) stationary — the
   * cursor-anchored zoom promised in the walkthrough. `flushSync` lets the
   * scroll offset be corrected in the same frame the new scale paints, so
   * the page doesn't visibly jump.
   */
  const applyScale = (nextRaw: number, anchor?: { x: number; y: number }) => {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextRaw))
    const prev = scaleRef.current
    if (next === prev) return
    scaleRef.current = next
    const scroller = scrollRef.current
    if (!scroller) {
      setScale(next)
      return
    }
    const box = scroller.getBoundingClientRect()
    const cx = anchor ? anchor.x - box.left : box.width / 2
    const cy = anchor ? anchor.y - box.top : box.height / 2
    const contentX = scroller.scrollLeft + cx
    const contentY = scroller.scrollTop + cy
    const ratio = next / prev
    flushSync(() => setScale(next))
    scroller.scrollLeft = contentX * ratio - cx
    scroller.scrollTop = contentY * ratio - cy
  }

  const attachScroller = (node: HTMLDivElement | null) => {
    scrollRef.current = node
  }

  // Ctrl/⌘ + wheel (and trackpad pinch, which browsers deliver as a
  // ctrl-modified wheel) zooms at the cursor. React registers `onWheel`
  // passively, so preventing the browser's own page zoom requires a native
  // non-passive listener — attached via ref callback, cleaned up by React 19.
  // It listens on the whole viewer layout (rail and toolbar included), not
  // just the page scroller: browser zoom is per-origin in Chrome, so a zoom
  // gesture that slipped through anywhere over this surface would rescale
  // every SG DREAM window at once — the main page and pop-outs together.
  const attachLayout = (node: HTMLDivElement | null) => {
    if (!node) return undefined
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const deltaY = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
      const box = scrollRef.current?.getBoundingClientRect()
      const overScroller =
        box !== undefined &&
        e.clientX >= box.left &&
        e.clientX <= box.right &&
        e.clientY >= box.top &&
        e.clientY <= box.bottom
      applyScale(
        scaleRef.current * Math.exp(-deltaY * 0.0022),
        overScroller ? { x: e.clientX, y: e.clientY } : undefined,
      )
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return () => node.removeEventListener('wheel', onWheel)
  }

  /** Displayed height/width ratio of page 1, given the current rotation. */
  const displayedAspect = (): number | null => {
    if (!pageDims || pageDims.w <= 0 || pageDims.h <= 0) return null
    // The record may not have page 1 yet (dims and rotation land separately).
    const inherentFirst = inherentRotation[1] ?? 0
    const total = ((inherentFirst + extraRotation) % 360 + 360) % 360
    return total % 180 === 90 ? pageDims.w / pageDims.h : pageDims.h / pageDims.w
  }

  const fitWidth = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    applyScale((scroller.clientWidth - FIT_MARGIN_PX) / BASE_PAGE_WIDTH)
  }

  const fitPage = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    const widthScale =
      (scroller.clientWidth - FIT_MARGIN_PX) / BASE_PAGE_WIDTH
    const aspect = displayedAspect()
    if (!aspect) {
      applyScale(widthScale)
      return
    }
    const heightScale =
      (scroller.clientHeight - FIT_MARGIN_PX) / (BASE_PAGE_WIDTH * aspect)
    applyScale(Math.min(widthScale, heightScale))
  }
  const [highlightKey, setHighlightKey] = useState(storedHighlightKey)
  const highlight =
    HIGHLIGHT_OPTIONS.find((o) => o.key === highlightKey) ??
    HIGHLIGHT_OPTIONS[0]

  const pickHighlight = (key: string) => {
    setHighlightKey(key)
    try {
      window.localStorage.setItem(HIGHLIGHT_STORAGE_KEY, key)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
  }

  const [boxMode, setBoxMode] = useState<BoxMode>(storedBoxMode)

  const pickBoxMode = (mode: BoxMode) => {
    setBoxMode(mode)
    try {
      window.localStorage.setItem(BOX_MODE_STORAGE_KEY, mode)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
  }

  const localized = fields.filter((f) => f.page && f.rect)

  const selectField = (field: ExtractionOverlayField) => {
    setSelectedPath(field.path)
    if (field.page && field.rect) {
      document
        .getElementById(boxDomId(field.path))
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const isImage = Boolean(mimeType?.startsWith('image/'))

  const renderBox = (field: ExtractionOverlayField, rotation: number) => (
    <OverlayBox
      key={field.path}
      field={field}
      extraRotation={rotation}
      selected={field.path === selectedPath}
      onSelect={() => setSelectedPath(field.path)}
      editedRect={corrections?.boxEdits[field.path]}
      // Line-item values are corrected in the line-item table, so their
      // boxes stay display-only — dragging one would have no rail affordance
      // to review or revert the move.
      editable={
        Boolean(corrections) &&
        !corrections?.disabled &&
        !isLineItemPath(field.path)
      }
      onCommit={(rect) => corrections?.onBoxEdit(field, rect)}
    />
  )

  const sections = buildRailSections(fields)

  return (
    <div
      className="ovl-layout"
      style={highlight.vars}
      data-boxes={boxMode}
      ref={attachLayout}
    >
      <aside className="ovl-rail">
        <p className="ovl-rail-hint">
          {corrections
            ? 'Click a field to jump to where it was read. Edit a value to correct it, or drag its box on the page to re-anchor it.'
            : 'Click a field to jump to where it was read from the document.'}
        </p>
        <ul className="ovl-field-list">
          {sections.map((section) => (
            <li key={section.key} className="ovl-rail-group">
              <p
                className={`ovl-rail-title${section.key === 'needs' ? ' needs' : ''}`}
              >
                {section.title}
              </p>
              <ul className="ovl-field-sublist">
                {section.fields.map((field) => {
                  const selected = field.path === selectedPath
                  const hasBox = Boolean(field.page && field.rect)
                  const valueDirty = Boolean(
                    corrections && field.path in corrections.edits,
                  )
                  const boxDirty = Boolean(
                    corrections && field.path in corrections.boxEdits,
                  )
                  const error = corrections?.errors[field.path]
                  return (
                    <li key={field.path}>
                      <div
                        className={`ovl-field${selected ? ' selected' : ''}${valueDirty || boxDirty ? ' dirty' : ''}${error ? ' invalid' : ''}`}
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
                            {valueDirty && !error ? (
                              <span className="pill pill-amber">
                                Corrected
                              </span>
                            ) : null}
                            {boxDirty ? (
                              <span className="pill pill-amber">
                                Box moved
                              </span>
                            ) : null}
                          </span>
                          <span className="ovl-field-page">
                            {hasBox ? `Page ${field.page}` : 'Not localized'}
                          </span>
                        </button>
                        {corrections ? (
                          <input
                            className={`ovl-field-input mono${error ? ' invalid' : ''}`}
                            value={
                              corrections.edits[field.path] ??
                              displayFieldValue(field)
                            }
                            onChange={(e) =>
                              corrections.onEdit(field, e.target.value)
                            }
                            disabled={corrections.disabled}
                            aria-label={`${field.label} value`}
                            aria-invalid={Boolean(error)}
                            inputMode={
                              typeof field.value === 'number'
                                ? 'decimal'
                                : 'text'
                            }
                          />
                        ) : (
                          <span className="ovl-field-value mono">
                            {formatFieldValue(field)}
                          </span>
                        )}
                        {error ? (
                          <span className="ovl-field-error" role="alert">
                            {error}
                          </span>
                        ) : null}
                        {valueDirty ? (
                          <button
                            type="button"
                            className="ovl-box-reset"
                            onClick={() =>
                              corrections?.onEdit(field, rawFieldValue(field))
                            }
                            disabled={corrections?.disabled}
                          >
                            Revert value
                          </button>
                        ) : null}
                        {boxDirty ? (
                          <button
                            type="button"
                            className="ovl-box-reset"
                            onClick={() => corrections?.onBoxEdit(field, null)}
                            disabled={corrections?.disabled}
                          >
                            Reset box position
                          </button>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </aside>

      <div className="ovl-viewer">
        <div className="ovl-toolbar">
          <span>{pageCount > 0 ? `${pageCount} pages` : 'Document'}</span>
          <div>
            <div
              className="ovl-swatches"
              role="group"
              aria-label="Highlight color"
            >
              {HIGHLIGHT_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`ovl-swatch${option.key === highlight.key ? ' active' : ''}`}
                  style={{ background: option.swatch }}
                  aria-label={option.label}
                  aria-pressed={option.key === highlight.key}
                  title={option.label}
                  onClick={() => pickHighlight(option.key)}
                />
              ))}
            </div>
            <span className="ovl-toolbar-divider" aria-hidden />
            <div role="group" aria-label="Box style">
              {BOX_MODES.map((mode) => {
                const Icon = mode.icon
                return (
                  <button
                    key={mode.key}
                    type="button"
                    className={`ovl-icon-button${mode.key === boxMode ? ' active' : ''}`}
                    aria-label={mode.label}
                    aria-pressed={mode.key === boxMode}
                    title={mode.label}
                    onClick={() => pickBoxMode(mode.key)}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                )
              })}
            </div>
            {toolbarExtra ? (
              <>
                <span className="ovl-toolbar-divider" aria-hidden />
                {toolbarExtra}
              </>
            ) : null}
            <span className="ovl-toolbar-divider" aria-hidden />
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
              aria-label="Fit width"
              title="Fit width"
              onClick={fitWidth}
            >
              <StretchHorizontal className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="ovl-icon-button"
              aria-label="Fit page"
              title="Fit whole page"
              onClick={fitPage}
            >
              <Maximize className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              className="ovl-icon-button"
              aria-label="Zoom out"
              title="Zoom out (⌘ + scroll also zooms)"
              onClick={() => applyScale(scaleRef.current / ZOOM_STEP)}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <b>{Math.round(scale * 100)}%</b>
            <button
              type="button"
              className="ovl-icon-button"
              aria-label="Zoom in"
              title="Zoom in (⌘ + scroll also zooms)"
              onClick={() => applyScale(scaleRef.current * ZOOM_STEP)}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="ovl-scroll" ref={attachScroller}>
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
                  style={{ width: BASE_PAGE_WIDTH * scale }}
                  onLoad={(e) => {
                    const img = e.currentTarget
                    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                      setPageDims((prev) =>
                        prev ? prev : { w: img.naturalWidth, h: img.naturalHeight },
                      )
                    }
                  }}
                />
                {localized
                  .filter((f) => f.page === 1)
                  .map((field) => renderBox(field, 0))}
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
                        width={BASE_PAGE_WIDTH * scale}
                        rotate={(inherent + extraRotation) % 360}
                        renderAnnotationLayer={false}
                        renderTextLayer={false}
                        loading={<div className="ovl-state">Loading page…</div>}
                        onLoadSuccess={(page: {
                          rotate: number
                          originalWidth: number
                          originalHeight: number
                        }) => {
                          setInherentRotation((prev) =>
                            prev[pageNumber] === page.rotate
                              ? prev
                              : { ...prev, [pageNumber]: page.rotate },
                          )
                          if (pageNumber === 1) {
                            setPageDims((prev) =>
                              prev
                                ? prev
                                : {
                                    w: page.originalWidth,
                                    h: page.originalHeight,
                                  },
                            )
                          }
                        }}
                      />
                      {localized
                        .filter((f) => f.page === pageNumber)
                        .map((field) => renderBox(field, extraRotation))}
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

type DragState = {
  mode: 'move' | 'resize'
  pointerId: number
  startX: number
  startY: number
  /** Displayed (rotated) rect at drag start. */
  orig: NormalizedRect
  /** Live displayed rect while dragging. */
  live: NormalizedRect
  pageWidth: number
  pageHeight: number
}

function moveRect(orig: NormalizedRect, dx: number, dy: number): NormalizedRect {
  return clampRectToPage({ ...orig, x: orig.x + dx, y: orig.y + dy })
}

function resizeRect(
  orig: NormalizedRect,
  dx: number,
  dy: number,
): NormalizedRect {
  return {
    x: orig.x,
    y: orig.y,
    width: Math.min(1 - orig.x, Math.max(0.005, orig.width + dx)),
    height: Math.min(1 - orig.y, Math.max(0.005, orig.height + dy)),
  }
}

function OverlayBox({
  field,
  extraRotation,
  selected,
  onSelect,
  editedRect,
  editable,
  onCommit,
}: {
  field: ExtractionOverlayField
  extraRotation: number
  selected: boolean
  onSelect: () => void
  /** Pending repositioned rect (base orientation), when the user moved it. */
  editedRect?: NormalizedRect
  editable?: boolean
  onCommit?: (rect: NormalizedRect) => void
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  // Set when the pointer actually moved during the last press, so the click
  // that follows a drag doesn't also fire the select behavior.
  const didDragRef = useRef(false)

  if (!field.rect) return null
  const baseRect = editedRect ?? field.rect
  const rect = drag ? drag.live : rotateRect(baseRect, extraRotation)

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!editable) return
    // Only primary button/touch/pen.
    if (e.button !== 0) return
    // Resize only when the press is near the bottom-right corner of a box
    // that's big enough on screen to have a distinct corner — DocuPipe boxes
    // are often just a few px tall, and on those a corner-handle hit test
    // would swallow every drag. Zooming in makes small boxes resizable.
    const ownBox = e.currentTarget.getBoundingClientRect()
    const nearCorner =
      ownBox.right - e.clientX < 8 && ownBox.bottom - e.clientY < 8
    const bigEnough = ownBox.width > 24 && ownBox.height > 16
    const mode: DragState['mode'] =
      nearCorner && bigEnough ? 'resize' : 'move'
    const pageEl = e.currentTarget.offsetParent
    if (!(pageEl instanceof HTMLElement)) return
    const pageBox = pageEl.getBoundingClientRect()
    if (pageBox.width === 0 || pageBox.height === 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    didDragRef.current = false
    const displayed = rotateRect(baseRect, extraRotation)
    setDrag({
      mode,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      orig: displayed,
      live: displayed,
      pageWidth: pageBox.width,
      pageHeight: pageBox.height,
    })
  }

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const pxX = e.clientX - drag.startX
    const pxY = e.clientY - drag.startY
    if (
      !didDragRef.current &&
      Math.abs(pxX) < DRAG_THRESHOLD_PX &&
      Math.abs(pxY) < DRAG_THRESHOLD_PX
    ) {
      return
    }
    didDragRef.current = true
    const dx = pxX / drag.pageWidth
    const dy = pxY / drag.pageHeight
    setDrag({
      ...drag,
      live:
        drag.mode === 'move'
          ? moveRect(drag.orig, dx, dy)
          : resizeRect(drag.orig, dx, dy),
    })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    if (didDragRef.current && onCommit) {
      onCommit(clampRectToPage(unrotateRect(drag.live, extraRotation)))
    }
    setDrag(null)
  }

  return (
    <button
      type="button"
      id={boxDomId(field.path)}
      className={`ovl-mark${selected ? ' selected' : ''}${editedRect ? ' edited' : ''}${editable ? ' editable' : ''}${drag ? ' dragging' : ''}`}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      }}
      title={
        editable
          ? `${field.label}: ${formatFieldValue(field)} — drag to move, corner to resize`
          : `${field.label}: ${formatFieldValue(field)}`
      }
      aria-label={`${field.label} extracted here`}
      onClick={() => {
        // A drag ends with a synthetic click on the same element; only a
        // clean press-and-release should select.
        if (didDragRef.current) {
          didDragRef.current = false
          return
        }
        onSelect()
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      {editable ? (
        <span className="ovl-resize-handle" data-resize aria-hidden />
      ) : null}
    </button>
  )
}
