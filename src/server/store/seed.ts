/**
 * Seeds the DREAM store from the configured intake data in
 * `src/lib/sg-dream.ts`. The Tim review starts empty; prior filing history is
 * added only after real uploads or imports land.
 */

import {
  clients,
  documents as configuredDocuments,
  formatRef,
  verifications,
} from '#/lib/sg-dream'
import type { Document, Verification } from '#/lib/sg-dream'

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
  document: Document,
  overrides: Partial<StoredDocument> = {},
): StoredDocument {
  const client = clients.find((c) => c.id === verificationClientId(document))
  const now = new Date().toISOString()
  const extracted: ExtractedFields = {
    vendorName: document.vendorName,
    documentNumber: inferDocumentNumber(document),
    amount: document.amount > 0 ? document.amount : undefined,
    currency: document.amount > 0 ? 'USD' : undefined,
  }
  return {
    id: document.id,
    clientId: client?.id ?? 'dawson-trails-md1',
    verificationId: document.verificationId,
    originalName: document.originalName,
    displayName: document.originalName,
    docupipeDocumentId: undefined,
    docupipeStandardizationId: undefined,
    renamedName: document.renamedName,
    docType: document.docType,
    status: 'completed',
    uploadedAt: now,
    updatedAt: now,
    extractedFields: extracted,
    duplicateFlag: document.duplicateFlag,
    matchedPreviousName: document.matchedPreviousName,
    matchedVerificationRef: document.matchedVerificationRef,
    custodyState: 'classified',
    ...overrides,
  }
}

function verificationClientId(document: Document): string {
  return (
    verifications.find((v) => v.id === document.verificationId)?.clientId ??
    'dawson-trails-md1'
  )
}

function inferDocumentNumber(document: Document): string | undefined {
  const m = document.originalName.match(
    /(INV-\d{4}-\d+|WO\s?\d+|CO\s?\d+|CO-\d+)/i,
  )
  return m?.[0]
}

function buildPriorFilingDocs(): Array<StoredDocument> {
  const prior: Array<StoredDocument> = []
  for (const d of configuredDocuments) {
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

  const liveRows = configuredDocuments.map((d) => storedFrom(d))
  const priorRows = buildPriorFilingDocs()

  for (const row of [...priorRows, ...liveRows]) {
    state.documents[row.id] = row
    const bucket = state.documentsByVerification[row.verificationId] ?? []
    bucket.push(row.id)
    state.documentsByVerification[row.verificationId] = bucket
  }

  return state
}
