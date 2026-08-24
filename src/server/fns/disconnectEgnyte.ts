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
import { isEgnyteAppConfigured, isEgnyteConfigured } from '#/server/env'
import type { EgnyteConnectionInfo } from '#/server/fns/getEgnyteConnection'

export const disconnectEgnyte = createServerFn({ method: 'POST' }).handler(
  async (): Promise<EgnyteConnectionInfo> => {
    try {
      const user = await resolvePortalUser()
      await disconnectEgnyteForUser(user.id)
      const status = await getEgnyteConnectionStatus(user.id)
      return {
        ...status,
        importReady: isEgnyteConfigured() || status.connected,
      }
    } catch (err) {
      if (err instanceof AuthzError) {
        return {
          connected: false,
          appConfigured: isEgnyteAppConfigured(),
          importReady: isEgnyteConfigured(),
        }
      }
      throw err
    }
  },
)
