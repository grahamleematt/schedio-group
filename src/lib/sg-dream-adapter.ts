/**
 * Shims between the server-side `StoredDocument` shape and the display-only
 * `Document` shape that the SG DREAM components were originally built
 * against. Keeps the UI components stable while the routes pull from the
 * real server snapshot.
 */

import type { Document } from '#/lib/sg-dream'
import type { DreamSnapshot, StoredDocument } from '#/server/store'

function vendorCode(name: string | undefined): string {
  if (!name) return 'UNK'
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  return letters.length > 0 ? letters.padEnd(4, 'X') : 'UNK'
}

export function storedToDisplay(doc: StoredDocument): Document {
  const vendorName =
    doc.extractedFields?.vendorName ?? doc.originalName.split(/[_.]/)[0]
  const amount = doc.extractedFields?.amount ?? 0
  return {
    id: doc.id,
    verificationId: doc.verificationId,
    sourceKind: doc.sourceKind,
    docType: doc.docType,
    vendor: vendorCode(vendorName),
    vendorName,
    originalName: doc.originalName,
    renamedName: doc.renamedName ?? doc.originalName,
    amount,
    seq: 0,
    duplicateFlag: doc.duplicateFlag,
    matchedPreviousName: doc.matchedPreviousName,
    matchedVerificationRef: doc.matchedVerificationRef,
    egnyteIncomingPath: doc.egnyteIncomingPath,
    egnyteSourcePath: doc.egnyteSourcePath,
    egnyteEntryId: doc.egnyteEntryId,
    egnyteGroupId: doc.egnyteGroupId,
    egnyteClassifiedPath: doc.egnyteClassifiedPath,
    egnyteWebUrl: doc.egnyteWebUrl,
    custodyState: doc.custodyState,
    visualReviewUrl: doc.visualReviewUrl,
    fieldConfidence: doc.fieldConfidence,
    lowConfidence: doc.lowConfidence,
    status: doc.status,
    errorMessage: doc.errorMessage,
    uploadedAt: doc.uploadedAt,
  }
}

export function storedListToDisplay(
  docs: ReadonlyArray<StoredDocument>,
): ReadonlyArray<Document> {
  return docs.map(storedToDisplay)
}

export type LiveTotals = {
  /** Number of docs the user actually has on the verification right now. */
  docsCount: number
  /** Sum of extracted invoice amounts for the verification. */
  costsSubmitted: number
  /** True when at least one live invoice doc with an extracted amount exists. */
  hasLiveAmounts: boolean
  /** True when at least one live doc exists, even if amounts haven't extracted yet. */
  hasLiveDocs: boolean
}

/**
 * Returns the verification totals to render in the UI. The customer-facing
 * app should reflect what Tim has actually uploaded, so an empty server
 * snapshot renders as a real empty state.
 */
export function liveVerificationTotals(input: {
  snapshot: DreamSnapshot | null | undefined
  fallbackDocsCount: number
  fallbackCostsSubmitted: number
}): LiveTotals {
  const docs = input.snapshot?.verification.documents ?? []
  if (docs.length === 0) {
    return {
      docsCount: 0,
      costsSubmitted: 0,
      hasLiveAmounts: false,
      hasLiveDocs: false,
    }
  }
  const invoiceDocs = docs.filter((d) => d.docType === 'INV')
  const docsWithInvoiceAmounts = invoiceDocs.filter(
    (d) => typeof d.extractedFields?.amount === 'number',
  )
  const sum = docsWithInvoiceAmounts.reduce(
    (acc, d) => acc + (d.extractedFields?.amount ?? 0),
    0,
  )
  return {
    docsCount: docs.length,
    costsSubmitted: sum,
    hasLiveAmounts: docsWithInvoiceAmounts.length > 0,
    hasLiveDocs: true,
  }
}
