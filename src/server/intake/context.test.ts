import { describe, expect, it, vi } from 'vitest'

import {
  classifiedFolderFromIncomingPath,
  resolveIntakeContext,
} from './context'

// Pin "today" past the seeded 2026-08-03 cutoff and let rollover persistence
// succeed as a pure next-cycle build, so the retarget walk is testable
// without Postgres.
vi.mock('#/server/portalConfig', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const { buildNextVerification: buildNext } = await import('#/lib/sg-dream')
  return {
    ...actual,
    todayISOInDenver: () => '2026-08-20',
    ensureNextVerification: vi.fn(
      (current: Parameters<typeof buildNext>[0]) =>
        Promise.resolve(buildNext(current)),
    ),
  }
})

describe('resolveIntakeContext', () => {
  it('uses a draft entity intake folder before Schedio assigns a public reference', async () => {
    const context = await resolveIntakeContext({
      clientId: 'dawson-trails-md1',
      verificationId: 'dawson-trails-md1-v1',
    })

    expect(context?.incomingFolder).toBe(
      '/Shared/Clients/Dawson Trails MD One/District/Intake/Draft/Incoming',
    )
  })

  it('keeps addressing the requested cycle when rollover is not requested', async () => {
    const context = await resolveIntakeContext({
      clientId: 'dawson-trails-md1',
      verificationId: 'dawson-trails-md1-v1',
    })

    expect(context?.verification.id).toBe('dawson-trails-md1-v1')
    expect(context?.rolledFrom).toBeUndefined()
  })

  it('rolls a late submission into the next cycle and reports the origin', async () => {
    // Seeded cutoff 2026-08-03, mocked today 2026-08-20 → one cycle late.
    const context = await resolveIntakeContext({
      clientId: 'dawson-trails-md1',
      verificationId: 'dawson-trails-md1-v1',
      rollPastCutoff: true,
    })

    expect(context?.verification.id).toBe('dawson-trails-md1-v2')
    expect(context?.verification.cutoffDateISO).toBe('2026-09-03')
    expect(context?.rolledFrom).toEqual({
      id: 'dawson-trails-md1-v1',
      period: 'Verification No. 01',
      cutoffDate: 'Aug 03, 2026',
    })
    // The public reference follows the destination cycle.
    expect(context?.verificationRef).toContain('-V2-')
  })

  it('stops at the first cycle whose cutoff has not passed', async () => {
    const { ensureNextVerification } = await import('#/server/portalConfig')
    vi.mocked(ensureNextVerification).mockClear()

    await resolveIntakeContext({
      clientId: 'dawson-trails-md1',
      verificationId: 'dawson-trails-md1-v1',
      rollPastCutoff: true,
    })

    // v1 (2026-08-03) is late against the mocked 2026-08-20; its successor
    // (2026-09-03) is not — exactly one hop.
    expect(ensureNextVerification).toHaveBeenCalledTimes(1)
  })
})

describe('classifiedFolderFromIncomingPath', () => {
  it('keeps promotion inside the same intake folder as the incoming file', () => {
    expect(
      classifiedFolderFromIncomingPath({
        incomingPath:
          '/Shared/Clients/Dawson Trails MD One/District/Intake/Draft/Incoming/invoice.pdf',
        docType: 'INV',
      }),
    ).toBe(
      '/Shared/Clients/Dawson Trails MD One/District/Intake/Draft/Classified/INV',
    )
  })
})
