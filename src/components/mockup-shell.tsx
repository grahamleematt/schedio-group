import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

type MockupTone = 'operations' | 'review'

const toneClasses: Record<MockupTone, string> = {
  operations: 'surface-operations',
  review: 'surface-review-hero',
}

const titleClasses: Record<MockupTone, string> = {
  operations:
    'font-ops text-[1.6rem] font-semibold tracking-[-0.04em] sm:text-[2rem]',
  review:
    'font-ops text-[1.6rem] font-semibold tracking-[-0.04em] sm:text-[2rem]',
}

const descriptionClasses: Record<MockupTone, string> = {
  operations: 'font-ops max-w-3xl text-sm leading-6 text-text-base',
  review: 'font-ops max-w-3xl text-sm leading-6 text-text-muted',
}

type MockupShellProps = {
  meta: string
  title: string
  description?: string
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
          'brand-panel overflow-hidden rounded-2xl px-5 py-4 sm:px-6 sm:py-5',
          toneClasses[tone],
        )}
      >
        <div className="route-grid items-start">
          <div className="space-y-3">
            <p
              className={cn(
                tone === 'operations' ? 'ops-label' : 'eyebrow',
                'text-text-accent',
              )}
            >
              {meta}
            </p>
            <div className="space-y-1.5">
              <h1
                className={cn(
                  'max-w-4xl leading-[1.08] text-text-strong',
                  titleClasses[tone],
                )}
              >
                {title}
              </h1>
              {description ? (
                <p className={descriptionClasses[tone]}>{description}</p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex flex-wrap gap-3">{actions}</div>
            ) : null}
          </div>

          {aside ? (
            <aside
              className={cn(
                'rounded-[1.5rem] border border-border-strong bg-[rgba(255,255,255,0.88)] p-5 shadow-sm text-text-base',
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
