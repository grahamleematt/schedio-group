/**
 * In-app extraction corrections.
 *
 * The overlay dialog lets a reviewer fix extracted values and then finalize
 * or reject the extraction without leaving the portal. DocuPipe's side is a
 * single call — `POST /review/{id}/update` with the edited payload and a
 * `reviewStatus` — but reviews are forks: updating one never mutates the
 * parent standardization. So the accepted values are mirrored onto the
 * stored document's `extractedFields` here, which is what drives
 * costs-submitted math, the confirmation gate, and duplicate context.
 *
 * DocuPipe also fires `review.verified.success` / `review.rejected.success`
 * back at our webhook after the update; that handler re-syncs the same state,
 * so hosted-editor corrections and in-app corrections converge on one path.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { assertClientAccess } from '#/server/authz'
import {
  applyReviewBoxEdits,
  applyReviewEdits,
  getReview,
  normalizeExtractedFields,
  unwrapReviewData,
  updateReview,
} from '#/server/docupipe'
import type { ReviewBoxEdit, ReviewEdit } from '#/server/docupipe'
import { isDocupipeConfigured } from '#/server/env'
import { getStore } from '#/server/store'
import type {
  DreamSnapshot,
  ReviewState,
  StoredAuditEvent,
  StoredDocument,
} from '#/server/store'

export type ReviewCorrectionsResult = {
  ok: boolean
  /** Review lifecycle state after the update, when it succeeded. */
  reviewState?: ReviewState
  /** Number of edits that applied to the review payload. */
  appliedCount: number
  /** Fresh verification snapshot so the client can update its cache. */
  snapshot: DreamSnapshot | null
  error?: string
}

function correctionAuditEvent(input: {
  actor: string
  document: StoredDocument
  action: 'verify' | 'reject'
  appliedCount: number
  appliedBoxCount: number
}): StoredAuditEvent {
  const { actor, document, action, appliedCount, appliedBoxCount } = input
  const detailParts: Array<string> = []
  if (appliedCount > 0) {
    detailParts.push(
      `${appliedCount} field${appliedCount === 1 ? '' : 's'} corrected`,
    )
  }
  if (appliedBoxCount > 0) {
    detailParts.push(
      `${appliedBoxCount} box${appliedBoxCount === 1 ? '' : 'es'} repositioned`,
    )
  }
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: 'user',
    category: 'documents',
    actor,
    event:
      action === 'reject'
        ? 'Extraction rejected'
        : detailParts.length > 0
          ? 'Extraction corrected & verified'
          : 'Extraction verified',
    object: document.renamedName ?? document.displayName,
    result: action === 'reject' ? 'flagged' : 'ok',
    clientId: document.clientId,
    verificationId: document.verificationId,
    documentId: document.id,
    docupipeDocumentId: document.docupipeDocumentId,
    detail: detailParts.length > 0 ? detailParts.join(', ') : undefined,
  }
}

export const submitReviewCorrections = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      verificationId: string
      documentId: string
      action: 'verify' | 'reject'
      edits?: Array<ReviewEdit>
      boxEdits?: Array<ReviewBoxEdit>
    }) => data,
  )
  .handler(async ({ data }): Promise<ReviewCorrectionsResult> => {
    const store = getStore()
    const snapshot = await store.getSnapshot(data.verificationId)
    const doc = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!doc) {
      return { ok: false, appliedCount: 0, snapshot, error: 'unknown document' }
    }
    const user = await assertClientAccess(doc.clientId)

    if (!isDocupipeConfigured() || !doc.docupipeReviewId) {
      return {
        ok: false,
        appliedCount: 0,
        snapshot,
        error: 'no review available for this document',
      }
    }

    const review = await getReview(doc.docupipeReviewId)
    if (!review) {
      return {
        ok: false,
        appliedCount: 0,
        snapshot,
        error: 'the review is still being generated — try again shortly',
      }
    }

    // Corrections only make sense on a finalize; a rejection means "don't
    // rely on this extraction", so edits are ignored there.
    const edits = data.action === 'verify' ? (data.edits ?? []) : []
    const boxEdits = data.action === 'verify' ? (data.boxEdits ?? []) : []
    const applied = applyReviewEdits(review.data, edits)
    const appliedBoxes = applyReviewBoxEdits(applied.data, boxEdits)
    const anyApplied =
      applied.appliedPaths.length > 0 || appliedBoxes.appliedPaths.length > 0

    await updateReview(doc.docupipeReviewId, {
      ...(anyApplied ? { data: appliedBoxes.data } : {}),
      reviewStatus: data.action === 'verify' ? 'verified' : 'rejected',
    })

    const reviewState: ReviewState =
      data.action === 'verify' ? 'verified' : 'rejected'
    const update: Partial<StoredDocument> = {
      updatedAt: new Date().toISOString(),
      docupipeReviewState: reviewState,
    }
    if (data.action === 'verify') {
      const extracted = normalizeExtractedFields(
        unwrapReviewData(appliedBoxes.data),
      )
      // Same normalization as the webhook paths: POP amounts are magnitudes.
      if (
        doc.docType === 'POP' &&
        typeof extracted.amount === 'number' &&
        extracted.amount < 0
      ) {
        extracted.amount = Math.abs(extracted.amount)
      }
      update.extractedFields = extracted
    }
    const persisted = await store.upsertDocument({ ...doc, ...update })

    try {
      await store.appendAuditEvent(
        correctionAuditEvent({
          actor: user.name,
          document: persisted,
          action: data.action,
          appliedCount: applied.appliedPaths.length,
          appliedBoxCount: appliedBoxes.appliedPaths.length,
        }),
      )
    } catch (err) {
      console.warn('[review corrections] audit write failed', err)
    }

    return {
      ok: true,
      reviewState,
      appliedCount:
        applied.appliedPaths.length + appliedBoxes.appliedPaths.length,
      snapshot: await store.getSnapshot(data.verificationId),
    }
  })
