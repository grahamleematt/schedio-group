/**
 * Mock session layer for the SG DREAM client portal.
 *
 * No real auth — `mockUser` is hard-wired to all entities. The active entity
 * is sourced from the `?client=` search param (kept consistent with the
 * existing route URLs) with a fallback to `clients[0]`. The picker on
 * `/clients` is the only place that "switches" by linking forward.
 *
 * Exposes:
 *   - useActiveEntity()  — current `Client` + open verification, scoped to URL
 *   - useSidebarCounts() — live nav badge counts for AppShell sidebar
 */

import { useRouterState } from '@tanstack/react-router'
import {
  clients,
  getClientById,
  getOpenVerification,
  getVendorsByClient,
  getVerificationById,
  getVerificationsByClient,
  mockUser,
} from '#/lib/sg-dream'
import type { Client, User, Verification } from '#/lib/sg-dream'
import type { DreamSnapshot } from '#/server/store'

type ActiveEntity = {
  client: Client
  user: User
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

  const client = getClientById(clientId)
  const openVerification = getOpenVerification(client.id)
  const requested = verificationId
    ? getVerificationById(verificationId, client.id)
    : null
  const activeVerification = requested ?? openVerification

  return {
    client,
    user: mockUser,
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
  client: Client
  snapshot: DreamSnapshot | null | undefined
  /** Optional seeds for the new admin routes (Phase C5/C6); 0 means no badge. */
  pendingUsers?: number
  recentAuditEvents?: number
}): SidebarCounts {
  const { client, snapshot } = input
  const docs = snapshot?.verification.documents ?? []
  const inFlight = docs.filter(
    (d) =>
      d.status === 'queued' ||
      d.status === 'classifying' ||
      d.status === 'standardizing',
  ).length

  const verificationsCount = getVerificationsByClient(client.id).length
  const vendorsCount = getVendorsByClient(client.id).length

  return {
    verifications: verificationsCount > 0 ? verificationsCount : undefined,
    submit: inFlight > 0 ? inFlight : undefined,
    library: docs.length > 0 ? docs.length : undefined,
    contracts: vendorsCount > 0 ? vendorsCount : undefined,
    users: input.pendingUsers && input.pendingUsers > 0
      ? input.pendingUsers
      : undefined,
    audit:
      input.recentAuditEvents && input.recentAuditEvents > 0
        ? input.recentAuditEvents
        : undefined,
  }
}
