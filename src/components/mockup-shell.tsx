import type { ReactNode } from 'react'
import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

type MockupTone = 'trust' | 'operations' | 'review'

const toneClasses: Record<MockupTone, string> = {
  trust: 'surface-trust',
  operations: 'surface-operations',
  review: 'surface-review',
}

const titleClasses: Record<MockupTone, string> = {
  trust:
    'font-heading text-4xl font-extrabold tracking-[-0.045em] sm:text-[3.55rem]',
  operations:
    'font-ops text-[2.55rem] font-semibold tracking-[-0.055em] sm:text-[3.45rem]',
  review:
    'font-heading text-4xl font-extrabold tracking-[-0.045em] sm:text-[3.35rem]',
}

const descriptionClasses: Record<MockupTone, string> = {
  trust: 'max-w-3xl text-base leading-7 sm:text-lg',
  operations:
    'font-ops ops-hero-copy max-w-3xl text-[1.02rem] leading-7 sm:text-[1.1rem]',
  review: 'max-w-3xl text-base leading-7 sm:text-lg',
}

type MockupShellProps = {
  label: string
  title: string
  description: string
  tone: MockupTone
  badges?: string[]
  sidebar?: ReactNode
  children: ReactNode
}

export function MockupShell({
  label,
  title,
  description,
  tone,
  badges = [],
  sidebar,
  children,
}: MockupShellProps) {
  return (
    <main className="page-wrap page-frame">
      <section
        className={cn(
          'brand-panel overflow-hidden rounded-[2rem] px-5 py-5 sm:px-8 sm:py-8',
          toneClasses[tone]
        )}
      >
        <div className="route-grid items-start">
          <div className="space-y-4">
            <div className="eyebrow">
              <span className="size-2 rounded-full bg-[var(--brand-blue)]" />
              {label}
            </div>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge) => (
                <Badge
                  key={badge}
                  variant="secondary"
                  className={cn(
                    'border px-3 py-1 text-[0.7rem] tracking-[0.12em] uppercase',
                    tone === 'operations' ? 'rounded-xl font-mono' : 'rounded-full',
                    tone === 'review'
                      ? 'border-white/14 bg-white/10 text-white'
                      : 'border-[var(--brand-border)] bg-white/80 text-[var(--brand-slate)]'
                  )}
                >
                  {badge}
                </Badge>
              ))}
            </div>
            <div className="space-y-3">
              <h1
                className={cn(
                  'max-w-4xl leading-[1.02]',
                  titleClasses[tone],
                  tone === 'review' ? 'text-white' : 'text-[var(--brand-slate)]'
                )}
              >
                {title}
              </h1>
              <p
                className={cn(
                  descriptionClasses[tone],
                  tone === 'review' ? 'text-white/78' : 'text-[var(--brand-muted)]'
                )}
              >
                {description}
              </p>
            </div>
          </div>

          {sidebar ? (
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
              {sidebar}
            </aside>
          ) : null}
        </div>
      </section>

      <div className="section-stack">{children}</div>
    </main>
  )
}
