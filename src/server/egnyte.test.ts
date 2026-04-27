import { describe, expect, it } from 'vitest'

import { EgnyteError, encodeEgnytePath, isDestinationExistsError } from './egnyte'

describe('encodeEgnytePath', () => {
  it('preserves forward slashes but encodes path segments', () => {
    expect(encodeEgnytePath('/Shared/Clients/SRC/SGD-DP-V4-2026-0001/Incoming')).toBe(
      '/Shared/Clients/SRC/SGD-DP-V4-2026-0001/Incoming',
    )
  })

  it('percent-encodes spaces and punctuation inside segments', () => {
    expect(
      encodeEgnytePath('/Shared/Clients/SRC/SGD-DP-V4-2026-0001/Incoming/Invoice #12.pdf'),
    ).toBe(
      '/Shared/Clients/SRC/SGD-DP-V4-2026-0001/Incoming/Invoice%20%2312.pdf',
    )
  })

  it('handles unicode filenames', () => {
    expect(encodeEgnytePath('/Shared/Clients/SRC/V1/Incoming/契約書.pdf')).toBe(
      '/Shared/Clients/SRC/V1/Incoming/%E5%A5%91%E7%B4%84%E6%9B%B8.pdf',
    )
  })

  it('leaves root path alone', () => {
    expect(encodeEgnytePath('/Shared/Clients')).toBe('/Shared/Clients')
  })
})

describe('isDestinationExistsError', () => {
  it('matches Egnyte 403 "destination already exists" responses', () => {
    const err = new EgnyteError(
      403,
      { errorMessage: 'Destination path already exists.' },
      'Egnyte POST failed: 403',
    )
    expect(isDestinationExistsError(err)).toBe(true)
  })

  it('matches the older "already exists" wording', () => {
    const err = new EgnyteError(
      403,
      { errorMessage: 'File with that name already exists' },
      'Egnyte POST failed: 403',
    )
    expect(isDestinationExistsError(err)).toBe(true)
  })

  it('rejects unrelated errors so callers do not silently swallow them', () => {
    const wrong = new EgnyteError(
      500,
      { errorMessage: 'Internal server error' },
      'Egnyte POST failed: 500',
    )
    expect(isDestinationExistsError(wrong)).toBe(false)
    expect(isDestinationExistsError(new Error('unrelated'))).toBe(false)
    expect(isDestinationExistsError(null)).toBe(false)
  })
})

describe('SG DREAM folder convention', () => {
  it('composes Incoming and Classified paths deterministically', () => {
    const root = '/Shared/Clients'
    const clientCode = 'SRC'
    const verificationRef = 'SGD-DP-V4-2026-0001'
    const incoming = `${root}/${clientCode}/${verificationRef}/Incoming`
    const classified = `${root}/${clientCode}/${verificationRef}/Classified/INV`
    expect(encodeEgnytePath(`${incoming}/original.pdf`)).toBe(
      '/Shared/Clients/SRC/SGD-DP-V4-2026-0001/Incoming/original.pdf',
    )
    expect(encodeEgnytePath(`${classified}/2026-03-15_INV_Rusin_12345_1000.00.pdf`)).toBe(
      '/Shared/Clients/SRC/SGD-DP-V4-2026-0001/Classified/INV/2026-03-15_INV_Rusin_12345_1000.00.pdf',
    )
  })
})
