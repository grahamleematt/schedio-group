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

export type EgnyteListedFile = {
  name: string
  path: string
  entryId?: string
  groupId?: string
  sizeBytes?: number
  checksum?: string
  lastModified?: string
  mimeType?: string
}

export type EgnyteListedFolder = {
  name: string
  path: string
  folderId?: string
}

export type EgnyteFolderListing = {
  name: string
  path: string
  folderId?: string
  files: Array<EgnyteListedFile>
  folders: Array<EgnyteListedFolder>
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

export function egnyteFileWebUrlById(entryId: string): string {
  return `${baseUrl()}/navigate/file/${encodeURIComponent(entryId)}`
}

export function egnyteFolderWebUrlById(folderId: string): string {
  return `${baseUrl()}/navigate/folder/${encodeURIComponent(folderId)}`
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
    throw new EgnyteError(
      500,
      parsed,
      'Egnyte OAuth response missing access_token',
    )
  }
  const ttlMs = (obj.expires_in ?? 3600) * 1000
  tokenCache = {
    accessToken: obj.access_token,
    expiresAt: Date.now() + ttlMs,
  }
  return obj.access_token
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - REFRESH_EARLY_MS > Date.now()) {
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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function childPath(parent: string, childName: string): string {
  return `${parent.replace(/\/$/, '')}/${childName}`
}

function normalizeListedFile(
  parentPath: string,
  value: Record<string, unknown>,
): EgnyteListedFile | null {
  const name = asString(value.name)
  const path = asString(value.path) ?? (name ? childPath(parentPath, name) : '')
  if (!name || !path) return null
  return {
    name,
    path,
    entryId:
      asString(value.entry_id) ??
      asString(value.entryId) ??
      asString(value.id) ??
      asString(value.guid),
    groupId: asString(value.group_id) ?? asString(value.groupId),
    sizeBytes: asNumber(value.size) ?? asNumber(value.size_bytes),
    checksum:
      asString(value.checksum) ??
      asString(value.sha512_checksum) ??
      asString(value.sha512Checksum),
    lastModified:
      asString(value.last_modified) ??
      asString(value.lastModified) ??
      asString(value.modified_at),
    mimeType:
      asString(value.mime_type) ??
      asString(value.mimeType) ??
      asString(value.content_type),
  }
}

function normalizeListedFolder(
  parentPath: string,
  value: Record<string, unknown>,
): EgnyteListedFolder | null {
  const name = asString(value.name)
  const path = asString(value.path) ?? (name ? childPath(parentPath, name) : '')
  if (!name || !path) return null
  return {
    name,
    path,
    folderId:
      asString(value.folder_id) ??
      asString(value.folderId) ??
      asString(value.group_id) ??
      asString(value.id),
  }
}

export async function listFolder(input: {
  path: string
  includePermissions?: boolean
  includeCustomMetadata?: boolean
}): Promise<EgnyteFolderListing> {
  const encoded = encodeEgnytePath(input.path)
  const params = new URLSearchParams()
  if (input.includePermissions) params.set('include_perm', 'true')
  if (input.includeCustomMetadata) params.set('list_custom_metadata', 'true')
  const query = params.toString()
  const suffix = query.length > 0 ? `?${query}` : ''
  const raw = await egFetch<Record<string, unknown>>(
    `/pubapi/v1/fs/${encoded}${suffix}`,
  )
  const folders = Array.isArray(raw.folders)
    ? raw.folders
        .map((f) =>
          f && typeof f === 'object'
            ? normalizeListedFolder(input.path, f as Record<string, unknown>)
            : null,
        )
        .filter((f): f is EgnyteListedFolder => Boolean(f))
    : []
  const files = Array.isArray(raw.files)
    ? raw.files
        .map((f) =>
          f && typeof f === 'object'
            ? normalizeListedFile(input.path, f as Record<string, unknown>)
            : null,
        )
        .filter((f): f is EgnyteListedFile => Boolean(f))
    : []
  return {
    name:
      asString(raw.name) ?? input.path.split('/').filter(Boolean).pop() ?? '',
    path: asString(raw.path) ?? input.path,
    folderId: asString(raw.folder_id) ?? asString(raw.folderId),
    files,
    folders,
  }
}

export async function downloadFile(input: {
  path: string
}): Promise<{ contents: ArrayBuffer; contentType?: string }> {
  const encoded = encodeEgnytePath(input.path)
  const res = await fetch(`${baseUrl()}/pubapi/v1/fs-content/${encoded}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      Accept: 'application/octet-stream',
    },
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
      `Egnyte GET /fs-content failed: ${res.status}`,
    )
  }
  return {
    contents: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') ?? undefined,
  }
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
    if (
      err instanceof EgnyteError &&
      (err.status === 403 || err.status === 400)
    ) {
      const body = err.body as { errorMessage?: string } | string | null
      const msg =
        typeof body === 'object' && body !== null
          ? (body.errorMessage ?? '')
          : ''
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
    typeof body === 'object' && body !== null ? (body.errorMessage ?? '') : ''
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
 * searching Egnyte can find the originating draft submission.
 */
export async function setMetadata(
  entryId: string,
  namespace: string,
  values: Record<string, string | number | boolean | null>,
): Promise<void> {
  await egFetch(
    `/pubapi/v1/fs/ids/file/${encodeURIComponent(
      entryId,
    )}/properties/${encodeURIComponent(namespace)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    },
  )
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
