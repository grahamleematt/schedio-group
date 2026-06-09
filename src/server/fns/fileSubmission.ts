/**
 * Commit a draft submission to Egnyte.
 *
 * This is the action behind the "File to Egnyte" gate on the confirmation
 * page. Until it runs, analyzed documents sit in the `ready` custody state
 * (named + destination computed, but never moved). Filing promotes every
 * ready document to `classified`, performing the real Egnyte move when the
 * tenant is configured and simulating it otherwise (local dev / demo).
 *
 * Access is gated by entity ownership and every promotion is recorded in the
 * append-only audit log, mirroring deleteSubmission.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import {
  clients as configuredClients,
  verifications as configuredVerifications,
} from '#/lib/sg-dream'
import { assertClientAccess } from '#/server/authz'
import { fileDocumentToEgnyte } from '#/server/intake/filing'
import { getStore } from '#/server/store'
import type {
  DreamSnapshot,
  StoredAuditEvent,
  StoredDocument,
} from '#/server/store'

function clientIdForVerification(verificationId: string): string | undefined {
  const verification = configuredVerifications.find(
    (v) => v.id === verificationId,
  )
  if (!verification) return undefined
  return configuredClients.find((c) => c.id === verification.clientId)?.id
}

function filedAuditEvent(input: {
  actor: string
  clientId: string
  verificationId: string
  document: StoredDocument
  classifiedPath: string
  simulated: boolean
}): StoredAuditEvent {
  const { actor, clientId, verificationId, document, classifiedPath, simulated } =
    input
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: 'user',
    category: 'documents',
    actor,
    event: simulated ? 'Filed in Egnyte (simulated)' : 'Filed in Egnyte',
    object: document.renamedName ?? document.displayName,
    result: 'ok',
    clientId,
    verificationId,
    documentId: document.id,
    detail: classifiedPath,
  }
}

export const fileSubmissionToEgnyte = createServerFn({ method: 'POST' })
  .inputValidator((data: { verificationId: string }) => data)
  .handler(async ({ data }): Promise<DreamSnapshot | null> => {
    const store = getStore()
    const clientId =
      clientIdForVerification(data.verificationId) ??
      (await store.getSnapshot(data.verificationId))?.verification.clientId
    if (!clientId) return null

    const user = await assertClientAccess(clientId)

    const snapshot = await store.getSnapshot(data.verificationId)
    if (!snapshot) return null

    // Only documents that finished analysis and are awaiting filing.
    const pending = snapshot.verification.documents.filter(
      (d) => d.custodyState === 'ready',
    )

    for (const doc of pending) {
      const result = await fileDocumentToEgnyte(doc)
      if (result.custodyState !== 'classified' || !result.classifiedPath) {
        // Filing failed for this doc — record the error but leave it `ready`
        // so the entity owner can retry.
        await store.upsertDocument({
          ...doc,
          errorMessage: result.errorMessage ?? 'Egnyte filing failed',
        })
        continue
      }

      const persisted = await store.upsertDocument({
        ...doc,
        custodyState: 'classified',
        egnyteClassifiedPath: result.classifiedPath,
        egnyteWebUrl: result.webUrl ?? doc.egnyteWebUrl,
        renamedName: result.renamedName ?? doc.renamedName,
        errorMessage: undefined,
      })

      try {
        await store.appendAuditEvent(
          filedAuditEvent({
            actor: user.name,
            clientId,
            verificationId: data.verificationId,
            document: persisted,
            classifiedPath: result.classifiedPath,
            simulated: Boolean(result.simulated),
          }),
        )
      } catch (err) {
        console.warn('[file submission] audit write failed', err)
      }
    }

    return store.getSnapshot(data.verificationId)
  })
