/**
 * Local account context for the SG DREAM client portal.
 *
 * WorkOS owns identity; the verification schedule and vendor contracts come
 * from Postgres through `portalConfigQuery` (warmed by the root loader). The
 * active entity is sourced from `?client=` with a fallback to `clients[0]`.
 *
 * Exposes:
 *   - useSessionUser()   — the authenticated portal user
 *   - usePortalConfig()  — verification schedule + vendors + server "today"
 *   - useActiveEntity()  — current `Client` + verifications, scoped to URL
 *   - deriveSidebarCounts() — live nav badge counts for AppShell sidebar
 */

import { useSuspenseQuery } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import {
  clients,
  getClientById,
  getOpenVerification,
  getVerificationById,
  currentUser,
} from '#/lib/sg-dream'
import type { Client, User, Verification } from '#/lib/sg-dream'
import { portalConfigQuery, sessionUserQuery } from '#/lib/queries'
import type { PortalConfigData } from '#/lib/queries'
import type { DreamSnapshot } from '#/server/store'

/**
 * The authenticated portal user, resolved server-side from WorkOS + Postgres
 * entity access (warmed by the root loader). Falls back to the seeded user
 * only when the local auth bypass leaves the session empty in development;
 * authenticated routes always resolve a real row.
 */
export function useSessionUser(): User {
  const { data } = useSuspenseQuery(sessionUserQuery())
  return data ?? currentUser
}

/**
 * The session-scoped portal config: verification schedule, vendor contracts,
 * and the server-computed `todayISO` for cutoff countdowns.
 */
export function usePortalConfig(): PortalConfigData {
  const { data } = useSuspenseQuery(portalConfigQuery())
  return data
}

type ActiveEntity = {
  client: Client
  user: User
  config: PortalConfigData
  openVerification: Verification
  /** The verification currently in URL focus, falling back to the open one. */
  activeVerification: Verification
}

/**
 * Returns the active entity context for any route under the AppShell. Reads
 * `?client=` and `?verification=` from the URL; never mutates them.
 */
export function useActiveEntity(): ActiveEntity {
  const { clientId, verificationId } = useRouterState({
    select: (s) => {
      const search = s.location.search as Record<string, unknown>
      return {
        clientId:
          typeof search.client === 'string' ? search.client : clients[0].id,
        verificationId:
          typeof search.verification === 'string'
            ? search.verification
            : undefined,
      }
    },
  })

  const user = useSessionUser()
  const config = usePortalConfig()
  const client = getClientById(clientId)
  const openVerification = getOpenVerification(config.verifications, client.id)
  const requested = verificationId
    ? getVerificationById(config.verifications, verificationId, client.id)
    : null
  const activeVerification = requested ?? openVerification

  return {
    client,
    user,
    config,
    openVerification,
    activeVerification,
  }
}

export type SidebarCounts = {
  dashboard?: number
  verifications?: number
  submit?: number
  library?: number
  contracts?: number
  users?: number
  audit?: number
}

/**
 * Live counts for the AppShell sidebar badges. Keep this pure so the same
 * derivation works in tests. Counts surface only when > 0 — the sidebar
 * drops the badge when the value is undefined or 0.
 */
export function deriveSidebarCounts(input: {
  snapshot: DreamSnapshot | null | undefined
  /** Number of vendor contracts configured for the active entity. */
  vendorsCount: number
  /** Optional seeds for the new admin routes (Phase C5/C6); 0 means no badge. */
  pendingUsers?: number
  recentAuditEvents?: number
}): SidebarCounts {
  const { snapshot, vendorsCount } = input
  const docs = snapshot?.verification.documents ?? []
  const inFlight = docs.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'classifying' ||
      d.status === 'standardizing',
  ).length

  return {
    verifications: undefined,
    submit: inFlight > 0 ? inFlight : undefined,
    library: docs.length > 0 ? docs.length : undefined,
    contracts: vendorsCount > 0 ? vendorsCount : undefined,
    users:
      input.pendingUsers && input.pendingUsers > 0
        ? input.pendingUsers
        : undefined,
    audit:
      input.recentAuditEvents && input.recentAuditEvents > 0
        ? input.recentAuditEvents
        : undefined,
  }
}
