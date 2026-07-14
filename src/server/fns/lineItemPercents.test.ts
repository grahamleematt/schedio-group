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
})

describe('applyLineItemPercents', () => {
  const rows = [
    { itemNumber: '1', description: 'A', scheduledValue: 1000 },
    { itemNumber: '2', description: 'B', scheduledValue: 2000 },
    { itemNumber: '3', description: 'C', amount: 500 },
  ]

  it('sets, clamps, and clears by index', () => {
    const { items, appliedCount, skippedCount } = applyLineItemPercents(rows, [
      { index: 0, percent: 80 },
      { index: 1, percent: 150 },
      { index: 2, percent: null },
    ])
    expect(appliedCount).toBe(3)
    expect(skippedCount).toBe(0)
    expect(items[0]?.appliedPercent).toBe(80)
    expect(items[1]?.appliedPercent).toBe(100)
    expect(items[2]?.appliedPercent).toBeUndefined()
  })

  it('ignores out-of-range indices', () => {
    const { items, appliedCount, skippedCount } = applyLineItemPercents(rows, [
      { index: -1, percent: 50 },
      { index: 99, percent: 50 },
      { index: 1.5, percent: 50 },
    ])
    expect(appliedCount).toBe(0)
    expect(skippedCount).toBe(0)
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

  it('skips edits whose itemNumber does not match the target row', () => {
    const { items, appliedCount, skippedCount } = applyLineItemPercents(rows, [
      { index: 0, percent: 90, itemNumber: '9' },
      { index: 1, percent: 40, itemNumber: '2' },
    ])
    expect(appliedCount).toBe(1)
    expect(skippedCount).toBe(1)
    expect(items[0]?.appliedPercent).toBeUndefined()
    expect(items[1]?.appliedPercent).toBe(40)
  })

  it('skips edits whose description does not match the target row', () => {
    const { items, appliedCount, skippedCount } = applyLineItemPercents(rows, [
      { index: 0, percent: 55, description: 'Not A' },
      { index: 2, percent: 10, description: '  c  ' },
    ])
    expect(appliedCount).toBe(1)
    expect(skippedCount).toBe(1)
    expect(items[0]?.appliedPercent).toBeUndefined()
    expect(items[2]?.appliedPercent).toBe(10)
  })

  it('applies when identity fields are omitted', () => {
    const { items, appliedCount, skippedCount } = applyLineItemPercents(rows, [
      { index: 0, percent: 100 },
    ])
    expect(appliedCount).toBe(1)
    expect(skippedCount).toBe(0)
    expect(items[0]?.appliedPercent).toBe(100)
  })
})
