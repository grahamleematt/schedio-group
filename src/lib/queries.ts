/**
 * Shared react-query factories. The verification snapshot is the single
 * query every realtime route reads from.
 *
 * Browser updates: webhook writes the store (server-side), and the browser
 * polls this query every ~2s while any document is non-terminal. Once every
 * doc lands in `completed` or `error`, polling stops automatically. There is
 * no SSE or held-open connection — the webhook is the source of truth and
 * react-query is the transport.
 */

import { queryOptions } from '@tanstack/react-query'

import { getVerificationSnapshot } from '#/server/fns/getVerificationSnapshot'
import { getAuditLog } from '#/server/fns/getAuditLog'
import { getDeterminationWorkspace } from '#/server/fns/getDeterminationWorkspace'
import { getIntelligenceWorkspace } from '#/server/fns/getIntelligenceWorkspace'
import { getSessionUser } from '#/server/fns/getSessionUser'
import type { SessionUser } from '#/server/fns/getSessionUser'
import { getUserDirectory } from '#/server/fns/getUserDirectory'
import type { ActiveUser } from '#/lib/sg-dream'
import type { DreamSnapshot } from '#/server/store'
import type { DeterminationWorkspace } from '#/server/determinations/types'
import type { IntelligenceWorkspace } from '#/server/intelligence/types'

const POLL_INTERVAL_MS = 2_000

export type SessionUserData = SessionUser | null

/**
 * The signed-in portal user. Resolved server-side from WorkOS + Postgres
 * entity access and cached for the session; `null` when unauthenticated.
 */
export function sessionUserQuery() {
  return queryOptions({
    queryKey: ['session-user'] as const,
    queryFn: () => getSessionUser(),
    staleTime: 5 * 60 * 1000,
  })
}

export type UserDirectoryData = ReadonlyArray<ActiveUser>

/**
 * Org-wide user roster (WorkOS membership + MFA + last sign-in, joined with
 * Postgres entity access). Drives the Users & access admin table.
 */
export function userDirectoryQuery() {
  return queryOptions({
    queryKey: ['user-directory'] as const,
    queryFn: () => getUserDirectory(),
    staleTime: 60_000,
  })
}

export type VerificationSnapshotData = DreamSnapshot | null

/**
 * Returns true while at least one doc is still moving through the DocuPipe
 * pipeline. Pure so the same predicate can be reused by tests.
 */
export function isVerificationInFlight(
  snapshot: VerificationSnapshotData | undefined,
): boolean {
  const docs = snapshot?.verification.documents ?? []
  return docs.some(
    (d) =>
      d.status === 'queued' ||
      d.status === 'classifying' ||
      d.status === 'standardizing',
  )
}

export function verificationSnapshotQuery(verificationId: string) {
  return queryOptions({
    queryKey: ['verification', verificationId] as const,
    queryFn: () => getVerificationSnapshot({ data: { verificationId } }),
    staleTime: 0,
    refetchInterval: (query) =>
      isVerificationInFlight(query.state.data) ? POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  })
}

export type VerificationQueryKey = ReturnType<
  typeof verificationSnapshotQuery
>['queryKey']

const AUDIT_POLL_MS = 5_000

/**
 * Audit log for a single client. Polls every five seconds while the page
 * is open; the underlying server fn is cheap (single store read) so the
 * UI can stay reactive without an SSE channel.
 */
export function auditLogQuery(clientId: string) {
  return queryOptions({
    queryKey: ['audit-log', clientId] as const,
    queryFn: () => getAuditLog({ data: { clientId } }),
    staleTime: 0,
    refetchInterval: AUDIT_POLL_MS,
    refetchIntervalInBackground: false,
  })
}

export type DeterminationWorkspaceData = DeterminationWorkspace

export function determinationWorkspaceQuery(selectedSourceId?: string) {
  return queryOptions({
    queryKey: ['determination-workspace', selectedSourceId ?? 'all'] as const,
    queryFn: () => getDeterminationWorkspace({ data: { selectedSourceId } }),
    staleTime: 0,
  })
}

export type IntelligenceWorkspaceData = IntelligenceWorkspace

export function intelligenceWorkspaceQuery(input?: {
  selectedDocumentId?: string
  selectedSegmentId?: string
}) {
  return queryOptions({
    queryKey: [
      'intelligence-workspace',
      input?.selectedDocumentId ?? 'all',
      input?.selectedSegmentId ?? 'all',
    ] as const,
    queryFn: () => getIntelligenceWorkspace({ data: input ?? {} }),
    staleTime: 0,
  })
}
