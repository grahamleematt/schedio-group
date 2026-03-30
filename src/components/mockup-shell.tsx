import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type MockupTone = 'trust' | 'operations' | 'review'

const toneClasses: Record<MockupTone, string> = {
  trust: 'surface-trust',
  operations: 'surface-operations',
  review: 'surface-review',
}

const titleClasses: Record<MockupTone, string> = {
  trust: 'font-heading text-[2.1rem] font-bold tracking-[-0.045em] sm:text-[2.65rem]',
  operations:
    'font-ops text-[2.15rem] font-semibold tracking-[-0.055em] sm:text-[2.8rem]',
  review:
    'font-heading text-[2.1rem] font-bold tracking-[-0.045em] sm:text-[2.65rem]',
}

const descriptionClasses: Record<MockupTone, string> = {
  trust: 'max-w-3xl text-sm leading-6 text-[var(--brand-muted)] sm:text-base',
  operations:
    'font-ops max-w-3xl text-sm leading-6 text-[var(--brand-text)] sm:text-base',
  review: 'max-w-3xl text-sm leading-6 text-white/76 sm:text-base',
}

type MockupShellProps = {
  meta: string
  title: string
  description: string
  tone: MockupTone
  actions?: ReactNode
  aside?: ReactNode
  children: ReactNode
}

export function MockupShell({
  meta,
  title,
  description,
  tone,
  actions,
  aside,
  children,
}: MockupShellProps) {
  return (
    <main className="page-wrap page-frame">
      <section
        className={cn(
          'brand-panel overflow-hidden rounded-[2rem] px-5 py-5 sm:px-7 sm:py-6',
          toneClasses[tone]
        )}
      >
        <div className="route-grid items-start">
          <div className="space-y-4">
            <p
              className={cn(
                tone === 'operations' ? 'ops-label' : 'eyebrow',
                tone === 'review' ? 'text-white/70' : 'text-[var(--brand-blue)]'
              )}
            >
              {meta}
            </p>
            <div className="space-y-2">
              <h1
                className={cn(
                  'max-w-4xl leading-[1.02]',
                  titleClasses[tone],
                  tone === 'review' ? 'text-white' : 'text-[var(--brand-slate)]'
                )}
              >
                {title}
              </h1>
              <p className={descriptionClasses[tone]}>{description}</p>
            </div>
            {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
          </div>

          {aside ? (
            <aside
              className={cn(
                'rounded-[1.5rem] border p-5 shadow-sm',
                tone === 'review'
                  ? 'border-white/12 bg-white/8 text-white'
                  : tone === 'operations'
                    ? 'border-[rgba(0,61,166,0.14)] bg-white/88 text-[var(--brand-text)]'
                    : 'border-[var(--brand-border)] bg-white/82 text-[var(--brand-text)]'
              )}
            >
              {aside}
            </aside>
          ) : null}
        </div>
      </section>

      <div className="section-stack">{children}</div>
    </main>
  )
}
