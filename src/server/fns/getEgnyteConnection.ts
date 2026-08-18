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
import { isEgnyteAppConfigured, isEgnyteConfigured } from '#/server/env'

export type EgnyteConnectionInfo = EgnyteConnectionStatus & {
  /**
   * True when Egnyte imports can run for this user: either the shared service
   * token is configured or the user has linked their own Egnyte account.
   * Drives the upload page's "Import from Egnyte" vs "Connect Egnyte" state.
   */
  importReady: boolean
}

export const getEgnyteConnection = createServerFn({ method: 'GET' }).handler(
  async (): Promise<EgnyteConnectionInfo> => {
    try {
      const user = await resolvePortalUser()
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
