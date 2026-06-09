/**
 * Vercel Blob client-upload token endpoint.
 *
 * Documents larger than Vercel's ~4.5 MB serverless request-body cap can't ride
 * the normal multipart `/api/uploads` path. Instead the browser uploads them
 * directly to Blob storage; this route hands out the short-lived, scoped client
 * token that authorizes that direct upload. We authenticate + authorize the
 * caller (entity access) inside `onBeforeGenerateToken` BEFORE any token is
 * minted — without that check the Blob store would be open to the public.
 *
 * Ingestion is NOT driven by `onUploadCompleted` (that callback never fires on
 * localhost and can be skipped on Vercel): after the direct upload resolves, the
 * client makes an explicit follow-up POST to `/api/uploads` with the blob URL,
 * and the server fetches + ingests + deletes it there. See src/routes/upload.tsx
 * and the JSON branch of src/routes/api/uploads.ts.
 */

import { createFileRoute } from '@tanstack/react-router'
import { handleUpload } from '@vercel/blob/client'
import type { HandleUploadBody } from '@vercel/blob/client'

import { assertClientAccess, authzJsonError } from '#/server/authz'
import { isBlobConfigured, isIntakePipelineEnabled } from '#/server/env'

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/tiff',
  'image/jpeg',
  'image/png',
]

/** Sane ceiling well under Blob's 5 TB limit; intake docs are never this big. */
const MAX_BLOB_BYTES = 200 * 1024 * 1024

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/blob-token')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isIntakePipelineEnabled()) {
          return jsonResponse(
            { error: 'intake pipeline is disabled (INTAKE_PIPELINE_ENABLED)' },
            503,
          )
        }
        if (!isBlobConfigured()) {
          return jsonResponse(
            {
              error:
                'large-file upload is not configured (Vercel Blob); import the document from Egnyte instead',
            },
            503,
          )
        }

        let body: HandleUploadBody
        try {
          body = (await request.json()) as HandleUploadBody
        } catch {
          return jsonResponse({ error: 'invalid request body' }, 400)
        }

        try {
          const result = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (_pathname, clientPayload) => {
              const { clientId } = JSON.parse(clientPayload ?? '{}') as {
                clientId?: string
              }
              if (!clientId) {
                throw new Error('missing clientId in upload payload')
              }
              // Same entity-access gate the multipart upload path enforces.
              await assertClientAccess(clientId)
              return {
                allowedContentTypes: ALLOWED_CONTENT_TYPES,
                addRandomSuffix: true,
                maximumSizeInBytes: MAX_BLOB_BYTES,
                tokenPayload: clientPayload ?? null,
              }
            },
            onUploadCompleted: async () => {
              // Intentionally empty: ingestion runs from the client's explicit
              // follow-up POST to /api/uploads, not this callback.
            },
          })
          return jsonResponse(result)
        } catch (err) {
          const authError = authzJsonError(err)
          if (authError) return authError
          const message =
            err instanceof Error ? err.message : 'blob token request failed'
          // 400 so the Blob client surfaces the reason rather than retrying.
          return jsonResponse({ error: message }, 400)
        }
      },
    },
  },
})
