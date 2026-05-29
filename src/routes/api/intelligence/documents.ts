import { createFileRoute } from '@tanstack/react-router'

import {
  intelligencePreviewDisabledResponse,
  isIntelligencePreviewOff,
} from '#/server/preview'
import { readSourceDocumentById } from '#/server/intelligence/source'
import { getIntelligenceStore } from '#/server/intelligence/store'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/intelligence/documents')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        const url = new URL(request.url)
        const documentId = url.searchParams.get('documentId') ?? ''
        const sourceDocumentId = url.searchParams.get('sourceDocumentId') ?? ''
        if (!documentId && !sourceDocumentId) {
          return jsonResponse({ error: 'missing document id' }, 400)
        }

        try {
          let sourceId = sourceDocumentId
          if (!sourceId) {
            const workspace = await getIntelligenceStore().getWorkspace()
            const doc = workspace.documents.find((row) => row.id === documentId)
            sourceId = doc?.sourceDocumentId ?? ''
          }
          if (!sourceId) {
            return jsonResponse({ error: 'source document not found' }, 404)
          }
          const result = await readSourceDocumentById(sourceId)
          if (!result) {
            return jsonResponse({ error: 'source document not found' }, 404)
          }
          return new Response(new Uint8Array(result.bytes), {
            status: 200,
            headers: {
              'content-type': result.doc.mimeType,
              'content-disposition': `inline; filename="${result.doc.fileName.replace(/"/g, '')}"`,
              'cache-control': 'private, max-age=60',
            },
          })
        } catch (err) {
          console.error('[intelligence/documents] stream failed', err)
          return jsonResponse(
            {
              error:
                err instanceof Error ? err.message : 'document stream failed',
            },
            500,
          )
        }
      },
    },
  },
})
