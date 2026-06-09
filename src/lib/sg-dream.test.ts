import { describe, expect, it } from 'vitest'

import {
  lowConfidenceFields,
  payAppWaterfall,
  validatePayApp,
} from '#/lib/sg-dream'

describe('validatePayApp', () => {
  it('passes when current payment due matches earned-less-retainage minus previous', () => {
    const check = validatePayApp({
      amount: 25_000,
      totalEarnedLessRetainage: 100_000,
      lessPreviousPayments: 75_000,
    })
    expect(check.status).toBe('ok')
    expect(check.expected).toBe(25_000)
    expect(check.delta).toBe(0)
  })

  it('treats a missing previous-payments line as a first application (zero)', () => {
    const check = validatePayApp({
      amount: 40_000,
      totalEarnedLessRetainage: 40_000,
    })
    expect(check.status).toBe('ok')
    expect(check.expected).toBe(40_000)
  })

  it('flags a mismatch when the headline amount disagrees with the waterfall', () => {
    const check = validatePayApp({
      amount: 30_000,
      totalEarnedLessRetainage: 100_000,
      lessPreviousPayments: 75_000,
    })
    expect(check.status).toBe('mismatch')
    expect(check.expected).toBe(25_000)
    expect(check.delta).toBe(5_000)
  })

  it('absorbs sub-tolerance rounding noise', () => {
    const check = validatePayApp({
      amount: 25_000.4,
      totalEarnedLessRetainage: 100_000,
      lessPreviousPayments: 75_000,
    })
    expect(check.status).toBe('ok')
  })

  it('is unverifiable when the waterfall lines are missing', () => {
    expect(validatePayApp({ amount: 25_000 }).status).toBe('unverifiable')
    expect(validatePayApp(undefined).status).toBe('unverifiable')
  })
})

describe('payAppWaterfall', () => {
  it('returns only the present numeric lines in G702 order', () => {
    const rows = payAppWaterfall({
      contractSumToDate: 500_000,
      retainage: 10_000,
      totalEarnedLessRetainage: 100_000,
    })
    expect(rows.map((r) => r.label)).toEqual([
      'Contract sum to date',
      'Retainage',
      'Earned less retainage',
    ])
  })

  it('is empty when no waterfall data exists', () => {
    expect(payAppWaterfall({ amount: 10 })).toEqual([])
    expect(payAppWaterfall(undefined)).toEqual([])
  })
})

describe('lowConfidenceFields', () => {
  it('lists sub-threshold fields with friendly labels, lowest first', () => {
    const out = lowConfidenceFields({
      vendor_name: 0.95,
      amount: 0.61,
      document_number: 0.7,
    })
    expect(out.map((f) => f.label)).toEqual(['Amount', 'Document #'])
    expect(out[0].score).toBe(0.61)
  })

  it('falls back to the raw key when no label is known', () => {
    const out = lowConfidenceFields({ mystery_field: 0.2 })
    expect(out[0].label).toBe('mystery_field')
  })

  it('returns nothing for an empty or undefined map', () => {
    expect(lowConfidenceFields({})).toEqual([])
    expect(lowConfidenceFields(undefined)).toEqual([])
  })
})
