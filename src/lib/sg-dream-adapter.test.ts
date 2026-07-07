import { describe, expect, it } from 'vitest'

import { liveVerificationTotals } from '#/lib/sg-dream-adapter'
import type { DocType } from '#/lib/sg-dream'
import type { DreamSnapshot, StoredDocument } from '#/server/store'

function doc(input: {
  id: string
  docType: DocType
  amount?: number
}): StoredDocument {
  return {
    id: input.id,
    clientId: 'dawson-trails-md1',
    verificationId: 'dawson-trails-md1-v1',
    originalName: `${input.id}.pdf`,
    displayName: input.id,
    docType: input.docType,
    status: 'completed',
    uploadedAt: '2026-07-06T12:00:00.000Z',
    updatedAt: '2026-07-06T12:00:00.000Z',
    duplicateFlag: 'none',
    extractedFields:
      input.amount === undefined ? undefined : { amount: input.amount },
  }
}

function snapshot(docs: ReadonlyArray<StoredDocument>): DreamSnapshot {
  return {
    verification: {
      id: 'dawson-trails-md1-v1',
      clientId: 'dawson-trails-md1',
      ref: 'SGDD-V1-2026-0001',
      documents: docs,
    },
    priorFilings: [],
  }
}

describe('liveVerificationTotals', () => {
  it('sums only invoices and pay applications into costs submitted', () => {
    // Tim's rule from the 2026-07-06 review: contracts / task orders / change
    // orders are work authorization — counting them alongside the invoices
    // they authorize double-counts the same dollars.
    const totals = liveVerificationTotals({
      snapshot: snapshot([
        doc({ id: 'ctr', docType: 'CTR', amount: 1_350_000 }),
        doc({ id: 'to', docType: 'TO', amount: 850_000 }),
        doc({ id: 'co', docType: 'CO', amount: 45_000 }),
        doc({ id: 'pop', docType: 'POP', amount: 60_000 }),
        doc({ id: 'inv', docType: 'INV', amount: 120_000 }),
        doc({ id: 'pa', docType: 'PA', amount: 200_000 }),
      ]),
      fallbackDocsCount: 0,
      fallbackCostsSubmitted: 0,
    })
    expect(totals.costsSubmitted).toBe(320_000)
    expect(totals.invoiceTotal).toBe(120_000)
    expect(totals.payAppTotal).toBe(200_000)
    expect(totals.docsCount).toBe(6)
    expect(totals.hasLiveAmounts).toBe(true)
  })

  it('treats claim docs without extracted amounts as not-yet-live', () => {
    const totals = liveVerificationTotals({
      snapshot: snapshot([
        doc({ id: 'inv', docType: 'INV' }),
        doc({ id: 'ctr', docType: 'CTR', amount: 500_000 }),
      ]),
      fallbackDocsCount: 0,
      fallbackCostsSubmitted: 0,
    })
    expect(totals.costsSubmitted).toBe(0)
    expect(totals.hasLiveAmounts).toBe(false)
    expect(totals.hasLiveDocs).toBe(true)
  })

  it('renders a real empty state when no documents exist', () => {
    const totals = liveVerificationTotals({
      snapshot: snapshot([]),
      fallbackDocsCount: 4,
      fallbackCostsSubmitted: 99,
    })
    expect(totals).toMatchObject({
      docsCount: 0,
      costsSubmitted: 0,
      hasLiveDocs: false,
    })
  })
})
