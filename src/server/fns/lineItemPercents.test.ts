import { describe, expect, it } from 'vitest'

import {
  applyLineItemPercents,
  clampAppliedPercent,
} from './lineItemPercents'

describe('clampAppliedPercent', () => {
  it('clamps into 0–100', () => {
    expect(clampAppliedPercent(-5)).toBe(0)
    expect(clampAppliedPercent(0)).toBe(0)
    expect(clampAppliedPercent(42.5)).toBe(42.5)
    expect(clampAppliedPercent(100)).toBe(100)
    expect(clampAppliedPercent(150)).toBe(100)
  })

  it('treats non-finite as 0', () => {
    expect(clampAppliedPercent(Number.NaN)).toBe(0)
    expect(clampAppliedPercent(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('applyLineItemPercents', () => {
  const rows = [
    { itemNumber: '1', description: 'A', scheduledValue: 1000 },
    { itemNumber: '2', description: 'B', scheduledValue: 2000 },
    { itemNumber: '3', description: 'C', amount: 500 },
  ]

  it('sets, clamps, and clears by index', () => {
    const { items, appliedCount } = applyLineItemPercents(rows, [
      { index: 0, percent: 80 },
      { index: 1, percent: 150 },
      { index: 2, percent: null },
    ])
    expect(appliedCount).toBe(3)
    expect(items[0]?.appliedPercent).toBe(80)
    expect(items[1]?.appliedPercent).toBe(100)
    expect(items[2]?.appliedPercent).toBeUndefined()
  })

  it('ignores out-of-range indices', () => {
    const { items, appliedCount } = applyLineItemPercents(rows, [
      { index: -1, percent: 50 },
      { index: 99, percent: 50 },
      { index: 1.5, percent: 50 },
    ])
    expect(appliedCount).toBe(0)
    expect(items).toEqual(rows.map((r) => ({ ...r })))
  })

  it('does not mutate the source array', () => {
    const source = [{ description: 'X', appliedPercent: 10 }]
    const { items } = applyLineItemPercents(source, [
      { index: 0, percent: 25 },
    ])
    expect(source[0]?.appliedPercent).toBe(10)
    expect(items[0]?.appliedPercent).toBe(25)
  })
})
