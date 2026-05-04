/**
 * Seeds the DREAM store from the existing mock data in `src/lib/sg-dream.ts`
 * so duplicate detection has real prior-filing history on first boot.
 *
 * We intentionally pull from the mock arrays rather than fabricating new
 * data — this keeps the browser-side mock library and the server-side
 * history identical for non-DDP workflows + for not-yet-uploaded docs.
 */

import {
  clients,
  documents as mockDocuments,
  formatRef,
  verifications,
} from '#/lib/sg-dream'
import type { Document as MockDocument, Verification } from '#/lib/sg-dream'

import type { DreamStoreState, ExtractedFields, StoredDocument } from './types'

function verificationRef(v: Verification): string {
  return formatRef({
    workflow:
      clients.find((c) => c.id === v.clientId)?.workflow ?? 'district_dp',
    number: v.number,
    year: v.year,
    seq: v.seq,
  })
}

function storedFrom(
  mock: MockDocument,
  overrides: Partial<StoredDocument> = {},
): StoredDocument {
  const client = clients.find((c) => c.id === verificationClientId(mock))
  const now = new Date().toISOString()
  const extracted: ExtractedFields = {
    vendorName: mock.vendorName,
    documentNumber: inferDocumentNumber(mock),
    amount: mock.amount > 0 ? mock.amount : undefined,
    currency: mock.amount > 0 ? 'USD' : undefined,
  }
  return {
    id: mock.id,
    clientId: client?.id ?? 'srcab',
    verificationId: mock.verificationId,
    originalName: mock.originalName,
    displayName: mock.originalName,
    docupipeDocumentId: undefined,
    docupipeStandardizationId: undefined,
    renamedName: mock.renamedName,
    docType: mock.docType,
    status: 'completed',
    uploadedAt: now,
    updatedAt: now,
    extractedFields: extracted,
    duplicateFlag: mock.duplicateFlag,
    matchedPreviousName: mock.matchedPreviousName,
    matchedVerificationRef: mock.matchedVerificationRef,
    custodyState: 'classified',
    ...overrides,
  }
}

function verificationClientId(mock: MockDocument): string {
  return (
    verifications.find((v) => v.id === mock.verificationId)?.clientId ?? 'srcab'
  )
}

/**
 * Try to guess a document number from the mock filename. Good enough for
 * seed data — the real detector runs on DocuPipe-extracted fields.
 */
function inferDocumentNumber(mock: MockDocument): string | undefined {
  const m = mock.originalName.match(/(INV-\d{4}-\d+|WO\s?\d+|CO\s?\d+|CO-\d+)/i)
  return m?.[0]
}

/**
 * Build StoredDocument rows for the prior approved/under-review verifications
 * so the duplicate detector has something to compare against. We only have
 * live mock docs for srcab-v4 (the current verification); for prior
 * verifications we fabricate matching rows for the documents v4 references
 * via `matchedVerificationRef`, so duplicate flags light up on the first run.
 */
function buildPriorFilingDocs(): Array<StoredDocument> {
  const prior: Array<StoredDocument> = []
  for (const d of mockDocuments) {
    if (!d.matchedVerificationRef || !d.matchedPreviousName) continue
    const priorVerification = verifications.find(
      (v) => verificationRef(v) === d.matchedVerificationRef,
    )
    if (!priorVerification) continue
    const priorId = `${priorVerification.id}-prior-${d.id}`
    prior.push({
      id: priorId,
      clientId: priorVerification.clientId,
      verificationId: priorVerification.id,
      originalName: d.matchedPreviousName,
      displayName: d.matchedPreviousName,
      renamedName: d.matchedPreviousName,
      docType: d.docType,
      status: 'completed',
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      extractedFields: {
        vendorName: d.vendorName,
        documentNumber: inferDocumentNumber(d),
        amount: d.amount > 0 ? d.amount : undefined,
        currency: d.amount > 0 ? 'USD' : undefined,
      },
      duplicateFlag: 'none',
      custodyState: 'classified',
    })
  }
  return prior
}

export function buildSeedState(): DreamStoreState {
  const state: DreamStoreState = {
    verifications: {},
    documents: {},
    documentsByVerification: {},
    docSeqs: {},
    auditEvents: [],
    revision: 1,
    seeded: true,
  }

  for (const v of verifications) {
    state.verifications[v.id] = {
      id: v.id,
      clientId: v.clientId,
      ref: verificationRef(v),
    }
    state.documentsByVerification[v.id] = []
  }

  const liveRows = mockDocuments.map((d) => storedFrom(d))
  const priorRows = buildPriorFilingDocs()

  for (const row of [...priorRows, ...liveRows]) {
    state.documents[row.id] = row
    const bucket = state.documentsByVerification[row.verificationId] ?? []
    bucket.push(row.id)
    state.documentsByVerification[row.verificationId] = bucket
  }

  return state
}
