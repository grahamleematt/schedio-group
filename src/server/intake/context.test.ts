import { describe, expect, it } from 'vitest'

import {
  classifiedFolderFromIncomingPath,
  resolveIntakeContext,
} from './context'

describe('resolveIntakeContext', () => {
  it('uses a draft entity intake folder before Schedio assigns a public reference', () => {
    const context = resolveIntakeContext({
      clientId: 'dawson-trails-md1',
      verificationId: 'dawson-trails-md1-v1',
    })

    expect(context?.incomingFolder).toBe(
      '/Shared/Clients/Dawson Trails MD One/District/Intake/Draft/Incoming',
    )
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
