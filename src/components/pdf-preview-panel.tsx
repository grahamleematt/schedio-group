import { lazy, Suspense, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { ArrowUpRight, FileStack } from 'lucide-react'
import type { DocumentRecord } from '#/lib/mock-data'
import { buttonVariants } from '#/components/ui/button'
import { cn } from '#/lib/utils'

const PdfPreviewClient = lazy(() =>
  import('#/components/pdf-preview-client').then((module) => ({
    default: module.PdfPreviewClient,
  }))
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
}: PdfPreviewPanelProps) {
  const isDark = tone === 'dark'
  const isClient = useIsClient()
  const previewUnavailable = !document?.previewAsset
  const [resolvedPageCount, setResolvedPageCount] = useState<number | null>(null)
  const pageCountLabel = document
    ? `${resolvedPageCount ?? document.pageCount} pages`
    : 'Unknown'

  return (
    <section
      className={cn(
        'space-y-4 rounded-[1.5rem] border px-4 py-4 sm:px-5 sm:py-5',
        isDark
          ? 'border-white/12 bg-white/5'
          : 'border-[var(--brand-border)] bg-white'
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p
            className={cn(
              'text-xs font-semibold tracking-[0.14em] uppercase',
              isDark ? 'text-white/62' : 'text-[var(--brand-blue)]'
            )}
          >
            {title}
          </p>
          {description ? (
            <p
              className={cn(
                'text-sm leading-6',
                isDark ? 'text-white/74' : 'text-[var(--brand-muted)]'
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
                buttonVariants({ variant: 'outline', size: compact ? 'sm' : 'default' }),
                isDark
                  ? 'rounded-full border-white/15 bg-white/8 text-white no-underline hover:bg-white/12'
                  : 'rounded-full border-[var(--brand-border)] bg-white text-[var(--brand-slate)] no-underline'
              )}
            >
              Open in Egnyte
              <ArrowUpRight className="size-4" />
            </a>
          ) : null}
        </div>
      </div>

      <div className={cn('grid gap-3', compact ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4')}>
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
        <PreviewField tone={tone} label="Source" value={document?.source ?? 'Unknown'} />
        <PreviewField
          tone={tone}
          label="Page count"
          value={pageCountLabel}
        />
      </div>

      {previewUnavailable ? (
        <div
          className={cn(
            'flex min-h-[280px] flex-col items-center justify-center rounded-[1.35rem] border border-dashed px-6 text-center',
            isDark
              ? 'border-white/15 bg-white/4 text-white/72'
              : 'border-[var(--brand-border)] bg-[rgba(0,61,166,0.03)] text-[var(--brand-muted)]'
          )}
        >
          <FileStack className="size-5" />
          <p className="mt-3 text-sm font-semibold">
            Preview unavailable locally
          </p>
          <p className="mt-2 text-sm leading-6">
            This record can still be opened in Egnyte, but the mock does not include
            a local PDF asset for it yet.
          </p>
        </div>
      ) : !isClient ? (
        <div
          className={cn(
            'min-h-[320px] rounded-[1.35rem] border border-dashed px-6 py-8 text-sm',
            isDark
              ? 'border-white/15 bg-white/4 text-white/72'
              : 'border-[var(--brand-border)] bg-[rgba(0,61,166,0.03)] text-[var(--brand-muted)]'
          )}
        >
          <div className="space-y-3">
            <div
              className={cn(
                'h-4 w-40 rounded-full',
                isDark ? 'bg-white/12' : 'bg-[rgba(0,61,166,0.08)]'
              )}
            />
            <div
              className={cn(
                'h-[280px] rounded-[1rem]',
                isDark ? 'bg-white/8' : 'bg-white'
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
                  : 'border-[var(--brand-border)] bg-[rgba(0,61,166,0.03)] text-[var(--brand-muted)]'
              )}
            >
              <div className="space-y-3">
                <div
                  className={cn(
                    'h-4 w-40 rounded-full',
                    isDark ? 'bg-white/12' : 'bg-[rgba(0,61,166,0.08)]'
                  )}
                />
                <div
                  className={cn(
                    'h-[280px] rounded-[1rem]',
                    isDark ? 'bg-white/8' : 'bg-white'
                  )}
                />
              </div>
            </div>
          }
        >
          <PdfPreviewClient
            file={document.previewAsset.src}
            tone={tone}
            compact={compact}
            maxWidth={maxWidth}
            allowReset={allowReset}
            onPageCountChange={setResolvedPageCount}
          />
        </Suspense>
      )}
    </section>
  )
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
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
    <div
      className={cn(
        'rounded-[1.15rem] border px-3 py-3',
        tone === 'dark'
          ? 'border-white/12 bg-white/6'
          : 'border-[var(--brand-border)] bg-[rgba(0,61,166,0.03)]'
      )}
    >
      <p
        className={cn(
          'text-[0.7rem] font-semibold tracking-[0.14em] uppercase',
          tone === 'dark' ? 'text-white/62' : 'text-[var(--brand-blue)]'
        )}
      >
        {label}
      </p>
      <p
        className={cn(
          'mt-2 text-sm font-semibold leading-6',
          tone === 'dark' ? 'text-white' : 'text-[var(--brand-slate)]'
        )}
      >
        {value}
      </p>
    </div>
  )
}
