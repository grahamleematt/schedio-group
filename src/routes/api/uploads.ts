/**
 * Upload endpoint. Implemented as a TanStack Start server route (not a server
 * function) because TanStack Start's server-function client serializer drops
 * `File` entries from a `FormData` payload — only string fields survive. A
 * server route gives us the raw `Request` so we can call `request.formData()`
 * and parse the multipart body with the platform's standards-compliant
 * implementation, preserving Files end-to-end.
 *
 * Pipeline (per file):
 *   1. Insert a `queued` StoredDocument BEFORE calling DocuPipe so a fast
 *      webhook can always find its target row.
 *   2. POST the file bytes to DocuPipe.
 *   3. Stage a copy in the entity Egnyte Intake/Draft/Incoming folder
 *      (best-effort).
 *   4. Patch the row with DocuPipe + Egnyte IDs without clobbering any state
 *      a webhook may have already written.
 *
 * All further state transitions come from the DocuPipe webhook.
 */

import { createFileRoute } from '@tanstack/react-router'

import { assertClientAccess, authzJsonError } from '#/server/authz'
import { isIntakePipelineEnabled } from '#/server/env'
import { resolveIntakeContext } from '#/server/intake/context'
import { ingestDocument } from '#/server/intake/ingest'
import type { StoredDocument } from '#/server/store'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

async function processUpload(form: FormData): Promise<Response> {
  const verificationId = String(form.get('verificationId') ?? '')
  const clientIdInput = String(form.get('clientId') ?? '')
  if (!verificationId) {
    return jsonResponse({ error: 'missing verificationId' }, 400)
  }

  const context = resolveIntakeContext({
    clientId: clientIdInput,
    verificationId,
  })
  if (!context) {
    return jsonResponse(
      { error: `unknown verification ${verificationId}` },
      404,
    )
  }
  await assertClientAccess(context.client.id)

  const rawFiles = form.getAll('files')
  // Some runtimes deliver multipart parts as Blob without the File wrapper;
  // accept both so we don't drop a valid upload.
  const files: Array<Blob> = []
  for (const f of rawFiles) {
    if (f instanceof Blob) files.push(f)
  }
  if (files.length === 0) {
    return jsonResponse(
      {
        error: `no files attached (received ${rawFiles.length} entries on "files" field)`,
      },
      400,
    )
  }

  const uploaded: Array<StoredDocument> = []
  for (let i = 0; i < files.length; i += 1) {
    const file = files[i]
    const contents = await file.arrayBuffer()
    const fileName =
      file instanceof File && file.name
        ? file.name
        : `upload-${Date.now()}-${i}.bin`

    try {
      const doc = await ingestDocument({
        context,
        filename: fileName,
        contents,
        contentType: file.type || undefined,
        sizeBytes: file.size,
        sourceKind: 'upload',
        stageUploadInEgnyte: true,
      })
      uploaded.push(doc)
    } catch (err) {
      uploaded.push({
        id: `upload-error-${Date.now()}-${i}`,
        clientId: context.client.id,
        verificationId,
        sourceKind: 'upload',
        originalName: fileName,
        displayName: fileName,
        docType: 'UNK',
        status: 'error',
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duplicateFlag: 'none',
        errorMessage: err instanceof Error ? err.message : 'upload failed',
      })
    }
  }

  return jsonResponse({ uploaded })
}

export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isIntakePipelineEnabled()) {
          return jsonResponse(
            { error: 'intake pipeline is disabled (INTAKE_PIPELINE_ENABLED)' },
            503,
          )
        }
        let form: FormData
        try {
          form = await request.formData()
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'failed to parse form data'
          return jsonResponse({ error: message }, 400)
        }
        try {
          return await processUpload(form)
        } catch (err) {
          const authError = authzJsonError(err)
          if (authError) return authError
          console.error('[uploads] handler error', err)
          const message = err instanceof Error ? err.message : 'upload failed'
          return jsonResponse({ error: message }, 500)
        }
      },
    },
  },
})
