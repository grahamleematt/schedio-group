import type { ReactNode } from 'react'
import { UploadCloud, WandSparkles } from 'lucide-react'
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
}: UploadDropzoneProps) {
  return (
    <section
      className={cn(
        'rounded-[1.75rem] p-5 sm:p-6',
        'border border-border-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,251,0.96))]',
      )}
    >
      <div
        className={cn(
          'rounded-[1.5rem] border-2 border-dashed border-border-focus bg-white/80 px-6 py-10 sm:px-8 sm:py-12',
        )}
      >
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-primary-soft">
            <UploadCloud className="size-8 text-text-accent" />
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary-soft px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.12em] text-text-accent">
            {kicker}
          </div>

          <p className="mt-3 font-ops text-sm font-semibold text-text-strong">
            {title}
          </p>

          <h2 className="mt-2 font-ops text-lg font-semibold leading-tight tracking-[-0.03em] text-text-strong">
            Drag and drop files here
          </h2>
          <p className="mt-1 text-sm font-medium text-text-muted">
            or use the button below to browse
          </p>

          <p className="mt-3 max-w-md text-sm leading-6 text-text-base">
            {subtitle}
          </p>

          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {primaryAction ?? (
              <Button className="rounded-full bg-primary px-5 text-primary-foreground hover:bg-primary-hover">
                {primaryActionLabel}
              </Button>
            )}
            {secondaryAction ?? (
              <Button
                variant="outline"
                className="rounded-full border-border-base bg-white px-5 text-text-strong"
              >
                <WandSparkles className="size-4" />
                {secondaryActionLabel}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {points.map((point) => (
          <div
            key={point}
            className="rounded-[1.25rem] border border-border-base bg-surface-muted px-4 py-4 text-sm leading-6 text-text-base"
          >
            {point}
          </div>
        ))}
      </div>
    </section>
  )
}
