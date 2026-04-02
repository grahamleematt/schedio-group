import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRight, Expand, FileStack } from 'lucide-react'
import type { DocumentRecord } from '#/lib/mock-data'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { cn } from '#/lib/utils'

const PdfPreviewClient = lazy(() =>
  import('#/components/pdf-preview-client').then((module) => ({
    default: module.PdfPreviewClient,
  })),
)

type PdfPreviewPanelProps = {
  title: string
  description?: string
  document?: DocumentRecord
  tone?: 'light' | 'dark'
  compact?: boolean
  maxWidth: number
  allowReset?: boolean
  actions?: ReactNode
  hideViewer?: boolean
}

export function PdfPreviewPanel({
  title,
  description,
  document,
  tone = 'light',
  compact = false,
  maxWidth,
  allowReset = false,
  actions,
  hideViewer = false,
}: PdfPreviewPanelProps) {
  const isDark = tone === 'dark'
  const isClient = useIsClient()
  const previewUnavailable = !document?.previewAsset
  const [resolvedPageCount, setResolvedPageCount] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const pageCountLabel = document
    ? `${resolvedPageCount ?? document.pageCount} pages`
    : 'Unknown'

  return (
    <>
      <section
        className={cn(
          'flex flex-col rounded-3xl border px-5 py-5 sm:px-6 sm:py-6',
          isDark
            ? 'border-border-strong bg-surface-muted'
            : 'border-border-strong bg-surface-panel',
        )}
      >
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <p
              className={cn(
                'ops-label',
                isDark ? 'text-white/62' : 'text-text-accent',
              )}
            >
              {title}
            </p>
            {description ? (
              <p
                className={cn(
                  'text-sm leading-6',
                  isDark ? 'text-white/74' : 'text-text-muted',
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {actions}
            {document ? (
              <a
                href={document.igniteUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({
                    variant: 'outline',
                    size: compact ? 'sm' : 'default',
                  }),
                  isDark
                    ? 'rounded-full border-white/15 bg-white/8 text-white no-underline hover:bg-white/12'
                    : 'h-8 rounded-full border-border-base bg-surface-panel text-xs text-text-strong no-underline',
                )}
              >
                Open in Egnyte
                <ArrowUpRight className="size-3.5" />
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pb-4 pt-2 sm:grid-cols-2">
          <PreviewField
            tone={tone}
            label="Original filename"
            value={document?.originalName ?? 'Unknown'}
          />
          <PreviewField
            tone={tone}
            label="Governed name"
            value={document?.organizedName ?? 'Unknown'}
          />
          <PreviewField
            tone={tone}
            label="Source"
            value={document?.source ?? 'Unknown'}
          />
          <PreviewField tone={tone} label="Page count" value={pageCountLabel} />
        </div>

        {!hideViewer && (
          <div className="min-w-0 flex-1">
            {previewUnavailable ? (
              <PreviewUnavailable isDark={isDark} />
            ) : !isClient ? (
              <PreviewSkeleton isDark={isDark} />
            ) : (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setModalOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setModalOpen(true)
                    }
                  }}
                  className={cn(
                    'group relative max-h-[420px] cursor-pointer overflow-hidden rounded-[1.35rem] border',
                    isDark
                      ? 'border-white/12 bg-[rgba(19,24,33,0.96)]'
                      : 'border-border-base bg-surface-subtle',
                  )}
                >
                  <Suspense fallback={<PreviewSkeleton isDark={isDark} />}>
                    <PdfPreviewClient
                      file={document.previewAsset!.src}
                      tone={tone}
                      compact
                      maxWidth={maxWidth}
                      allowReset={false}
                      onPageCountChange={setResolvedPageCount}
                    />
                  </Suspense>
                  <div className="absolute inset-x-0 bottom-0 flex h-16 items-end justify-center bg-linear-to-t from-white/90 to-transparent pb-3 opacity-0 transition-opacity group-hover:opacity-100 dark:from-black/80">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-text-strong shadow-md">
                      <Expand className="size-3.5" />
                      Click to view full document
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {document?.previewAsset && isClient ? (
        <PdfFullscreenModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          document={document}
          allowReset={allowReset}
        />
      ) : null}
    </>
  )
}

function PdfFullscreenModal({
  open,
  onOpenChange,
  document,
  allowReset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: DocumentRecord
  allowReset: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-none">
        <DialogHeader className="flex-row items-center justify-between gap-4 border-b border-border-base px-6 py-4">
          <div className="min-w-0">
            <DialogTitle className="truncate font-ops text-sm font-semibold text-text-strong">
              {document.organizedName}
            </DialogTitle>
            <DialogDescription className="mt-1 truncate text-xs text-text-muted">
              {document.originalName}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6">
          <Suspense
            fallback={
              <div className="flex min-h-[400px] items-center justify-center text-sm text-text-muted">
                Loading document...
              </div>
            }
          >
            <PdfPreviewClient
              file={document.previewAsset!.src}
              tone="light"
              compact={false}
              maxWidth={1600}
              allowReset={allowReset}
            />
          </Suspense>
        </div>
        <div className="flex items-center justify-between border-t border-border-base px-6 py-3">
          <p className="text-xs text-text-muted">
            {document.pageCount} pages • {document.source}
          </p>
          <div className="flex gap-2">
            {document.igniteUrl ? (
              <a
                href={document.igniteUrl}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'rounded-full border-border-base bg-surface-panel text-text-strong no-underline',
                )}
              >
                Open in Egnyte
                <ArrowUpRight className="size-3.5" />
              </a>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function PreviewField({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'light' | 'dark'
}) {
  return (
    <div className="space-y-1">
      <p
        className={cn(
          'ops-label',
          tone === 'dark' ? 'text-white/62' : 'text-text-accent',
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'text-sm font-semibold leading-6',
          tone === 'dark' ? 'text-white' : 'text-text-strong',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function PreviewUnavailable({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={cn(
        'flex min-h-[280px] flex-col items-center justify-center rounded-[1.35rem] border border-dashed px-6 text-center',
        isDark
          ? 'border-white/15 bg-white/4 text-white/72'
          : 'border-border-base bg-surface-muted text-text-muted',
      )}
    >
      <FileStack className="size-5" />
      <p className="mt-3 text-sm font-semibold">Preview unavailable locally</p>
      <p className="mt-2 text-sm leading-6">
        This record can still be opened in Egnyte, but the mock does not include
        a local PDF asset for it yet.
      </p>
    </div>
  )
}

function PreviewSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div
      className={cn(
        'min-h-[320px] rounded-[1.35rem] border border-dashed px-6 py-8 text-sm',
        isDark
          ? 'border-white/15 bg-white/4 text-white/72'
          : 'border-border-base bg-surface-subtle text-text-muted',
      )}
    >
      <div className="space-y-3">
        <div
          className={cn(
            'h-4 w-40 rounded-full',
            isDark ? 'bg-white/12' : 'bg-primary-soft',
          )}
        />
        <div
          className={cn(
            'h-[280px] rounded-2xl',
            isDark ? 'bg-white/8' : 'bg-white',
          )}
        />
      </div>
    </div>
  )
}
