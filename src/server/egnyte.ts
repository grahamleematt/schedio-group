/**
 * Minimal typed wrapper over the Egnyte Public API v1.
 *
 * Used to implement the SG DREAM System Constitution Layer 1 "Document
 * Custody" state machine. This module only does the transitions this phase
 * cares about — Incoming/ upload + Classified/ move. Relied/ and Locked/
 * come later with engineer approval.
 *
 * Docs: https://developers.egnyte.com/docs/read/File_System_Management_API_Documentation
 */

import { getEgnyteEnv } from './env'

export class EgnyteError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'EgnyteError'
    this.status = status
    this.body = body
  }
}

export type EgnyteFileRef = {
  /** Egnyte GUID / `entry_id`; stable identifier across moves and renames. */
  guid: string
  /** Full server path at the time of the call. */
  path: string
  /** Hex checksum returned by Egnyte after an upload. */
  checksum?: string
}

type TokenCache = {
  accessToken: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null
const REFRESH_EARLY_MS = 5 * 60 * 1000

function baseUrl(): string {
  const env = getEgnyteEnv()
  return `https://${env.EGNYTE_DOMAIN}.egnyte.com`
}

/**
 * Encode a path for use in `/pubapi/v1/fs{-content}/...`. Per Egnyte's docs,
 * the forward slashes between segments must NOT be encoded, but the segment
 * text itself must be (spaces, unicode, punctuation, etc.).
 */
export function encodeEgnytePath(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

/**
 * Build a human-facing Egnyte Web URL for a given full path. The `1` prefix
 * in the fragment is Egnyte's "file" hash token; works for both files and
 * folders.
 */
export function egnyteWebUrl(fullPath: string): string {
  const env = getEgnyteEnv()
  const encoded = fullPath
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `https://${env.EGNYTE_DOMAIN}.egnyte.com/app/index.do#storage/files/1${encoded}`
}

async function refreshAccessToken(): Promise<string> {
  const env = getEgnyteEnv()
  const url = `${baseUrl()}/puboauth/token`
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: env.EGNYTE_CLIENT_ID,
    client_secret: env.EGNYTE_CLIENT_SECRET,
    refresh_token: env.EGNYTE_REFRESH_TOKEN,
  })
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  const text = await res.text()
  let parsed: unknown = text
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text)
    } catch {
      // keep as text
    }
  }
  if (!res.ok) {
    throw new EgnyteError(
      res.status,
      parsed,
      `Egnyte OAuth token refresh failed: ${res.status}`,
    )
  }
  const obj = parsed as {
    access_token?: string
    expires_in?: number
    token_type?: string
  }
  if (!obj.access_token) {
    throw new EgnyteError(500, parsed, 'Egnyte OAuth response missing access_token')
  }
  const ttlMs = (obj.expires_in ?? 3600) * 1000
  tokenCache = {
    accessToken: obj.access_token,
    expiresAt: Date.now() + ttlMs,
  }
  return obj.access_token
}

async function getAccessToken(): Promise<string> {
  if (
    tokenCache &&
    tokenCache.expiresAt - REFRESH_EARLY_MS > Date.now()
  ) {
    return tokenCache.accessToken
  }
  return refreshAccessToken()
}

async function egFetch<T>(
  path: string,
  init: RequestInit & { rawBody?: boolean } = {},
): Promise<T> {
  const token = await getAccessToken()
  const url = `${baseUrl()}${path}`
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let body: unknown = text
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      // keep as text (e.g. empty success responses)
    }
  }
  if (!res.ok) {
    throw new EgnyteError(
      res.status,
      body,
      `Egnyte ${init.method ?? 'GET'} ${path} failed: ${res.status}`,
    )
  }
  return body as T
}

/**
 * Upload a file to Egnyte. The file is written to `<path>` as-is; parent
 * folders must already exist (call `createFolderIfMissing` first — or use
 * `uploadToFolder` which chains them).
 */
export async function uploadFile(input: {
  path: string
  contents: ArrayBuffer | Uint8Array
  contentType?: string
}): Promise<EgnyteFileRef> {
  const encoded = encodeEgnytePath(input.path)
  // Node's `fetch` typings don't advertise `Uint8Array` as `BodyInit`, but a
  // Blob is accepted everywhere and avoids an extra copy on the runtime side.
  const buf =
    input.contents instanceof Uint8Array
      ? input.contents.slice().buffer
      : input.contents
  const bodyBlob = new Blob([buf], {
    type: input.contentType ?? 'application/octet-stream',
  })
  const res = await fetch(`${baseUrl()}/pubapi/v1/fs-content/${encoded}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      'Content-Type': input.contentType ?? 'application/octet-stream',
    },
    body: bodyBlob,
  })
  if (!res.ok) {
    const text = await res.text()
    let parsed: unknown = text
    try {
      parsed = text.length > 0 ? JSON.parse(text) : text
    } catch {
      // leave as text
    }
    throw new EgnyteError(
      res.status,
      parsed,
      `Egnyte POST /fs-content failed: ${res.status}`,
    )
  }
  // Egnyte returns the new entry's GUID in `ETag` and `X-Sha512-Checksum`.
  const guid = res.headers.get('etag')?.replace(/"/g, '') ?? ''
  const checksum = res.headers.get('x-sha512-checksum') ?? undefined
  return {
    guid,
    path: input.path,
    checksum,
  }
}

/**
 * Ensure the given folder path exists. Idempotent: a 403 "folder already
 * exists" response is swallowed. Creates parents recursively.
 */
export async function createFolderIfMissing(path: string): Promise<void> {
  const encoded = encodeEgnytePath(path)
  try {
    await egFetch(`/pubapi/v1/fs/${encoded}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_folder' }),
    })
  } catch (err) {
    if (err instanceof EgnyteError && (err.status === 403 || err.status === 400)) {
      const body = err.body as { errorMessage?: string } | string | null
      const msg =
        typeof body === 'object' && body !== null ? body.errorMessage ?? '' : ''
      if (/already exists/i.test(msg) || /duplicate/i.test(msg)) return
    }
    throw err
  }
}

/**
 * True when the given error is an Egnyte response indicating the move
 * destination already exists. Callers that want idempotent behavior can
 * catch and inspect; we no longer swallow this in `moveFile` itself
 * because doing so masked filename-collision bugs (different documents
 * landing on the same destination silently lost the second move).
 */
export function isDestinationExistsError(err: unknown): boolean {
  if (!(err instanceof EgnyteError)) return false
  const body = err.body as { errorMessage?: string } | string | null
  const msg =
    typeof body === 'object' && body !== null ? body.errorMessage ?? '' : ''
  return /destination.*exists/i.test(msg) || /already exists/i.test(msg)
}

/**
 * Move (or rename) a file/folder. Egnyte's `action: 'move'` takes a
 * destination full-path; errors propagate (including destination-exists)
 * so the caller can decide whether the collision is benign (a duplicate
 * webhook for the same `egnyteGuid`) or a bug (two distinct documents
 * collided on a renamed-filename seq).
 */
export async function moveFile(input: {
  from: string
  to: string
}): Promise<void> {
  const encoded = encodeEgnytePath(input.from)
  await egFetch(`/pubapi/v1/fs/${encoded}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'move', destination: input.to }),
  })
}

/**
 * Stamp custom metadata on an Egnyte entry by its GUID. Used to round-trip
 * the DREAM `verificationRef` + store `documentId` onto each file so anyone
 * searching Egnyte can find the originating verification.
 */
export async function setMetadata(
  guid: string,
  namespace: string,
  values: Record<string, string | number | boolean | null>,
): Promise<void> {
  await egFetch(`/pubapi/v2/files/${encodeURIComponent(guid)}/properties`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [namespace]: values }),
  })
}

/**
 * Chain `createFolderIfMissing` + `uploadFile`. Use this from higher-level
 * flows that want "put file here, don't worry about the folder".
 */
export async function uploadToFolder(input: {
  folder: string
  filename: string
  contents: ArrayBuffer | Uint8Array
  contentType?: string
}): Promise<EgnyteFileRef> {
  await createFolderIfMissing(input.folder)
  return uploadFile({
    path: `${input.folder.replace(/\/$/, '')}/${input.filename}`,
    contents: input.contents,
    contentType: input.contentType,
  })
}

/**
 * Reset the in-memory token cache. Used by tests; the token refreshes on
 * the next call.
 */
export function __resetTokenCache(): void {
  tokenCache = null
}
