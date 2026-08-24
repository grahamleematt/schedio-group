/**
 * Vercel Blob client-upload token endpoint.
 *
 * Two callers share this route, distinguished by `kind` in the client payload:
 *
 * 1. Intake documents (default) — files larger than Vercel's ~4.5 MB serverless
 *    request-body cap can't ride the normal multipart `/api/uploads` path, so
 *    the browser uploads them directly to Blob storage. Ingestion is NOT driven
 *    by `onUploadCompleted` (that callback never fires on localhost and can be
 *    skipped on Vercel): after the direct upload resolves, the client makes an
 *    explicit follow-up POST to `/api/uploads` with the blob URL. See
 *    src/routes/upload.tsx and the JSON branch of src/routes/api/uploads.ts.
 *
 * 2. `kind: 'feedback'` — screenshots/files attached in the Help & feedback
 *    dialog. Any signed-in portal user qualifies; the blob URL then travels
 *    with the `submitFeedback` server fn into Postgres and Slack.
 *
 * 3. `kind: 'issued'` — deliverables Schedio publishes to a client (cost
 *    verification reports). Internal roles with access to the entity only;
 *    the blob URL then lands in `dream_issued_documents` via `issueDocument`.
 *    Unlike intake docs these blobs are durable — they ARE the file custody.
 *
 * Either way the caller is authenticated inside `onBeforeGenerateToken` BEFORE
 * any token is minted — without that check the Blob store would be open to the
 * public.
 */

import { createFileRoute } from '@tanstack/react-router'
import { handleUpload } from '@vercel/blob/client'
import type { HandleUploadBody } from '@vercel/blob/client'

import {
  assertClientAccess,
  assertInternalClientAccess,
  authzJsonError,
  resolvePortalUser,
} from '#/server/authz'
import { isBlobConfigured, isIntakePipelineEnabled } from '#/server/env'

const ALLOWED_CONTENT_TYPES = [
  'application/pdf',
  'image/tiff',
  'image/jpeg',
  'image/png',
]

/** Sane ceiling well under Blob's 5 TB limit; intake docs are never this big. */
const MAX_BLOB_BYTES = 200 * 1024 * 1024

const FEEDBACK_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]

const MAX_FEEDBACK_BYTES = 10 * 1024 * 1024

const ISSUED_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/tiff',
]

const MAX_ISSUED_BYTES = 50 * 1024 * 1024

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
        if (!isBlobConfigured()) {
          return jsonResponse(
            {
              error:
                'file upload is not configured (Vercel Blob); import the document from Egnyte instead',
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
            onBeforeGenerateToken: async (pathname, clientPayload) => {
              const { kind, clientId } = JSON.parse(clientPayload ?? '{}') as {
                kind?: string
                clientId?: string
              }

              if (kind === 'feedback') {
                // Any signed-in portal user may attach files to feedback.
                await resolvePortalUser()
                if (!pathname.startsWith('feedback/')) {
                  throw new Error('feedback attachments must upload under feedback/')
                }
                return {
                  allowedContentTypes: FEEDBACK_CONTENT_TYPES,
                  addRandomSuffix: true,
                  maximumSizeInBytes: MAX_FEEDBACK_BYTES,
                  tokenPayload: clientPayload ?? null,
                }
              }

              if (kind === 'issued') {
                // Only Schedio staff with access to the entity may publish.
                if (!clientId) {
                  throw new Error('missing clientId in upload payload')
                }
                await assertInternalClientAccess(clientId)
                if (!pathname.startsWith('issued/')) {
                  throw new Error('issued documents must upload under issued/')
                }
                return {
                  allowedContentTypes: ISSUED_CONTENT_TYPES,
                  addRandomSuffix: true,
                  maximumSizeInBytes: MAX_ISSUED_BYTES,
                  tokenPayload: clientPayload ?? null,
                }
              }

              if (!isIntakePipelineEnabled()) {
                throw new Error(
                  'intake pipeline is disabled (INTAKE_PIPELINE_ENABLED)',
                )
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
