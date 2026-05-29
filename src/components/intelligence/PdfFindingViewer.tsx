import { Highlighter, Minus, Plus } from 'lucide-react'
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react'
import { useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import type {
  FindingAnchorType,
  FindingRect,
  IntelligenceDocument,
  IntelligenceFinding,
} from '#/server/intelligence/types'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MIN_PDF_SCALE = 0.64
const MAX_PDF_SCALE = 3

export type PdfDraftFinding = {
  documentId: string
  segmentId?: string
  pageNumber: number
  anchorType: Extract<FindingAnchorType, 'point' | 'rect'>
  normalizedRects: ReadonlyArray<FindingRect>
  selectedText?: string
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function rectFromPoints(
  start: { x: number; y: number },
  end: { x: number; y: number },
): FindingRect {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  return {
    x,
    y,
    width: Math.max(Math.abs(end.x - start.x), 0),
    height: Math.max(Math.abs(end.y - start.y), 0),
  }
}

function pointRect(point: { x: number; y: number }): FindingRect {
  const size = 0.028
  const half = size / 2
  const x = clamp01(point.x - half)
  const y = clamp01(point.y - half)
  return {
    x,
    y,
    width: Math.min(size, 1 - x),
    height: Math.min(size, 1 - y),
  }
}

function normalizedRectStyle(rect: FindingRect): CSSProperties {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
  }
}

export default function PdfFindingViewer(input: {
  doc: IntelligenceDocument
  fileUrl: string
  findings: ReadonlyArray<IntelligenceFinding>
  draftFinding: PdfDraftFinding | null
  selectedFindingId?: string
  selectedSegmentId?: string
  onDraftFinding: (finding: PdfDraftFinding | null) => void
  onSelectFinding: (findingId: string) => void
}) {
  const [pageCount, setPageCount] = useState(0)
  const [scale, setScale] = useState(0.78)

  return (
    <div className="intel-pdf-viewer">
      <div className="intel-pdf-toolbar">
        <span>
          <Highlighter className="size-4" aria-hidden />
          Mark findings on the document
        </span>
        <div>
          <button
            type="button"
            className="intel-icon-button"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={() =>
              setScale((value) => Math.max(MIN_PDF_SCALE, value - 0.1))
            }
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <b>{Math.round(scale * 100)}%</b>
          <button
            type="button"
            className="intel-icon-button"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={() =>
              setScale((value) => Math.min(MAX_PDF_SCALE, value + 0.1))
            }
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="intel-pdf-scroll">
        <Document
          file={input.fileUrl}
          loading={<div className="intel-pdf-state">Loading PDF</div>}
          error={<div className="intel-pdf-state">PDF failed to load</div>}
          onLoadSuccess={({ numPages }: { numPages: number }) =>
            setPageCount(numPages)
          }
        >
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1
            return (
              <FindingPage
                key={pageNumber}
                doc={input.doc}
                pageNumber={pageNumber}
                scale={scale}
                findings={input.findings.filter(
                  (finding) => finding.pageNumber === pageNumber,
                )}
                draftFinding={
                  input.draftFinding?.pageNumber === pageNumber
                    ? input.draftFinding
                    : null
                }
                selectedFindingId={input.selectedFindingId}
                selectedSegmentId={input.selectedSegmentId}
                onDraftFinding={input.onDraftFinding}
                onSelectFinding={input.onSelectFinding}
              />
            )
          })}
        </Document>
      </div>
    </div>
  )
}

function FindingPage(input: {
  doc: IntelligenceDocument
  pageNumber: number
  scale: number
  findings: ReadonlyArray<IntelligenceFinding>
  draftFinding: PdfDraftFinding | null
  selectedFindingId?: string
  selectedSegmentId?: string
  onDraftFinding: (finding: PdfDraftFinding | null) => void
  onSelectFinding: (findingId: string) => void
}) {
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  )
  const [dragCurrent, setDragCurrent] = useState<{
    x: number
    y: number
  } | null>(null)

  const pagePoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp01((event.clientX - bounds.left) / bounds.width),
      y: clamp01((event.clientY - bounds.top) / bounds.height),
    }
  }

  const dragRect =
    dragStart && dragCurrent ? rectFromPoints(dragStart, dragCurrent) : null

  const finishDraft = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!dragStart) return
    const current = pagePoint(event)
    const rect = rectFromPoints(dragStart, current)
    const isPoint = rect.width < 0.012 && rect.height < 0.012
    const selectedText =
      typeof window === 'undefined'
        ? ''
        : window.getSelection()?.toString().trim()
    input.onDraftFinding({
      documentId: input.doc.id,
      segmentId: input.selectedSegmentId,
      pageNumber: input.pageNumber,
      anchorType: isPoint ? 'point' : 'rect',
      normalizedRects: [isPoint ? pointRect(current) : rect],
      selectedText: selectedText || undefined,
    })
    setDragStart(null)
    setDragCurrent(null)
  }

  return (
    <article className="intel-pdf-page-shell">
      <div className="intel-pdf-page-label">Page {input.pageNumber}</div>
      <div className="intel-pdf-page">
        <Page
          pageNumber={input.pageNumber}
          width={760 * input.scale}
          renderAnnotationLayer
          renderTextLayer
          loading={<div className="intel-pdf-state">Loading page</div>}
        />
        <div
          className="intel-finding-layer"
          onMouseDown={(event) => {
            const point = pagePoint(event)
            setDragStart(point)
            setDragCurrent(point)
          }}
          onMouseMove={(event) => {
            if (!dragStart) return
            setDragCurrent(pagePoint(event))
          }}
          onMouseUp={finishDraft}
          onMouseLeave={() => {
            setDragStart(null)
            setDragCurrent(null)
          }}
        >
          {input.findings.map((finding) =>
            finding.normalizedRects.map((rect, index) => {
              const selected = finding.id === input.selectedFindingId
              return (
                <button
                  type="button"
                  className={`intel-finding-mark${
                    finding.anchorType === 'point' ? ' point' : ''
                  }${selected ? ' selected' : ''}`}
                  style={normalizedRectStyle(rect)}
                  data-finding-mark-id={finding.id}
                  key={`${finding.id}-${index}`}
                  title={finding.rationale}
                  aria-label={`Use ${finding.label} as evidence`}
                  aria-pressed={selected}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    input.onSelectFinding(finding.id)
                  }}
                >
                  <span>{finding.label}</span>
                </button>
              )
            }),
          )}

          {input.draftFinding?.normalizedRects.map((rect, index) => (
            <div
              className={`intel-finding-draft${
                input.draftFinding?.anchorType === 'point' ? ' point' : ''
              }`}
              style={normalizedRectStyle(rect)}
              key={`draft-${index}`}
            />
          ))}

          {dragRect ? (
            <div
              className="intel-finding-drag"
              style={normalizedRectStyle(dragRect)}
            />
          ) : null}
        </div>
      </div>
    </article>
  )
}
