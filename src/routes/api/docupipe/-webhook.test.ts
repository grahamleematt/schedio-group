import { describe, expect, it } from 'vitest'

import {
  extractReviewId,
  resolveStandardizedDocType,
  reviewStateFromEventType,
  stableAuditEventId,
  statusFromEvent,
  toDocType,
} from './webhook'
import type { StoredDocument } from '#/server/store'

function row(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    id: 'doc-1',
    clientId: 'c1',
    verificationId: 'v1',
    originalName: 'a.pdf',
    displayName: 'a.pdf',
    docType: 'UNK',
    status: 'classifying',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    duplicateFlag: 'none',
    ...overrides,
  }
}

describe('statusFromEvent', () => {
  it('returns "classifying" on document.processed.success', () => {
    expect(statusFromEvent('document.processed.success', row())).toBe(
      'classifying',
    )
  })

  it('returns "classifying" on classification.processed.success', () => {
    expect(statusFromEvent('classification.processed.success', row())).toBe(
      'classifying',
    )
  })

  it('returns null on standardization.processed.success so the handler decides', () => {
    // Critical: returning a transitional status here would either get the row
    // stuck (the old "standardizing" bug) or risk marking malformed events
    // complete with no extracted data. The standardization handler is
    // authoritative and writes status='completed' explicitly when it
    // successfully fetches + persists the standardization payload.
    expect(
      statusFromEvent('standardization.processed.success', row()),
    ).toBeNull()
  })

  it('returns "completed" on workflow.processed.success when standardization data exists', () => {
    const r = row({ docupipeStandardizationId: 'std-1' })
    expect(statusFromEvent('workflow.processed.success', r)).toBe('completed')
  })

  it('returns "completed" on workflow.processed.success when extraction populated fields directly', () => {
    const r = row({ extractedFields: { vendorName: 'Rusin' } })
    expect(statusFromEvent('workflow.processed.success', r)).toBe('completed')
  })

  it('returns "completed" on workflow.processed.success for a classified-but-unmapped row', () => {
    const r = row({ docType: 'PA' })
    expect(statusFromEvent('workflow.processed.success', r)).toBe('completed')
  })

  it('holds the line on workflow.processed.success for an UNK row with no extraction', () => {
    expect(statusFromEvent('workflow.processed.success', row())).toBeNull()
  })

  it('returns "error" on any *.error event', () => {
    expect(statusFromEvent('document.processed.error', row())).toBe('error')
    expect(statusFromEvent('standardization.processed.error', row())).toBe(
      'error',
    )
    expect(statusFromEvent('workflow.processed.error', row())).toBe('error')
  })

  it('never lets review events touch document status — including review errors', () => {
    // A failed review generation must not flip a completed extraction to
    // error; the review layer is optional on top of the pipeline.
    expect(statusFromEvent('review.processed.error', row())).toBeNull()
    expect(statusFromEvent('review.processed.success', row())).toBeNull()
    expect(statusFromEvent('review.verified.success', row())).toBeNull()
    expect(statusFromEvent('review.rejected.success', row())).toBeNull()
  })

  it('returns null for unrecognized event types', () => {
    expect(statusFromEvent('something.else', row())).toBeNull()
  })
})

describe('reviewStateFromEventType', () => {
  it('maps verified/rejected review events to their states', () => {
    expect(reviewStateFromEventType('review.verified.success')).toBe(
      'verified',
    )
    expect(reviewStateFromEventType('review.rejected.success')).toBe(
      'rejected',
    )
  })

  it('treats a generic review success (review generated) as unverified', () => {
    expect(reviewStateFromEventType('review.processed.success')).toBe(
      'unverified',
    )
  })

  it('returns undefined for non-review or error events', () => {
    expect(reviewStateFromEventType('review.processed.error')).toBeUndefined()
    expect(
      reviewStateFromEventType('standardization.processed.success'),
    ).toBeUndefined()
  })
})

describe('extractReviewId', () => {
  it('prefers explicit reviewId keys on any event', () => {
    expect(
      extractReviewId({
        eventType: 'review.verified.success',
        reviewId: 'rev-1',
      }),
    ).toBe('rev-1')
    expect(
      extractReviewId({
        eventType: 'review.verified.success',
        data: { review_id: 'rev-2' },
      }),
    ).toBe('rev-2')
  })

  it('honors a bare root id only for review events', () => {
    expect(
      extractReviewId({ eventType: 'review.rejected.success', id: 'rev-3' }),
    ).toBe('rev-3')
    expect(
      extractReviewId({
        eventType: 'standardization.processed.success',
        id: 'std-1',
      }),
    ).toBeUndefined()
  })
})

describe('toDocType', () => {
  it('returns the matching DocType for a known short code', () => {
    expect(toDocType('PA')).toBe('PA')
    expect(toDocType('INV')).toBe('INV')
  })

  it('uppercases + trims input before matching', () => {
    expect(toDocType(' inv ')).toBe('INV')
    expect(toDocType('pa')).toBe('PA')
  })

  it('falls back to UNK for empty/unknown input', () => {
    expect(toDocType(undefined)).toBe('UNK')
    expect(toDocType('')).toBe('UNK')
    expect(toDocType('Pay Application')).toBe('UNK')
  })
})

describe('resolveStandardizedDocType', () => {
  it('uses the standardization className when it resolves to a known DocType', () => {
    expect(resolveStandardizedDocType('PA', 'UNK')).toBe('PA')
    expect(resolveStandardizedDocType('INV', 'PA')).toBe('INV')
  })

  it('falls back to the prior docType when DocuPipe sends a long-form className', () => {
    // Reproduces the live regression: the standardization payload arrives
    // with className="Pay Application" (or empty) but classification already
    // resolved the row to PA via classIds[0]. Without this fallback the row
    // would silently be downgraded to UNK on standardization.
    expect(resolveStandardizedDocType('Pay Application', 'PA')).toBe('PA')
    expect(resolveStandardizedDocType(undefined, 'PA')).toBe('PA')
    expect(resolveStandardizedDocType('', 'INV')).toBe('INV')
  })

  it('returns UNK when neither source resolves to a known DocType', () => {
    expect(resolveStandardizedDocType('unknown', 'UNK')).toBe('UNK')
    expect(resolveStandardizedDocType(undefined, 'UNK')).toBe('UNK')
  })
})

describe('stableAuditEventId', () => {
  it('returns the same DocuPipe audit id for a replayed event', () => {
    const event = {
      eventType: 'standardization.processed.success',
      eventId: 'evt-replayed-1',
      documentId: 'dp-doc-1',
      standardizationId: 'std-1',
    }

    expect(
      stableAuditEventId({
        scope: 'docupipe',
        event,
        document: row({ id: 'doc-1', docupipeDocumentId: 'dp-doc-1' }),
      }),
    ).toBe(
      stableAuditEventId({
        scope: 'docupipe',
        event,
        document: row({ id: 'doc-1', docupipeDocumentId: 'dp-doc-1' }),
      }),
    )
  })

  it('uses separate stable ids for DocuPipe and Egnyte rows from the same replay', () => {
    const event = {
      eventType: 'standardization.processed.success',
      eventId: 'evt-replayed-1',
      documentId: 'dp-doc-1',
      standardizationId: 'std-1',
    }
    const document = row({ id: 'doc-1', docupipeDocumentId: 'dp-doc-1' })

    const docupipeId = stableAuditEventId({
      scope: 'docupipe',
      event,
      document,
    })
    const egnyteId = stableAuditEventId({
      scope: 'egnyte-promote',
      event,
      document,
      detail: '/Shared/SRCAB/V3/Classified/INV/file.pdf',
    })

    expect(egnyteId).not.toBe(docupipeId)
    expect(egnyteId).toBe(
      stableAuditEventId({
        scope: 'egnyte-promote',
        event,
        document,
        detail: '/Shared/SRCAB/V3/Classified/INV/file.pdf',
      }),
    )
  })
})
