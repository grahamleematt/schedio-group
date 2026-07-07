import { describe, expect, it } from 'vitest'

import { rotateRect } from '#/lib/overlay-geometry'

const box = { x: 0.1, y: 0.2, width: 0.3, height: 0.1 }

describe('rotateRect', () => {
  it('returns the rect unchanged at 0 degrees', () => {
    expect(rotateRect(box, 0)).toEqual(box)
    expect(rotateRect(box, 360)).toEqual(box)
  })

  it('rotates 90 degrees clockwise', () => {
    expect(rotateRect(box, 90)).toEqual({
      x: 1 - 0.3,
      y: 0.1,
      width: 0.1,
      height: 0.3,
    })
  })

  it('rotates 180 degrees', () => {
    expect(rotateRect(box, 180)).toEqual({
      x: 1 - 0.4,
      y: 1 - 0.30000000000000004,
      width: 0.3,
      height: 0.1,
    })
  })

  it('rotates 270 degrees', () => {
    expect(rotateRect(box, 270)).toEqual({
      x: 0.2,
      y: 1 - 0.4,
      width: 0.1,
      height: 0.3,
    })
  })

  it('composing four 90-degree turns returns to the original', () => {
    let r = box
    for (let i = 0; i < 4; i++) r = rotateRect(r, 90)
    expect(r.x).toBeCloseTo(box.x)
    expect(r.y).toBeCloseTo(box.y)
    expect(r.width).toBeCloseTo(box.width)
    expect(r.height).toBeCloseTo(box.height)
  })
})
