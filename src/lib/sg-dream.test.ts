import { describe, expect, it } from 'vitest'

import {
  addOneMonthISO,
  buildNextVerification,
  daysUntilCutoff,
  defaultVerifications,
  formatCutoffLabel,
  isPastCutoff,
  lowConfidenceFields,
  payAppWaterfall,
  validatePayApp,
} from '#/lib/sg-dream'

describe('daysUntilCutoff', () => {
  it('counts calendar days between today and the cutoff', () => {
    expect(daysUntilCutoff('2026-08-03', '2026-07-06')).toBe(28)
    expect(daysUntilCutoff('2026-08-03', '2026-08-03')).toBe(0)
  })

  it('goes negative once the cutoff has passed', () => {
    expect(daysUntilCutoff('2026-05-04', '2026-07-06')).toBe(-63)
  })

  it('returns 0 for malformed dates instead of NaN', () => {
    expect(daysUntilCutoff('not-a-date', '2026-07-06')).toBe(0)
    expect(daysUntilCutoff('2026-08-03', '')).toBe(0)
  })
})

describe('isPastCutoff', () => {
  it('is not late on the cutoff day itself — only strictly after', () => {
    expect(isPastCutoff('2026-08-03', '2026-08-02')).toBe(false)
    expect(isPastCutoff('2026-08-03', '2026-08-03')).toBe(false)
    expect(isPastCutoff('2026-08-03', '2026-08-04')).toBe(true)
  })
})

describe('addOneMonthISO', () => {
  it('moves to the same day next month', () => {
    expect(addOneMonthISO('2026-08-03')).toBe('2026-09-03')
  })

  it('clamps to the last day of a shorter month', () => {
    expect(addOneMonthISO('2026-01-31')).toBe('2026-02-28')
    expect(addOneMonthISO('2028-01-31')).toBe('2028-02-29')
  })

  it('rolls the year over from December', () => {
    expect(addOneMonthISO('2026-12-15')).toBe('2027-01-15')
  })

  it('passes malformed input through unchanged', () => {
    expect(addOneMonthISO('TBD')).toBe('TBD')
  })
})

describe('buildNextVerification', () => {
  const current = defaultVerifications[0]

  it('advances the number, id, and cutoff by one monthly cycle', () => {
    const next = buildNextVerification(current)
    expect(next.id).toBe('dawson-trails-md1-v2')
    expect(next.number).toBe(2)
    expect(next.cutoffDateISO).toBe(addOneMonthISO(current.cutoffDateISO))
    expect(next.status).toBe('open')
  })

  it('increments the trailing number in the period label', () => {
    expect(buildNextVerification(current).period).toBe('Verification No. 02')
    expect(buildNextVerification(defaultVerifications[1]).period).toBe(
      'Developer Reimbursement No. 02',
    )
  })

  it('starts the new cycle with fresh totals', () => {
    const next = buildNextVerification({
      ...current,
      docsCount: 12,
      costsSubmitted: 50_000,
      costsVerified: 40_000,
    })
    expect(next.docsCount).toBe(0)
    expect(next.costsSubmitted).toBe(0)
    expect(next.costsVerified).toBe(0)
  })

  it('takes the year from the new cutoff date', () => {
    const next = buildNextVerification({
      ...current,
      cutoffDateISO: '2026-12-15',
    })
    expect(next.year).toBe(2027)
  })
})

describe('formatCutoffLabel', () => {
  it('formats an ISO date as the schedule display label', () => {
    expect(formatCutoffLabel('2026-08-03')).toBe('Aug 03, 2026')
  })

  it('passes through values that are not clean ISO dates', () => {
    expect(formatCutoffLabel('TBD')).toBe('TBD')
  })
})

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
