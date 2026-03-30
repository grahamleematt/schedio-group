import { useState } from 'react'
import { ChevronLeft, ChevronRight, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

const MIN_SCALE = 0.75
const MAX_SCALE = 1.75
const SCALE_STEP = 0.25

type PdfPreviewClientProps = {
  file: string
  maxWidth: number
  tone?: 'light' | 'dark'
  allowReset?: boolean
  compact?: boolean
  onPageCountChange?: (pageCount: number) => void
}

function getPreviewWidth(maxWidth: number) {
  if (typeof window === 'undefined') {
    return maxWidth
  }

  return Math.max(260, Math.min(maxWidth, window.innerWidth - 48))
}

export function PdfPreviewClient({
  file,
  maxWidth,
  tone = 'light',
  allowReset = false,
  compact = false,
  onPageCountChange,
}: PdfPreviewClientProps) {
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)

  const width = getPreviewWidth(maxWidth)
  const canGoBack = pageNumber > 1
  const canGoForward = numPages !== null && pageNumber < numPages

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex flex-wrap items-center gap-2 rounded-[1.25rem] border px-3 py-3',
          tone === 'dark'
            ? 'border-white/12 bg-white/6'
            : 'border-[var(--brand-border)] bg-[rgba(0,61,166,0.03)]'
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn(
            tone === 'dark'
              ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
              : 'border-[var(--brand-border)] bg-white text-[var(--brand-slate)]'
          )}
          onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
          disabled={!canGoBack}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className={cn(
            tone === 'dark'
              ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
              : 'border-[var(--brand-border)] bg-white text-[var(--brand-slate)]'
          )}
          onClick={() =>
            setPageNumber((current) =>
              numPages === null ? current : Math.min(numPages, current + 1)
            )
          }
          disabled={!canGoForward}
        >
          <ChevronRight className="size-4" />
        </Button>
        <span
          className={cn(
            'min-w-[88px] text-center text-xs font-semibold tracking-[0.08em] uppercase',
            tone === 'dark' ? 'text-white/72' : 'text-[var(--brand-muted)]'
          )}
        >
          Page {pageNumber}
          {numPages !== null ? ` / ${numPages}` : ''}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn(
              tone === 'dark'
                ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
                : 'border-[var(--brand-border)] bg-white text-[var(--brand-slate)]'
            )}
            onClick={() => setScale((current) => Math.max(MIN_SCALE, current - SCALE_STEP))}
            disabled={scale <= MIN_SCALE}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span
            className={cn(
              'min-w-[56px] text-center text-xs font-semibold',
              tone === 'dark' ? 'text-white/72' : 'text-[var(--brand-muted)]'
            )}
          >
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={cn(
              tone === 'dark'
                ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
                : 'border-[var(--brand-border)] bg-white text-[var(--brand-slate)]'
            )}
            onClick={() => setScale((current) => Math.min(MAX_SCALE, current + SCALE_STEP))}
            disabled={scale >= MAX_SCALE}
          >
            <ZoomIn className="size-4" />
          </Button>
          {allowReset ? (
            <Button
              type="button"
              variant="outline"
              size={compact ? 'sm' : 'default'}
              className={cn(
                tone === 'dark'
                  ? 'border-white/15 bg-white/8 text-white hover:bg-white/12'
                  : 'border-[var(--brand-border)] bg-white text-[var(--brand-slate)]'
              )}
              onClick={() => {
                setPageNumber(1)
                setScale(1)
              }}
            >
              <RotateCcw className="size-4" />
              Reset
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'overflow-auto rounded-[1.5rem] border px-3 py-3 sm:px-4 sm:py-4',
          tone === 'dark'
            ? 'border-white/12 bg-[rgba(19,24,33,0.96)]'
            : 'border-[var(--brand-border)] bg-[rgba(244,247,252,0.92)]'
        )}
      >
        <Document
          file={file}
          loading={<PreviewStatus tone={tone} label="Loading PDF preview" />}
          noData={<PreviewStatus tone={tone} label="No PDF selected" />}
          onLoadSuccess={(pdf) => {
            setNumPages(pdf.numPages)
            setPageNumber(1)
            setLoadError(null)
            onPageCountChange?.(pdf.numPages)
          }}
          onLoadError={(error) => setLoadError(error.message)}
        >
          {loadError ? (
            <PreviewStatus tone={tone} label={loadError} isError />
          ) : (
            <div className="flex justify-center">
              <Page
                pageNumber={pageNumber}
                width={width}
                scale={scale}
                renderAnnotationLayer
                renderTextLayer
                loading=""
                className="overflow-hidden rounded-[1rem] shadow-[0_18px_48px_rgba(15,23,42,0.16)]"
              />
            </div>
          )}
        </Document>
      </div>
    </div>
  )
}

function PreviewStatus({
  tone,
  label,
  isError = false,
}: {
  tone: 'light' | 'dark'
  label: string
  isError?: boolean
}) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] items-center justify-center rounded-[1.15rem] border border-dashed px-6 text-center text-sm leading-6',
        tone === 'dark'
          ? isError
            ? 'border-rose-300/30 bg-rose-500/8 text-rose-100'
            : 'border-white/15 bg-white/4 text-white/72'
          : isError
            ? 'border-rose-200 bg-rose-50 text-rose-700'
            : 'border-[var(--brand-border)] bg-white text-[var(--brand-muted)]'
      )}
    >
      {label}
    </div>
  )
}
