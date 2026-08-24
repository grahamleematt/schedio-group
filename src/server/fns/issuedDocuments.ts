/**
 * Schedio-issued deliverables — server fns behind the "Reports & issued
 * documents" card on /dashboard and /verifications.
 *
 * Reading is open to anyone with access to the entity (clients see what
 * Schedio has published to them). Publishing and removing are internal-only
 * (sg_admin / sg_pm) and audit-logged. Files upload to Vercel Blob first via
 * /api/blob-token (`kind: 'issued'`), then the URL lands here.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { del } from '@vercel/blob'

import {
  assertClientAccess,
  assertInternalClientAccess,
} from '#/server/authz'
import {
  listIssuedDocumentsForClient,
  removeIssuedDocument,
  storeIssuedDocument,
} from '#/server/issuedDocuments'
import type { IssuedDocument } from '#/server/issuedDocuments'
import { getVerificationConfigById } from '#/server/portalConfig'
import { getStore } from '#/server/store'

const TITLE_MAX = 200
const NOTE_MAX = 1_000

export type IssueDocumentInput = {
  clientId: string
  verificationId?: string
  title: string
  note?: string
  fileUrl: string
  fileName: string
  contentType?: string
  sizeBytes?: number
}

export type IssueDocumentResult =
  | { ok: true; document: IssuedDocument }
  | { ok: false; error: string }

/**
 * The file must be a blob the browser just uploaded through our authenticated
 * `/api/blob-token` route under `issued/` — anything else (arbitrary links,
 * data URIs, other stores) is rejected.
 */
function assertIssuedBlobUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid file URL')
  }
  if (
    parsed.protocol !== 'https:' ||
    !parsed.hostname.endsWith('.blob.vercel-storage.com') ||
    !parsed.pathname.startsWith('/issued/')
  ) {
    throw new Error('Files must be uploaded through the portal')
  }
}

export const listIssuedDocuments = createServerFn({ method: 'GET' })
  .inputValidator((data: { clientId: string }) => data)
  .handler(async ({ data }): Promise<IssuedDocument[]> => {
    await assertClientAccess(data.clientId)
    return listIssuedDocumentsForClient(data.clientId)
  })

export const issueDocument = createServerFn({ method: 'POST' })
  .inputValidator((data: IssueDocumentInput): IssueDocumentInput => {
    const title = data.title.trim()
    if (title.length === 0) throw new Error('A document title is required')
    assertIssuedBlobUrl(data.fileUrl)
    return {
      clientId: data.clientId,
      verificationId:
        typeof data.verificationId === 'string' &&
        data.verificationId.length > 0
          ? data.verificationId.slice(0, 100)
          : undefined,
      title: title.slice(0, TITLE_MAX),
      note:
        typeof data.note === 'string' && data.note.trim().length > 0
          ? data.note.trim().slice(0, NOTE_MAX)
          : undefined,
      fileUrl: data.fileUrl,
      fileName:
        typeof data.fileName === 'string' && data.fileName.trim().length > 0
          ? data.fileName.trim().slice(0, 200)
          : 'document.pdf',
      contentType:
        typeof data.contentType === 'string'
          ? data.contentType.slice(0, 100)
          : undefined,
      sizeBytes:
        typeof data.sizeBytes === 'number' && Number.isFinite(data.sizeBytes)
          ? data.sizeBytes
          : undefined,
    }
  })
  .handler(async ({ data }): Promise<IssueDocumentResult> => {
    const user = await assertInternalClientAccess(data.clientId)

    if (data.verificationId) {
      const verification = await getVerificationConfigById(data.verificationId)
      if (!verification || verification.clientId !== data.clientId) {
        return { ok: false, error: 'Unknown review cycle for this entity' }
      }
    }

    let document: IssuedDocument
    try {
      document = await storeIssuedDocument({
        id: randomUUID(),
        clientId: data.clientId,
        verificationId: data.verificationId,
        title: data.title,
        note: data.note,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        contentType: data.contentType,
        sizeBytes: data.sizeBytes,
        issuedByName: user.name,
        issuedByEmail: user.email,
      })
    } catch (err) {
      console.warn('[issued-documents] publish failed', err)
      return {
        ok: false,
        error: 'Could not publish the document — try again.',
      }
    }

    // Best-effort audit trail; the document itself already landed above.
    try {
      await getStore().appendAuditEvent({
        id: randomUUID(),
        ts: new Date().toISOString(),
        source: 'user',
        category: 'system',
        actor: user.name,
        event: 'Document issued to client',
        object: data.title,
        result: 'ok',
        clientId: data.clientId,
        detail: data.fileName,
      })
    } catch (err) {
      console.warn('[issued-documents] audit write failed', err)
    }

    return { ok: true, document }
  })

export type RemoveIssuedDocumentResult =
  | { ok: true }
  | { ok: false; error: string }

export const deleteIssuedDocument = createServerFn({ method: 'POST' })
  .inputValidator((data: { id: string; clientId: string }) => data)
  .handler(async ({ data }): Promise<RemoveIssuedDocumentResult> => {
    const user = await assertInternalClientAccess(data.clientId)
    const removed = await removeIssuedDocument(data.id, data.clientId)
    if (!removed) {
      return { ok: false, error: 'Document not found' }
    }

    // Best-effort blob cleanup — the row is already gone, so a failed delete
    // only leaves an orphaned (unguessable) blob behind.
    try {
      await del(removed.fileUrl)
    } catch (err) {
      console.warn('[issued-documents] blob delete failed', err)
    }

    try {
      await getStore().appendAuditEvent({
        id: randomUUID(),
        ts: new Date().toISOString(),
        source: 'user',
        category: 'system',
        actor: user.name,
        event: 'Issued document removed',
        object: removed.title,
        result: 'ok',
        clientId: data.clientId,
        detail: removed.fileName,
      })
    } catch (err) {
      console.warn('[issued-documents] audit write failed', err)
    }

    return { ok: true }
  })
