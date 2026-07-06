/**
 * Pure read of the DREAM snapshot for a verification. Used by every route
 * loader via `context.queryClient.ensureQueryData`.
 */

import { createServerFn } from '@tanstack/react-start'

import { clients as configuredClients, formatRef } from '#/lib/sg-dream'
import { getVerificationConfigById } from '#/server/portalConfig'
import { getStore } from '#/server/store'
import type { DreamSnapshot } from '#/server/store'
import { assertClientAccess } from '#/server/authz'

async function seedMetadata(verificationId: string) {
  const verification = await getVerificationConfigById(verificationId)
  if (!verification) return null
  const client = configuredClients.find((c) => c.id === verification.clientId)
  if (!client) return null
  return {
    clientId: client.id,
    ref: formatRef({
      workflow: client.workflow,
      number: verification.number,
      year: verification.year,
      seq: verification.seq,
    }),
  }
}

export const getVerificationSnapshot = createServerFn({ method: 'GET' })
  .inputValidator((data: { verificationId: string }) => data)
  .handler(async ({ data }): Promise<DreamSnapshot | null> => {
    const store = getStore()
    const metadata = await seedMetadata(data.verificationId)
    if (metadata) {
      await assertClientAccess(metadata.clientId)
      await store.ensureVerification({
        verificationId: data.verificationId,
        clientId: metadata.clientId,
        ref: metadata.ref,
      })
    }
    return store.getSnapshot(data.verificationId)
  })
