import { describe, expect, it } from 'vitest'

import { isVerificationInFlight } from './queries'
import { liveVerificationTotals } from './sg-dream-adapter'
import type { DocType } from './sg-dream'
import type { DreamSnapshot, StoredDocument } from '#/server/store'

const baseDoc: StoredDocument = {
  id: 'doc-1',
  clientId: 'srcab',
  verificationId: 'srcab-v3',
  originalName: 'whatever.pdf',
  displayName: 'whatever.pdf',
  docType: 'INV',
  status: 'queued',
  uploadedAt: '2026-04-15T00:00:00.000Z',
  updatedAt: '2026-04-15T00:00:00.000Z',
  duplicateFlag: 'none',
}

function snapshotWith(
  statuses: Array<StoredDocument['status']>,
): DreamSnapshot {
  return {
    verification: {
      id: 'srcab-v3',
      clientId: 'srcab',
      ref: 'SGD-DP-V3-2026-0028',
      documents: statuses.map((status, i) => ({
        ...baseDoc,
        id: `doc-${i}`,
        status,
      })),
    },
    priorFilings: [],
  }
}

function snapshotWithDocs(
  docs: ReadonlyArray<Partial<StoredDocument> & { id: string; docType: DocType }>,
): DreamSnapshot {
  return {
    verification: {
      id: 'srcab-v3',
      clientId: 'srcab',
      ref: 'SGD-DP-V3-2026-0028',
      documents: docs.map((doc) => ({
        ...baseDoc,
        ...doc,
      })),
    },
    priorFilings: [],
  }
}

describe('isVerificationInFlight', () => {
  it('returns false when there are no documents yet', () => {
    expect(isVerificationInFlight(snapshotWith([]))).toBe(false)
  })

  it('returns false when every document is in a terminal state', () => {
    expect(
      isVerificationInFlight(snapshotWith(['completed', 'completed', 'error'])),
    ).toBe(false)
  })

  it('returns true while any document is queued', () => {
    expect(isVerificationInFlight(snapshotWith(['completed', 'queued']))).toBe(
      true,
    )
  })

  it('returns true while any document is classifying or standardizing', () => {
    expect(isVerificationInFlight(snapshotWith(['classifying']))).toBe(true)
    expect(isVerificationInFlight(snapshotWith(['standardizing']))).toBe(true)
  })

  it('returns false when the snapshot is missing entirely', () => {
    expect(isVerificationInFlight(undefined)).toBe(false)
    expect(isVerificationInFlight(null)).toBe(false)
  })
})

describe('liveVerificationTotals', () => {
  it('falls back to mock totals only before live documents exist', () => {
    const totals = liveVerificationTotals({
      snapshot: snapshotWithDocs([]),
      mockDocsCount: 11,
      mockCostsSubmitted: 322_940.11,
    })

    expect(totals.docsCount).toBe(11)
    expect(totals.costsSubmitted).toBe(322_940.11)
    expect(totals.hasLiveDocs).toBe(false)
  })

  it('sums extracted invoice amounts only once live documents exist', () => {
    const totals = liveVerificationTotals({
      snapshot: snapshotWithDocs([
        {
          id: 'invoice-1',
          docType: 'INV',
          extractedFields: { amount: 125 },
        },
        {
          id: 'pay-app-1',
          docType: 'PA',
          extractedFields: { amount: 10_000 },
        },
        {
          id: 'invoice-2',
          docType: 'INV',
          extractedFields: { amount: 75.5 },
        },
      ]),
      mockDocsCount: 11,
      mockCostsSubmitted: 322_940.11,
    })

    expect(totals.docsCount).toBe(3)
    expect(totals.costsSubmitted).toBe(200.5)
    expect(totals.hasLiveAmounts).toBe(true)
    expect(totals.hasLiveDocs).toBe(true)
  })

  it('keeps a live zero instead of falling back to mock dollars', () => {
    const totals = liveVerificationTotals({
      snapshot: snapshotWithDocs([
        {
          id: 'invoice-pending',
          docType: 'INV',
        },
        {
          id: 'contract-1',
          docType: 'CTR',
          extractedFields: { amount: 1_000 },
        },
      ]),
      mockDocsCount: 11,
      mockCostsSubmitted: 322_940.11,
    })

    expect(totals.docsCount).toBe(2)
    expect(totals.costsSubmitted).toBe(0)
    expect(totals.hasLiveAmounts).toBe(false)
    expect(totals.hasLiveDocs).toBe(true)
  })
})
