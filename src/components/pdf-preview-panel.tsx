import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRight, FileStack } from 'lucide-react'
import type { DocumentRecord } from '#/lib/mock-data'
import { buttonVariants } from '#/components/ui/button'
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
}: PdfPreviewPanelProps & { hideViewer?: boolean }) {
  const isDark = tone === 'dark'
  const isClient = useIsClient()
  const previewUnavailable = !document?.previewAsset
  const [resolvedPageCount, setResolvedPageCount] = useState<number | null>(
    null,
  )
  const pageCountLabel = document
    ? `${resolvedPageCount ?? document.pageCount} pages`
    : 'Unknown'

  return (
    <section
      className={cn(
        'space-y-0 rounded-3xl border px-5 py-5 sm:px-6 sm:py-6',
        isDark
          ? 'border-border-strong bg-surface-muted'
          : 'border-border-strong bg-surface-panel',
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-4">
        <div className="space-y-2">
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
        <div className="flex flex-wrap gap-2">
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
                  : 'rounded-full border-border-base bg-surface-panel text-text-strong no-underline text-xs h-8',
              )}
            >
              Open in Egnyte
              <ArrowUpRight className="size-3.5" />
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 pt-2 pb-4">
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
        <>
          {previewUnavailable ? (
            <div
              className={cn(
                'flex min-h-[280px] flex-col items-center justify-center rounded-[1.35rem] border border-dashed px-6 text-center',
                isDark
                  ? 'border-white/15 bg-white/4 text-white/72'
                  : 'border-border-base bg-surface-muted text-text-muted',
              )}
            >
              <FileStack className="size-5" />
              <p className="mt-3 text-sm font-semibold">
                Preview unavailable locally
              </p>
              <p className="mt-2 text-sm leading-6">
                This record can still be opened in Egnyte, but the mock does not
                include a local PDF asset for it yet.
              </p>
            </div>
          ) : !isClient ? (
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
          ) : (
            <Suspense
              fallback={
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
              }
            >
              <PdfPreviewClient
                file={document.previewAsset!.src}
                tone={tone}
                compact={compact}
                maxWidth={maxWidth}
                allowReset={allowReset}
                onPageCountChange={setResolvedPageCount}
              />
            </Suspense>
          )}
        </>
      )}
    </section>
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
