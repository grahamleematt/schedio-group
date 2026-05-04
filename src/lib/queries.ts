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
import type { DreamSnapshot } from '#/server/store'

const POLL_INTERVAL_MS = 2_000

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
