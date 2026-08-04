import { describe, expect, it } from 'vitest'

import {
  displayFieldValue,
  isMoneyPath,
  parseEdit,
  rawFieldValue,
} from '#/lib/review-edits'
import type { ExtractionOverlayField } from '#/server/fns/extractionOverlay'

function field(
  path: string,
  value: ExtractionOverlayField['value'],
): ExtractionOverlayField {
  return { path, label: path, value, page: 1 }
}

describe('isMoneyPath', () => {
  it('matches dollar-amount paths from the DocuPipe schemas', () => {
    expect(isMoneyPath('current_payment_due')).toBe(true)
    expect(isMoneyPath('line_items.0.scheduled_value')).toBe(true)
    expect(isMoneyPath('total_earned_less_retainage')).toBe(true)
  })

  it('leaves counts and identifiers plain', () => {
    expect(isMoneyPath('application_number')).toBe(false)
    expect(isMoneyPath('percent_complete')).toBe(false)
  })
})

describe('displayFieldValue', () => {
  it('formats money fields with dollar signs and separators', () => {
    expect(displayFieldValue(field('current_payment_due', 20290.26))).toBe(
      '$20,290.26',
    )
  })

  it('leaves non-money numbers and strings as raw values', () => {
    expect(displayFieldValue(field('application_number', 7))).toBe('7')
    expect(displayFieldValue(field('contractor_name', 'McCarley'))).toBe(
      'McCarley',
    )
  })

  it('round-trips through parseEdit without producing a correction', () => {
    const f = field('current_payment_due', 20290.26)
    const parsed = parseEdit(f, displayFieldValue(f))
    expect(parsed).toEqual({
      ok: true,
      edit: { path: f.path, value: 20290.26 },
    })
  })

  it('matches rawFieldValue for non-money fields', () => {
    const f = field('project_name', 'Dawson Trails')
    expect(displayFieldValue(f)).toBe(rawFieldValue(f))
  })
})
