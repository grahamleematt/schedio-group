import { createFileRoute } from '@tanstack/react-router'

import { createDawsonIntelligencePackage } from '#/server/intelligence/source'
import type { DawsonIntelligenceScopeId } from '#/server/intelligence/source'
import {
  intelligencePreviewDisabledResponse,
  isIntelligencePreviewOff,
} from '#/server/preview'
import { getIntelligenceStore } from '#/server/intelligence/store'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/intelligence/imports')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (isIntelligencePreviewOff()) {
          return intelligencePreviewDisabledResponse()
        }
        try {
          const body = (await request.json().catch(() => ({}))) as {
            importedBy?: string
            scopeId?: DawsonIntelligenceScopeId
          }
          const { pkg, sourceWarnings } = await createDawsonIntelligencePackage(
            {
              importedBy: body.importedBy?.trim() || 'Tim',
              scopeId:
                body.scopeId === 'developer' || body.scopeId === 'district'
                  ? body.scopeId
                  : 'district',
            },
          )
          await getIntelligenceStore().upsertPackage(pkg)
          return jsonResponse({
            import: pkg.importRow,
            documents: pkg.documents.length,
            segments: pkg.segments.length,
            sourceWarnings,
          })
        } catch (err) {
          console.error('[intelligence/imports] failed', err)
          return jsonResponse(
            {
              error: err instanceof Error ? err.message : 'import failed',
            },
            500,
          )
        }
      },
    },
  },
})
