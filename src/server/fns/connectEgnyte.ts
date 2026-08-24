/**
 * Link the signed-in portal user's Egnyte account via the Resource Owner
 * Password flow. Returns a discriminated result instead of throwing for
 * expected failures (bad credentials, unconfigured app) so the UI can show a
 * precise message — server-fn error serialization would otherwise collapse to
 * a generic 500 in production.
 */

import { createServerFn } from '@tanstack/react-start'

import { AuthzError, resolvePortalUser } from '#/server/authz'
import {
  EgnyteConnectError,
  connectEgnyteForUser,
} from '#/server/egnyteConnections'
import { isEgnyteConfigured } from '#/server/env'
import type { EgnyteConnectionInfo } from '#/server/fns/getEgnyteConnection'

export type ConnectEgnyteResult =
  | { ok: true; status: EgnyteConnectionInfo }
  | { ok: false; error: string }

export const connectEgnyte = createServerFn({ method: 'POST' })
  .inputValidator((data: { username: string; password: string }) => data)
  .handler(async ({ data }): Promise<ConnectEgnyteResult> => {
    let userId: string
    try {
      const user = await resolvePortalUser()
      userId = user.id
    } catch (err) {
      if (err instanceof AuthzError) {
        return { ok: false, error: 'Sign in before linking Egnyte.' }
      }
      throw err
    }

    try {
      const status = await connectEgnyteForUser({
        userId,
        username: data.username,
        password: data.password,
      })
      return {
        ok: true,
        status: {
          ...status,
          importReady: isEgnyteConfigured() || status.connected,
        },
      }
    } catch (err) {
      if (err instanceof EgnyteConnectError) {
        return { ok: false, error: err.message }
      }
      throw err
    }
  })
