/**
 * Submission cleanup for the DREAM intake workflow.
 *
 * Two operations, both gated by entity access and both recorded in the
 * append-only audit log so a deletion is never silent:
 *
 *   - `deleteSubmissionDocument` removes a single filed document.
 *   - `clearSubmission` removes every document filed under a verification
 *     (e.g. a batch submitted to the wrong workflow), leaving the
 *     verification header so the entity can re-file cleanly.
 *
 * We resolve the verification's owning client from the seed metadata (the
 * same source `getVerificationSnapshot` trusts) and assert access against it
 * before touching the store. Egnyte/DocuPipe artifacts are intentionally not
 * touched here — this clears SG DREAM's own record so a submission can be
 * re-done; any staged Egnyte copies are managed separately.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { clients as configuredClients, formatRef } from '#/lib/sg-dream'
import { assertClientAccess } from '#/server/authz'
import { getVerificationConfigById } from '#/server/portalConfig'
import { getStore } from '#/server/store'
import type {
  DreamSnapshot,
  StoredAuditEvent,
  StoredDocument,
} from '#/server/store'

async function seedMetadata(
  verificationId: string,
): Promise<{ clientId: string; ref: string } | null> {
  const verification = await getVerificationConfigById(verificationId)
  if (!verification) return null
  const client = configuredClients.find((c) => c.id === verification.clientId)
  if (!client) return null
  return {
    clientId: client.id,
    ref: formatRef({
      workflow: client.workflow,
      number: verification.number,
      year: verification.year,
      seq: verification.seq,
    }),
  }
}

function auditEvent(input: {
  actor: string
  clientId: string
  verificationId: string
  document?: StoredDocument
  count?: number
}): StoredAuditEvent {
  const { actor, clientId, verificationId, document, count } = input
  const object = document
    ? (document.renamedName ?? document.displayName)
    : `${count ?? 0} document${count === 1 ? '' : 's'}`
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: 'user',
    category: 'documents',
    actor,
    event: document ? 'Document deleted' : 'Submission cleared',
    object,
    result: 'ok',
    clientId,
    verificationId,
    documentId: document?.id,
    detail: document
      ? undefined
      : `Removed ${count ?? 0} document${count === 1 ? '' : 's'} from the submission`,
  }
}

export const deleteSubmissionDocument = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { verificationId: string; documentId: string }) => data,
  )
  .handler(async ({ data }): Promise<DreamSnapshot | null> => {
    const store = getStore()
    const metadata = await seedMetadata(data.verificationId)
    const clientId =
      metadata?.clientId ??
      (await store.getSnapshot(data.verificationId))?.verification.clientId
    if (!clientId) return null

    const user = await assertClientAccess(clientId)

    // Confirm the document actually belongs to this verification before
    // deleting, so a mismatched id can't reach across submissions.
    const snapshot = await store.getSnapshot(data.verificationId)
    const target = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!target) return snapshot

    const removed = await store.deleteDocument(data.documentId)
    if (removed) {
      await store.appendAuditEvent(
        auditEvent({
          actor: user.name,
          clientId,
          verificationId: data.verificationId,
          document: removed,
        }),
      )
    }
    return store.getSnapshot(data.verificationId)
  })

export const clearSubmission = createServerFn({ method: 'POST' })
  .inputValidator((data: { verificationId: string }) => data)
  .handler(async ({ data }): Promise<DreamSnapshot | null> => {
    const store = getStore()
    const metadata = await seedMetadata(data.verificationId)
    const clientId =
      metadata?.clientId ??
      (await store.getSnapshot(data.verificationId))?.verification.clientId
    if (!clientId) return null

    const user = await assertClientAccess(clientId)
    const removed = await store.deleteVerificationDocuments(data.verificationId)
    if (removed.length > 0) {
      await store.appendAuditEvent(
        auditEvent({
          actor: user.name,
          clientId,
          verificationId: data.verificationId,
          count: removed.length,
        }),
      )
    }
    return store.getSnapshot(data.verificationId)
  })
