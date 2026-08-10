/**
 * In-app extraction overlay data. Fetches the DocuPipe Review object for a
 * document and flattens it into positioned fields (page + normalized bounding
 * box) that the document detail route renders on top of the original file.
 * Replaces the hosted DocuPipe viewer as the primary overlay surface — we
 * control rotation and box placement, and the hosted viewer stays available
 * as a fallback link.
 */

import { createServerFn } from '@tanstack/react-start'

import { extractedFieldLabels } from '#/lib/sg-dream'
import { assertClientAccess } from '#/server/authz'
import { flattenReviewData, getReview } from '#/server/docupipe'
import type { OverlayField } from '#/server/docupipe'
import { isDocupipeConfigured, isEgnyteConfigured } from '#/server/env'
import { getStore } from '#/server/store'
import type { ReviewState } from '#/server/store'

export type ExtractionOverlayField = OverlayField & {
  /** Human label for the field path (falls back to the raw path). */
  label: string
}

export type ExtractionOverlay = {
  documentId: string
  /** Standardized filing name when assigned, else the original filename. */
  filename: string
  /** Fields with page + box localization, ordered by page then position. */
  fields: ReadonlyArray<ExtractionOverlayField>
  /**
   * True when `/api/documents/file` can serve the original bytes — from
   * Egnyte custody or, failing that, DocuPipe's original-file download. When
   * false the dialog offers the hosted DocuPipe viewer instead.
   */
  fileAvailable: boolean
  mimeType?: string
  /** Human-review lifecycle state, when DocuPipe reports one. */
  reviewState?: ReviewState
}

function parseReviewState(raw: string | undefined): ReviewState | undefined {
  const lower = raw?.toLowerCase()
  return lower === 'unverified' || lower === 'verified' || lower === 'rejected'
    ? lower
    : undefined
}

function labelFor(path: string): string {
  // Field paths are snake_case schema keys, possibly nested (`a.b.0.c`) —
  // label the last non-index segment and fall back to the raw path.
  const segments = path.split('.').filter((seg) => !/^\d+$/.test(seg))
  const leaf = segments[segments.length - 1] ?? path
  return extractedFieldLabels[leaf] ?? leaf.replaceAll('_', ' ')
}

export const getExtractionOverlay = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { verificationId: string; documentId: string }) => data,
  )
  .handler(async ({ data }): Promise<ExtractionOverlay | null> => {
    // Null returns render as "overlay still being generated" client-side, so
    // record which branch bailed — it is the only prod-side breadcrumb.
    const bail = (reason: string) => {
      console.warn(`[extraction overlay] ${data.documentId}: ${reason}`)
      return null
    }
    if (!isDocupipeConfigured()) return bail('DocuPipe not configured')

    const snapshot = await getStore().getSnapshot(data.verificationId)
    const doc = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!doc) return bail(`document not in ${data.verificationId} snapshot`)
    await assertClientAccess(doc.clientId)
    if (!doc.docupipeReviewId) return bail('no review id on document')

    const review = await getReview(doc.docupipeReviewId)
    if (!review) return bail(`review ${doc.docupipeReviewId} fetch failed`)

    const fields = flattenReviewData(review.data)
      // Our AI-built schemas carry sibling `<field>_confidence` numbers; they
      // feed the low-confidence pills, not the overlay rail.
      .filter((f) => !f.path.endsWith('_confidence'))
      .map((f) => ({ ...f, label: labelFor(f.path) }))
    if (fields.length === 0) {
      console.warn(
        `[extraction overlay] ${data.documentId}: review ${doc.docupipeReviewId} returned no fields (data not hydrated yet?)`,
      )
    }

    const egnytePath =
      doc.egnyteClassifiedPath ?? doc.egnyteIncomingPath ?? doc.egnyteSourcePath
    const egnyteServable = Boolean(egnytePath) && isEgnyteConfigured()
    const docupipeServable = Boolean(doc.docupipeDocumentId)
    return {
      documentId: doc.id,
      filename: doc.renamedName ?? doc.originalName,
      fields,
      fileAvailable: egnyteServable || docupipeServable,
      mimeType: doc.mimeType,
      reviewState:
        parseReviewState(review.reviewState) ?? doc.docupipeReviewState,
    }
  })
