/**
 * On-demand DocuPipe Visual Review generation.
 *
 * The webhook normally creates a Visual Review object when standardization
 * succeeds. When that didn't happen (early uploads, a transient failure, or
 * reviews disabled at the time), this server fn lets the entity owner mint one
 * from the UI: it kicks off `createVisualReview` for the document's
 * standardization and persists the resulting review ID so the "View extraction
 * overlay" link appears. The presigned viewer URL is still minted per-click by
 * /api/docupipe/review-url.
 */

import { createServerFn } from '@tanstack/react-start'

import { clients as configuredClients } from '#/lib/sg-dream'
import { assertInternalClientAccess } from '#/server/authz'
import { createVisualReview } from '#/server/docupipe'
import { getVerificationConfigById } from '#/server/portalConfig'
import { getStore } from '#/server/store'
import type { DreamSnapshot } from '#/server/store'

async function clientIdForVerification(
  verificationId: string,
): Promise<string | undefined> {
  const verification = await getVerificationConfigById(verificationId)
  if (!verification) return undefined
  return configuredClients.find((c) => c.id === verification.clientId)?.id
}

export const generateVisualReview = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: { verificationId: string; documentId: string }) => data,
  )
  .handler(async ({ data }): Promise<DreamSnapshot | null> => {
    const store = getStore()
    const clientId =
      (await clientIdForVerification(data.verificationId)) ??
      (await store.getSnapshot(data.verificationId))?.verification.clientId
    if (!clientId) return null

    await assertInternalClientAccess(clientId)

    const snapshot = await store.getSnapshot(data.verificationId)
    const doc = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!doc) return snapshot
    // Already has a review, or nothing to base one on.
    if (doc.docupipeReviewId || !doc.docupipeStandardizationId) return snapshot

    const review = await createVisualReview(doc.docupipeStandardizationId)
    const reviewId = review?.reviewIds[0]
    if (!reviewId) return snapshot

    await store.upsertDocument({ ...doc, docupipeReviewId: reviewId })
    return store.getSnapshot(data.verificationId)
  })
