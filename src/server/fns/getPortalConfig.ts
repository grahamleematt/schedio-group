/**
 * Session-scoped portal configuration: the verification schedule and vendor
 * contract authorizations for every entity the signed-in user can access,
 * plus the server-computed "today" used for cutoff countdown math.
 *
 * Loaded once by the root loader (react-query) and consumed by every route
 * through `useActiveEntity` / `portalConfigQuery`. Unauthenticated sessions
 * get empty lists — the login and blocked surfaces don't render schedule
 * data.
 */

import { createServerFn } from '@tanstack/react-start'

import type { Vendor, Verification } from '#/lib/sg-dream'
import { AuthzError, resolvePortalUser } from '#/server/authz'
import { isEgnyteExportEnabled } from '#/server/env'
import {
  listVendorConfigs,
  listVerificationConfigs,
  todayISOInDenver,
} from '#/server/portalConfig'

export type PortalConfig = {
  /** Today in the entity timezone (`YYYY-MM-DD`); drives cutoff countdowns. */
  todayISO: string
  verifications: ReadonlyArray<Verification>
  vendors: ReadonlyArray<Vendor>
  /**
   * False while Egnyte export (staging + filing) is paused for lack of space.
   * The confirmation page swaps its "File to Egnyte" copy accordingly.
   */
  egnyteExportEnabled: boolean
}

export const getPortalConfig = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PortalConfig> => {
    let permitted: ReadonlyArray<string> = []
    try {
      permitted = (await resolvePortalUser()).permittedClientIds
    } catch (err) {
      if (!(err instanceof AuthzError)) throw err
    }
    const todayISO = todayISOInDenver()
    const egnyteExportEnabled = isEgnyteExportEnabled()
    if (permitted.length === 0) {
      return { todayISO, verifications: [], vendors: [], egnyteExportEnabled }
    }
    const [verifications, vendors] = await Promise.all([
      listVerificationConfigs(),
      listVendorConfigs(),
    ])
    const allowed = new Set(permitted)
    return {
      todayISO,
      egnyteExportEnabled,
      verifications: verifications.filter((v) => allowed.has(v.clientId)),
      vendors: vendors.filter((v) => allowed.has(v.clientId)),
    }
  },
)
