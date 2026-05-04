/**
 * SG DREAM AppShell topbar. Sticky-top frosted bar with:
 *   - Breadcrumbs (entity / screen / verification ref)
 *   - Read-only workflow status pill
 *
 * Crumbs are passed in by the page so each route owns its own copy.
 */

import { Workflow } from 'lucide-react'
import type { ReactNode } from 'react'

export type Crumb = {
  label: string
  /** Optional bolded segment (last crumb is usually bold). */
  emphasis?: boolean
}

type TopbarProps = {
  crumbs: ReadonlyArray<Crumb>
  /** Optional right-aligned actions slot. */
  actions?: ReactNode
  workflowLabel: string
}

export function Topbar({ crumbs, actions, workflowLabel }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <span
            key={`${i}-${c.label}`}
            className="inline-flex min-w-0 items-center gap-1.5"
          >
            {c.emphasis ? (
              <b className="truncate">{c.label}</b>
            ) : (
              <span className="truncate">{c.label}</span>
            )}
            {i < crumbs.length - 1 ? <span className="sep">›</span> : null}
          </span>
        ))}
      </div>

      <div className="topbar-spacer" />

      {actions ?? (
        <div className="topbar-status" aria-label="Workspace status">
          <span className="topbar-pill wf">
            <Workflow className="size-3.5" aria-hidden />
            {workflowLabel}
          </span>
        </div>
      )}
    </header>
  )
}
