import type { ReactNode } from 'react'
import { Upload, WandSparkles } from 'lucide-react'
import { Button } from '#/components/ui/button'
import { cn } from '#/lib/utils'

type UploadDropzoneProps = {
  kicker?: string
  title: string
  subtitle: string
  points: string[]
  primaryActionLabel?: string
  secondaryActionLabel?: string
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  tone?: 'trust' | 'operations'
}

export function UploadDropzone({
  kicker = 'New submission',
  title,
  subtitle,
  points,
  primaryActionLabel = 'Add files',
  secondaryActionLabel = 'View requirements',
  primaryAction,
  secondaryAction,
  tone = 'trust',
}: UploadDropzoneProps) {
  return (
    <section
      className={cn(
        'rounded-[1.75rem] p-5 sm:p-6',
        tone === 'operations'
          ? 'brand-panel border border-[rgba(0,61,166,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,251,0.96))]'
          : 'brand-panel-muted'
      )}
    >
      <div
        className={cn(
          'rounded-[1.5rem] border bg-white/80 p-6 sm:p-8',
          tone === 'operations'
            ? 'border-[rgba(0,61,166,0.2)]'
            : 'border-dashed border-[rgba(0,61,166,0.28)]'
        )}
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]',
                tone === 'operations'
                  ? 'font-mono rounded-xl bg-[rgba(0,61,166,0.08)]'
                  : 'rounded-full bg-[rgba(0,61,166,0.09)]'
              )}
            >
              <Upload className="size-3.5" />
              {kicker}
            </div>
            <div>
              <h2
                className={cn(
                  'text-[var(--brand-slate)]',
                  tone === 'operations'
                    ? 'font-ops text-[2rem] leading-tight font-semibold tracking-[-0.045em]'
                    : 'font-heading text-2xl font-bold'
                )}
              >
                {title}
              </h2>
              <p
                className={cn(
                  'mt-2 max-w-2xl text-sm leading-6',
                  tone === 'operations'
                    ? 'text-[var(--brand-text)]'
                    : 'text-[var(--brand-muted)]'
                )}
              >
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {primaryAction ?? (
              <Button className="rounded-full bg-[var(--brand-blue)] px-5 text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_85%,black_15%)]">
                {primaryActionLabel}
              </Button>
            )}
            {secondaryAction ?? (
              <Button
                variant="outline"
                className="rounded-full border-[var(--brand-border)] bg-white px-5 text-[var(--brand-slate)]"
              >
                <WandSparkles className="size-4" />
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {points.map((point) => (
            <div
              key={point}
              className={cn(
                'px-4 py-4 text-sm leading-6 text-[var(--brand-text)]',
                tone === 'operations'
                  ? 'rounded-[1.25rem] border-l-4 border border-[var(--brand-border)] border-l-[var(--brand-blue)] bg-[rgba(0,61,166,0.03)]'
                  : 'rounded-2xl border border-[var(--brand-border)] bg-white'
              )}
            >
              {point}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
