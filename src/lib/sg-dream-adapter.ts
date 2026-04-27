/**
 * Shims between the server-side `StoredDocument` shape and the display-only
 * `Document` shape that the SG DREAM components were originally built
 * against. Keeps the UI components stable while the routes pull from the
 * real server snapshot.
 */

import type { Document } from '#/lib/sg-dream'
import type { StoredDocument } from '#/server/store'

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
    egnyteClassifiedPath: doc.egnyteClassifiedPath,
    egnyteWebUrl: doc.egnyteWebUrl,
    custodyState: doc.custodyState,
    visualReviewUrl: doc.visualReviewUrl,
    fieldConfidence: doc.fieldConfidence,
    lowConfidence: doc.lowConfidence,
  }
}

export function storedListToDisplay(
  docs: ReadonlyArray<StoredDocument>,
): ReadonlyArray<Document> {
  return docs.map(storedToDisplay)
}
