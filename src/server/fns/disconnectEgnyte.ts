/**
 * Unlink the signed-in portal user's Egnyte account. Idempotent — returns the
 * resulting (disconnected) status.
 */

import { createServerFn } from '@tanstack/react-start'

import { AuthzError, resolvePortalUser } from '#/server/authz'
import {
  disconnectEgnyteForUser,
  getEgnyteConnectionStatus,
} from '#/server/egnyteConnections'
import type { EgnyteConnectionStatus } from '#/server/egnyteConnections'
import { isEgnyteAppConfigured } from '#/server/env'

export const disconnectEgnyte = createServerFn({ method: 'POST' }).handler(
  async (): Promise<EgnyteConnectionStatus> => {
    try {
      const user = await resolvePortalUser()
      await disconnectEgnyteForUser(user.id)
      return await getEgnyteConnectionStatus(user.id)
    } catch (err) {
      if (err instanceof AuthzError) {
        return { connected: false, appConfigured: isEgnyteAppConfigured() }
      }
      throw err
    }
  },
)
