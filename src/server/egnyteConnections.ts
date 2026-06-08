/**
 * Per-user Egnyte connections.
 *
 * Each portal user links their own Egnyte account with the Resource Owner
 * Password flow (the only flow our registered key supports): they submit their
 * Egnyte username + password once, we exchange it for a long-lived
 * `refresh_token`, verify it against `/pubapi/v1/userinfo`, and persist only the
 * encrypted refresh token. The password is never stored. Interactive file
 * operations later mint short-lived access tokens from that refresh token via
 * the connection's {@link EgnyteCredentials}.
 *
 * Background/webhook flows do not use these per-user tokens yet.
 */

import { decryptSecret, encryptSecret } from './crypto'
import { dbQuery } from './database'
import type { EgnyteCredentials } from './egnyte'
import { getEgnyteAppEnv, isDatabaseConfigured } from './env'

/** Scope required for the SG DREAM custody file operations. */
const SCOPE = 'Egnyte.filesystem'

export class EgnyteConnectError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'EgnyteConnectError'
    this.status = status
  }
}

export type EgnyteConnectionStatus = {
  connected: boolean
  egnyteUsername?: string
  egnyteUserId?: string
  connectedAt?: string
  lastVerifiedAt?: string
  /** True when the OAuth app itself is configured (gates the connect UI). */
  appConfigured: boolean
}

type ConnectionRow = {
  egnyte_domain: string
  egnyte_user_id: string | null
  egnyte_username: string
  refresh_token_encrypted: string
  connected_at: string
  last_verified_at: string | null
}

type PasswordTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  error?: string
  error_description?: string
}

type EgnyteUserInfo = {
  id?: number | string
  username?: string
  email?: string
  first_name?: string
  last_name?: string
}

function appBaseUrl(): string {
  return `https://${getEgnyteAppEnv().EGNYTE_DOMAIN}.egnyte.com`
}

/**
 * Resource Owner Password grant. Returns the refresh token (and a transient
 * access token used immediately to read userinfo). Throws an
 * {@link EgnyteConnectError} with a user-facing message on bad credentials.
 */
async function mintWithPassword(input: {
  username: string
  password: string
}): Promise<{ refreshToken: string; accessToken: string }> {
  const app = getEgnyteAppEnv()
  const body = new URLSearchParams({
    client_id: app.EGNYTE_CLIENT_ID,
    client_secret: app.EGNYTE_CLIENT_SECRET,
    username: input.username,
    password: input.password,
    grant_type: 'password',
    scope: SCOPE,
  })
  const res = await fetch(`${appBaseUrl()}/puboauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  const text = await res.text()
  let json: PasswordTokenResponse = {}
  try {
    json = text.length > 0 ? (JSON.parse(text) as PasswordTokenResponse) : {}
  } catch {
    json = {}
  }
  if (!res.ok) {
    const detail =
      json.error_description ??
      json.error ??
      (text.length > 0 ? text.slice(0, 200) : res.statusText)
    // Egnyte returns 400/401 for bad username/password.
    const status = res.status === 401 || res.status === 400 ? 401 : 502
    throw new EgnyteConnectError(
      status,
      status === 401
        ? `Egnyte rejected those credentials: ${detail}`
        : `Egnyte sign-in failed (${res.status}): ${detail}`,
    )
  }
  if (!json.refresh_token || !json.access_token) {
    throw new EgnyteConnectError(
      502,
      'Egnyte did not return a refresh token for this account.',
    )
  }
  return { refreshToken: json.refresh_token, accessToken: json.access_token }
}

async function fetchUserInfo(accessToken: string): Promise<EgnyteUserInfo> {
  const res = await fetch(`${appBaseUrl()}/pubapi/v1/userinfo`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new EgnyteConnectError(
      502,
      `Connected, but verifying the Egnyte account failed (${res.status}).`,
    )
  }
  return (await res.json()) as EgnyteUserInfo
}

function statusFromRow(
  row: ConnectionRow | undefined,
  appConfigured: boolean,
): EgnyteConnectionStatus {
  if (!row) return { connected: false, appConfigured }
  return {
    connected: true,
    appConfigured,
    egnyteUsername: row.egnyte_username,
    egnyteUserId: row.egnyte_user_id ?? undefined,
    connectedAt: row.connected_at,
    lastVerifiedAt: row.last_verified_at ?? undefined,
  }
}

async function readRow(userId: string): Promise<ConnectionRow | undefined> {
  const result = await dbQuery<ConnectionRow>(
    `
      select egnyte_domain, egnyte_user_id, egnyte_username,
             refresh_token_encrypted, connected_at, last_verified_at
      from intelligence_user_egnyte_connections
      where user_id = $1
    `,
    [userId],
  )
  return result.rows[0]
}

/** Connection status for the given portal user (no secrets returned). */
export async function getEgnyteConnectionStatus(
  userId: string,
): Promise<EgnyteConnectionStatus> {
  const appConfigured = Boolean(
    process.env.EGNYTE_DOMAIN &&
      process.env.EGNYTE_CLIENT_ID &&
      process.env.EGNYTE_CLIENT_SECRET,
  )
  if (!isDatabaseConfigured()) return { connected: false, appConfigured }
  const row = await readRow(userId)
  return statusFromRow(row, appConfigured)
}

/**
 * The per-user Egnyte credentials (app id/secret + this user's decrypted
 * refresh token) for minting access tokens during file operations. `null` when
 * the user has not connected or the database is unavailable.
 */
export async function buildEgnyteCredentialsForUser(
  userId: string,
): Promise<EgnyteCredentials | null> {
  if (!isDatabaseConfigured()) return null
  const row = await readRow(userId)
  if (!row) return null
  const app = getEgnyteAppEnv()
  return {
    domain: app.EGNYTE_DOMAIN,
    clientId: app.EGNYTE_CLIENT_ID,
    clientSecret: app.EGNYTE_CLIENT_SECRET,
    refreshToken: decryptSecret(row.refresh_token_encrypted),
  }
}

/**
 * Mint + verify + persist a connection for the given portal user. Returns the
 * resulting (secret-free) status. Throws {@link EgnyteConnectError} on bad
 * credentials or verification failure.
 */
export async function connectEgnyteForUser(input: {
  userId: string
  username: string
  password: string
}): Promise<EgnyteConnectionStatus> {
  if (!isDatabaseConfigured()) {
    throw new EgnyteConnectError(
      503,
      'A database connection is required to link Egnyte.',
    )
  }
  const username = input.username.trim()
  if (!username || !input.password) {
    throw new EgnyteConnectError(
      400,
      'Egnyte username and password are required.',
    )
  }

  const { refreshToken, accessToken } = await mintWithPassword({
    username,
    password: input.password,
  })
  const info = await fetchUserInfo(accessToken)
  const app = getEgnyteAppEnv()

  await dbQuery(
    `
      insert into intelligence_user_egnyte_connections (
        user_id, egnyte_domain, egnyte_user_id, egnyte_username,
        refresh_token_encrypted, scope, connected_at, updated_at,
        last_verified_at
      )
      values ($1, $2, $3, $4, $5, $6, now(), now(), now())
      on conflict (user_id) do update set
        egnyte_domain = excluded.egnyte_domain,
        egnyte_user_id = excluded.egnyte_user_id,
        egnyte_username = excluded.egnyte_username,
        refresh_token_encrypted = excluded.refresh_token_encrypted,
        scope = excluded.scope,
        updated_at = now(),
        last_verified_at = now()
    `,
    [
      input.userId,
      app.EGNYTE_DOMAIN,
      info.id != null ? String(info.id) : null,
      info.username ?? username,
      encryptSecret(refreshToken),
      SCOPE,
    ],
  )

  const row = await readRow(input.userId)
  return statusFromRow(row, true)
}

/** Remove the user's Egnyte connection. Idempotent. */
export async function disconnectEgnyteForUser(userId: string): Promise<void> {
  if (!isDatabaseConfigured()) return
  await dbQuery(
    `delete from intelligence_user_egnyte_connections where user_id = $1`,
    [userId],
  )
}
