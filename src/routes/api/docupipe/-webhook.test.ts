import { describe, expect, it } from 'vitest'

import { resolveStandardizedDocType, statusFromEvent, toDocType } from './webhook'
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
    expect(statusFromEvent('standardization.processed.success', row())).toBeNull()
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

  it('returns null for unrecognized event types', () => {
    expect(statusFromEvent('something.else', row())).toBeNull()
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
