import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ArrowLeftRight } from 'lucide-react'
import { cn } from '#/lib/utils'
import { workflowConfigs } from '#/lib/sg-dream'
import type { Workflow } from '#/lib/sg-dream'

type WorkflowChromeProps = {
  workflow: Workflow
  eyebrow: string
  title: string
  description?: string
  actions?: ReactNode
  aside?: ReactNode
  children: ReactNode
  /** Optional current entity name. When supplied, a persistent
   *  "Not {entityName}? Switch entity" link is rendered so users
   *  can always undo a wrong-entity selection without hunting. */
  entityName?: string
}

export function WorkflowChrome({
  workflow,
  eyebrow,
  title,
  description,
  actions,
  aside,
  children,
  entityName,
}: WorkflowChromeProps) {
  const config = workflowConfigs[workflow]

  return (
    <main data-workflow={workflow} className="page-wrap page-frame">
      <section
        className={cn(
          'brand-panel overflow-hidden rounded-2xl px-5 py-5 sm:px-7 sm:py-6',
        )}
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.9)), var(--color-surface-panel)',
          borderColor: 'var(--wf-border)',
        }}
      >
        <div
          className={cn(
            'flex flex-col gap-6',
            aside &&
              'lg:grid lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:items-start',
          )}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="workflow-pill">
                <span
                  aria-hidden
                  className="inline-block size-1.5 rounded-full"
                  style={{ background: 'var(--wf-base)' }}
                />
                {config.label}
              </span>
              <p className="ops-label m-0">{eyebrow}</p>
              {entityName ? (
                <Link
                  to="/clients"
                  search={{ selected: undefined }}
                  className="inline-flex items-center gap-1 rounded-full border bg-white/80 px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em] no-underline"
                  style={{
                    borderColor: 'var(--color-border-base)',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  <ArrowLeftRight className="size-3" aria-hidden />
                  Not {entityName}? Switch entity
                </Link>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <h1 className="font-ops text-[1.55rem] font-semibold leading-[1.1] tracking-[-0.03em] text-text-strong sm:text-[1.95rem]">
                {title}
              </h1>
              {description ? (
                <p className="max-w-3xl text-sm leading-6 text-text-muted">
                  {description}
                </p>
              ) : null}
            </div>

            {actions ? (
              <div className="flex flex-wrap gap-3 pt-1">{actions}</div>
            ) : null}
          </div>

          {aside ? (
            <aside
              className="rounded-[1.25rem] border bg-white/90 p-5 text-sm text-text-base shadow-sm"
              style={{ borderColor: 'var(--wf-border)' }}
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
