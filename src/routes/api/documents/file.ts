/**
 * Streams a submitted document's original bytes for the in-app extraction
 * overlay viewer. Prefers Egnyte custody (classified path when filed,
 * otherwise the incoming/import path, via the shared service token) and falls
 * back to DocuPipe's original-file download — the rendition DocuPipe actually
 * extracted from, so overlay geometry always matches. Bytes are proxied
 * through this route rather than redirecting to the presigned URL, because
 * pdf.js fetches the file itself and the storage origin doesn't serve CORS.
 *
 * Auth: caller must be a signed-in portal user with access to the document's
 * client. Egnyte paths and DocuPipe IDs never leave the server — the browser
 * only sees `?verification=&doc=`.
 */

import { createFileRoute } from '@tanstack/react-router'

import { assertClientAccess, authzJsonError } from '#/server/authz'
import { getOriginalFileUrl } from '#/server/docupipe'
import { downloadFile } from '#/server/egnyte'
import { isDocupipeConfigured, isEgnyteConfigured } from '#/server/env'
import { getStore } from '#/server/store'
import type { StoredDocument } from '#/server/store'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function loadFromEgnyte(
  doc: StoredDocument,
): Promise<{ contents: ArrayBuffer; contentType?: string } | null> {
  if (!isEgnyteConfigured()) return null
  const egnytePath =
    doc.egnyteClassifiedPath ?? doc.egnyteIncomingPath ?? doc.egnyteSourcePath
  if (!egnytePath) return null
  try {
    return await downloadFile({ path: egnytePath })
  } catch (err) {
    console.warn(
      '[documents/file] egnyte download failed, trying docupipe',
      err,
    )
    return null
  }
}

async function loadFromDocupipe(
  doc: StoredDocument,
): Promise<{ contents: ArrayBuffer; contentType?: string } | null> {
  if (!isDocupipeConfigured() || !doc.docupipeDocumentId) return null
  const url = await getOriginalFileUrl(doc.docupipeDocumentId)
  if (!url) return null
  const res = await fetch(url)
  if (!res.ok) return null
  return {
    contents: await res.arrayBuffer(),
    contentType: res.headers.get('content-type') ?? undefined,
  }
}

export const Route = createFileRoute('/api/documents/file')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const verificationId = url.searchParams.get('verification') ?? ''
        const documentId = url.searchParams.get('doc') ?? ''
        if (!verificationId || !documentId) {
          return jsonError('missing verification or doc parameter', 400)
        }

        const snapshot = await getStore().getSnapshot(verificationId)
        const doc = snapshot?.verification.documents.find(
          (d) => d.id === documentId,
        )
        if (!doc) return jsonError('document not found', 404)

        try {
          await assertClientAccess(doc.clientId)
        } catch (err) {
          const authError = authzJsonError(err)
          if (authError) return authError
          throw err
        }

        try {
          const file =
            (await loadFromEgnyte(doc)) ?? (await loadFromDocupipe(doc))
          if (!file) {
            return jsonError('document has no retrievable copy', 404)
          }
          const filename = (doc.renamedName ?? doc.originalName).replace(
            /"/g,
            '',
          )
          return new Response(file.contents, {
            status: 200,
            headers: {
              'content-type':
                doc.mimeType ?? file.contentType ?? 'application/pdf',
              'content-disposition': `inline; filename="${filename}"`,
              'cache-control': 'private, max-age=300',
            },
          })
        } catch (err) {
          console.error('[documents/file] download failed', err)
          return jsonError('document download failed', 502)
        }
      },
    },
  },
})
