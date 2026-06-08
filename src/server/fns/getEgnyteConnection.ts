/**
 * Egnyte connection status for the signed-in portal user. Drives the
 * Integrations settings card and the header status pill. Returns a
 * disconnected (but app-configured-aware) status for unauthenticated callers
 * rather than throwing, so chrome can render before sign-in resolves.
 */

import { createServerFn } from '@tanstack/react-start'

import { AuthzError, resolvePortalUser } from '#/server/authz'
import { getEgnyteConnectionStatus } from '#/server/egnyteConnections'
import type { EgnyteConnectionStatus } from '#/server/egnyteConnections'
import { isEgnyteAppConfigured } from '#/server/env'

export const getEgnyteConnection = createServerFn({ method: 'GET' }).handler(
  async (): Promise<EgnyteConnectionStatus> => {
    try {
      const user = await resolvePortalUser()
      return await getEgnyteConnectionStatus(user.id)
    } catch (err) {
      if (err instanceof AuthzError) {
        return { connected: false, appConfigured: isEgnyteAppConfigured() }
      }
      throw err
    }
  },
)
