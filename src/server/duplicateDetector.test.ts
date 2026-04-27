import { describe, expect, it } from 'vitest'

import { detectDuplicate } from './duplicateDetector'
import type { StoredDocument } from './store/types'

function prior(
  overrides: Partial<StoredDocument> & {
    vendorName: string
    documentNumber?: string
    amount: number
    documentDate?: string
  },
): StoredDocument {
  const now = new Date().toISOString()
  return {
    id: overrides.id ?? 'prior-1',
    clientId: 'srcab',
    verificationId: overrides.verificationId ?? 'srcab-v3',
    originalName: overrides.originalName ?? 'prior.pdf',
    displayName: overrides.originalName ?? 'prior.pdf',
    docType: overrides.docType ?? 'INV',
    status: 'completed',
    uploadedAt: now,
    updatedAt: now,
    duplicateFlag: 'none',
    extractedFields: {
      vendorName: overrides.vendorName,
      documentNumber: overrides.documentNumber,
      amount: overrides.amount,
      documentDate: overrides.documentDate,
    },
    ...overrides,
  }
}

const refs = { 'srcab-v3': 'SGD-DP-V3-2026-0028' }

describe('detectDuplicate', () => {
  it('flags exact match on vendor + docNumber + amount', () => {
    const result = detectDuplicate({
      extracted: {
        vendorName: 'Rusin Drafting',
        documentNumber: 'INV-2026-0091',
        amount: 18240,
        documentDate: '2026-04-01',
      },
      priorFilings: [
        prior({
          vendorName: 'Rusin Drafting',
          documentNumber: 'INV-2026-0091',
          amount: 18240,
          documentDate: '2026-03-10',
          originalName: 'Rusin_Invoice_March2026.pdf',
        }),
      ],
      verificationRefs: refs,
    })
    expect(result.flag).toBe('exact')
    expect(result.matchedPreviousName).toBe('Rusin_Invoice_March2026.pdf')
    expect(result.matchedVerificationRef).toBe('SGD-DP-V3-2026-0028')
  })

  it('flags likely match on same vendor + amount within 7 days, different doc number', () => {
    const result = detectDuplicate({
      extracted: {
        vendorName: 'Aztec Utility Locating',
        documentNumber: 'INV-2026-0099',
        amount: 24118.6,
        documentDate: '2026-04-02',
      },
      priorFilings: [
        prior({
          vendorName: 'Aztec Utility Locating',
          documentNumber: 'INV-2026-0077',
          amount: 24118.6,
          documentDate: '2026-03-30',
          originalName: 'Aztec_Invoice_INV-2026-0077.pdf',
        }),
      ],
      verificationRefs: refs,
    })
    expect(result.flag).toBe('likely')
    expect(result.matchedPreviousName).toBe('Aztec_Invoice_INV-2026-0077.pdf')
  })

  it('returns none when nothing matches', () => {
    const result = detectDuplicate({
      extracted: {
        vendorName: 'Atwell LLC',
        documentNumber: 'WO-01',
        amount: 12000,
        documentDate: '2026-04-02',
      },
      priorFilings: [
        prior({
          vendorName: 'AGW Engineering',
          documentNumber: 'WO-01',
          amount: 12000,
          documentDate: '2026-04-02',
        }),
      ],
      verificationRefs: refs,
    })
    expect(result.flag).toBe('none')
  })

  it('returns none when incoming amount is missing', () => {
    const result = detectDuplicate({
      extracted: { vendorName: 'Rusin Drafting' },
      priorFilings: [
        prior({
          vendorName: 'Rusin Drafting',
          documentNumber: 'X',
          amount: 1000,
        }),
      ],
      verificationRefs: refs,
    })
    expect(result.flag).toBe('none')
  })

  it('returns none when vendor differs', () => {
    const result = detectDuplicate({
      extracted: {
        vendorName: 'Different Vendor',
        documentNumber: 'INV-1',
        amount: 500,
        documentDate: '2026-04-02',
      },
      priorFilings: [
        prior({
          vendorName: 'Original Vendor',
          documentNumber: 'INV-1',
          amount: 500,
          documentDate: '2026-04-02',
        }),
      ],
      verificationRefs: refs,
    })
    expect(result.flag).toBe('none')
  })

  it('normalizes whitespace + case when comparing vendors and doc numbers', () => {
    const result = detectDuplicate({
      extracted: {
        vendorName: '  Rusin  Drafting  ',
        documentNumber: 'inv 2026 0091',
        amount: 18240,
      },
      priorFilings: [
        prior({
          vendorName: 'RUSIN DRAFTING',
          documentNumber: 'INV-2026-0091',
          amount: 18240,
          originalName: 'Rusin_Invoice_March2026.pdf',
        }),
      ],
      verificationRefs: refs,
    })
    expect(result.flag).toBe('exact')
  })
})
