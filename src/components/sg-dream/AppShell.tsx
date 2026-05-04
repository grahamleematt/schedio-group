/**
 * SG DREAM AppShell — wraps every authed route with the v2 sidebar +
 * sticky topbar. Sets `data-workflow` on the root so workflow tokens flip
 * automatically on Developer Reimbursement entities.
 *
 * Reads the active entity from the router-bound mock session so individual
 * routes don't have to re-derive `client` / `verification` for the chrome.
 *
 * Layout (matches v2):
 *   ┌──────────┬──────────────────────────────────────┐
 *   │ Sidebar  │ Topbar                               │
 *   │ 248px    ├──────────────────┬───────────────────┤
 *   │ sticky   │ children         │ rail (320px)      │
 *   │          │                  │ optional          │
 *   └──────────┴──────────────────┴───────────────────┘
 */

import type { ReactNode } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Sidebar } from '#/components/sg-dream/Sidebar'
import type { ActiveSection } from '#/components/sg-dream/Sidebar'
import { Topbar } from '#/components/sg-dream/Topbar'
import type { Crumb } from '#/components/sg-dream/Topbar'
import { useActiveEntity, deriveSidebarCounts } from '#/lib/session'
import { verificationSnapshotQuery } from '#/lib/queries'
import { displayRef, workflowConfigs } from '#/lib/sg-dream'

type AppShellProps = {
  active: ActiveSection
  crumbs: ReadonlyArray<Crumb>
  rail?: ReactNode
  children: ReactNode
  /** Optional override for routes that don't have a verification context. */
  hideEntity?: boolean
  /** Optional seeds for admin nav badges (Phase C5/C6 surfaces these). */
  pendingUsers?: number
  recentAuditEvents?: number
}

export function AppShell({
  active,
  crumbs,
  rail,
  children,
  hideEntity = false,
  pendingUsers,
  recentAuditEvents,
}: AppShellProps) {
  const { client, user, activeVerification } = useActiveEntity()
  const snapshotQuery = useSuspenseQuery(
    verificationSnapshotQuery(activeVerification.id),
  )
  const snapshot = snapshotQuery.data
  const counts = deriveSidebarCounts({
    client,
    snapshot,
    pendingUsers,
    recentAuditEvents,
  })

  const ref = displayRef({
    snapshotRef: snapshot?.verification.ref,
    client,
    verification: activeVerification,
  })

  const fullCrumbs: ReadonlyArray<Crumb> = hideEntity
    ? crumbs
    : [
        { label: client.name },
        ...crumbs,
        { label: `V${activeVerification.number} · ${ref}`, emphasis: true },
      ]

  return (
    <div className="app-shell" data-workflow={client.workflow}>
      <Sidebar
        client={client}
        user={user}
        activeVerification={activeVerification}
        workflow={client.workflow}
        active={active}
        counts={counts}
      />
      <div className="main-col">
        <Topbar
          crumbs={fullCrumbs}
          workflowLabel={workflowConfigs[client.workflow].label}
        />
        <div className={`v2-page${rail ? '' : ' single'}`}>
          <div className="v2-col">{children}</div>
          {rail ? <div className="v2-rail">{rail}</div> : null}
        </div>
      </div>
    </div>
  )
}
