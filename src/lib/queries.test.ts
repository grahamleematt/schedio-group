import { describe, expect, it } from 'vitest'

import { isVerificationInFlight } from './queries'
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
