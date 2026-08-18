/**
 * Submission finalize / reopen for the DREAM intake workflow.
 *
 * Finalizing is the client's "I'm done" gate promised in the Aug 10 meeting:
 * the open verification moves to `under_review` (stamped with who/when) and
 * every document's custody moves to the reserved `locked` state, which the
 * upload/import/delete paths reject. Reopening reverses both — allowed for
 * clients until the cutoff date, and for internal Schedio roles any time
 * before the cycle is approved.
 *
 * Degradable: without a database the verification status can't persist, so
 * the lock is carried entirely by document custody (`isSubmissionLocked`
 * derives the state from either signal).
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { isInternalUser, isPastCutoff } from '#/lib/sg-dream'
import { assertClientAccess } from '#/server/authz'
import { dbQuery } from '#/server/database'
import { isDatabaseConfigured } from '#/server/env'
import {
  getVerificationConfigById,
  todayISOInDenver,
} from '#/server/portalConfig'
import { getStore } from '#/server/store'
import type {
  CustodyState,
  DreamSnapshot,
  StoredAuditEvent,
  StoredDocument,
} from '#/server/store'

export type FinalizeSubmissionResult =
  | { ok: true; snapshot: DreamSnapshot | null }
  | { ok: false; error: string }

function verificationAuditEvent(input: {
  actor: string
  clientId: string
  verificationId: string
  event: string
  detail: string
}): StoredAuditEvent {
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: 'user',
    category: 'verifications',
    actor: input.actor,
    event: input.event,
    object: input.verificationId,
    result: 'ok',
    clientId: input.clientId,
    verificationId: input.verificationId,
    detail: input.detail,
  }
}

function docsLocked(docs: ReadonlyArray<StoredDocument>): boolean {
  return docs.length > 0 && docs.every((d) => d.custodyState === 'locked')
}

/**
 * Custody to restore on reopen. The pre-finalize state isn't stored, so it is
 * rebuilt from the same evidence the intake pipeline uses: a filed Egnyte copy
 * means `classified`, a completed analysis means `ready` (awaiting the filing
 * gate), anything else returns to `incoming`.
 */
function restoredCustody(doc: StoredDocument): CustodyState {
  if (doc.egnyteClassifiedPath) return 'classified'
  if (doc.status === 'completed') return 'ready'
  return 'incoming'
}

export const finalizeSubmission = createServerFn({ method: 'POST' })
  .inputValidator((data: { verificationId: string }) => data)
  .handler(async ({ data }): Promise<FinalizeSubmissionResult> => {
    const store = getStore()
    const verification = await getVerificationConfigById(data.verificationId)
    if (!verification) return { ok: false, error: 'Unknown verification.' }

    const user = await assertClientAccess(verification.clientId)

    const snapshot = await store.getSnapshot(data.verificationId)
    const docs = snapshot?.verification.documents ?? []
    if (docs.length === 0) {
      return {
        ok: false,
        error: 'Nothing to finalize — upload documents first.',
      }
    }
    if (verification.status !== 'open' || docsLocked(docs)) {
      return { ok: false, error: 'This submission is already finalized.' }
    }
    const inFlight = docs.filter(
      (d) => d.status !== 'completed' && d.status !== 'error',
    ).length
    if (inFlight > 0) {
      return {
        ok: false,
        error: `${inFlight} document${inFlight === 1 ? ' is' : 's are'} still processing — finalize once processing completes.`,
      }
    }

    if (isDatabaseConfigured()) {
      const updated = await dbQuery(
        `
          update dream_verifications
          set status = 'under_review',
              submitted_at = now(),
              submitted_by = $2,
              updated_at = now()
          where id = $1 and status = 'open'
        `,
        [data.verificationId, user.name],
      )
      // Guarded update: a concurrent finalize (or a Schedio status change)
      // already moved the row, so don't double-lock.
      if (updated.rowCount === 0) {
        return { ok: false, error: 'This submission is already finalized.' }
      }
    }

    for (const doc of docs) {
      if (doc.custodyState === 'locked') continue
      await store.upsertDocument({ ...doc, custodyState: 'locked' })
    }

    try {
      await store.appendAuditEvent(
        verificationAuditEvent({
          actor: user.name,
          clientId: verification.clientId,
          verificationId: data.verificationId,
          event: 'Submission finalized',
          detail: `${docs.length} document${docs.length === 1 ? '' : 's'} locked for Schedio review`,
        }),
      )
    } catch (err) {
      console.warn('[finalize submission] audit write failed', err)
    }

    return { ok: true, snapshot: await store.getSnapshot(data.verificationId) }
  })

export const reopenSubmission = createServerFn({ method: 'POST' })
  .inputValidator((data: { verificationId: string }) => data)
  .handler(async ({ data }): Promise<FinalizeSubmissionResult> => {
    const store = getStore()
    const verification = await getVerificationConfigById(data.verificationId)
    if (!verification) return { ok: false, error: 'Unknown verification.' }

    const user = await assertClientAccess(verification.clientId)

    const snapshot = await store.getSnapshot(data.verificationId)
    const docs = snapshot?.verification.documents ?? []
    if (verification.status === 'approved') {
      return {
        ok: false,
        error:
          'This verification has been approved by Schedio and can no longer be reopened.',
      }
    }
    // Require finalize evidence (the stamp, or locked docs when no database
    // persists status). A cycle that is merely `under_review` because late
    // uploads rolled it closed was never finalized and must stay closed.
    const finalized = Boolean(verification.submittedAtISO) || docsLocked(docs)
    if (!finalized) {
      return { ok: false, error: 'This submission is not finalized.' }
    }
    if (
      !isInternalUser(user) &&
      isPastCutoff(verification.cutoffDateISO, todayISOInDenver())
    ) {
      return {
        ok: false,
        error:
          'The cutoff for this cycle has passed — contact Schedio to reopen the submission.',
      }
    }

    if (isDatabaseConfigured()) {
      await dbQuery(
        `
          update dream_verifications
          set status = 'open',
              submitted_at = null,
              submitted_by = null,
              updated_at = now()
          where id = $1 and status = 'under_review'
        `,
        [data.verificationId],
      )
    }

    for (const doc of docs) {
      if (doc.custodyState !== 'locked') continue
      await store.upsertDocument({ ...doc, custodyState: restoredCustody(doc) })
    }

    try {
      await store.appendAuditEvent(
        verificationAuditEvent({
          actor: user.name,
          clientId: verification.clientId,
          verificationId: data.verificationId,
          event: 'Submission reopened',
          detail: `${docs.length} document${docs.length === 1 ? '' : 's'} unlocked for editing`,
        }),
      )
    } catch (err) {
      console.warn('[reopen submission] audit write failed', err)
    }

    return { ok: true, snapshot: await store.getSnapshot(data.verificationId) }
  })
