import { createFileRoute } from '@tanstack/react-router'

import {
  intelligencePreviewDisabledResponse,
  isIntelligencePreviewOff,
} from '#/server/preview'
import { readSourceDocumentById } from '#/server/determinations/source'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/determination-documents')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        const url = new URL(request.url)
        const sourceId = url.searchParams.get('sourceId') ?? ''
        if (!sourceId) return jsonResponse({ error: 'missing sourceId' }, 400)
        try {
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
          console.error('[determination-documents] stream failed', err)
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
