/**
 * Upload endpoint. Implemented as a TanStack Start server route (not a server
 * function) because TanStack Start's server-function client serializer drops
 * `File` entries from a `FormData` payload — only string fields survive. A
 * server route gives us the raw `Request` so we can call `request.formData()`
 * and parse the multipart body with the platform's standards-compliant
 * implementation, preserving Files end-to-end.
 *
 * Two intake shapes share one pipeline:
 *   - multipart/form-data: the default path for files under the ~4.5 MB Vercel
 *     request-body cap (the client batches them so a request never exceeds it).
 *   - application/json with `{ blobs: [{ url, ... }] }`: the large-file path.
 *     Files over the cap are uploaded directly to Vercel Blob from the browser
 *     (see /api/blob-token); here we fetch each blob server-side, ingest it,
 *     and delete the blob. Server→Blob fetches aren't subject to the request
 *     body cap, so this handles documents of any size.
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
import { del } from '@vercel/blob'

import { assertClientAccess, authzJsonError } from '#/server/authz'
import { buildEgnyteCredentialsForUser } from '#/server/egnyteConnections'
import type { EgnyteCredentials } from '#/server/egnyte'
import { isIntakePipelineEnabled } from '#/server/env'
import { resolveIntakeContext } from '#/server/intake/context'
import { ingestDocument } from '#/server/intake/ingest'
import type { IntakeContext } from '#/server/intake/context'
import type { StoredDocument } from '#/server/store'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

type IngestArgs = {
  filename: string
  contents: ArrayBuffer
  contentType?: string
  sizeBytes: number
}

/** Shared ingest for both upload shapes; never throws — failures become rows. */
async function ingestOne(
  context: IntakeContext,
  egnyteCredentials: EgnyteCredentials | undefined,
  args: IngestArgs,
  index: number,
): Promise<StoredDocument> {
  try {
    return await ingestDocument({
      context,
      filename: args.filename,
      contents: args.contents,
      contentType: args.contentType || undefined,
      sizeBytes: args.sizeBytes,
      sourceKind: 'upload',
      stageUploadInEgnyte: true,
      egnyteCredentials,
    })
  } catch (err) {
    return {
      id: `upload-error-${Date.now()}-${index}`,
      clientId: context.client.id,
      verificationId: context.verification.id,
      sourceKind: 'upload',
      originalName: args.filename,
      displayName: args.filename,
      docType: 'UNK',
      status: 'error',
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      duplicateFlag: 'none',
      errorMessage: err instanceof Error ? err.message : 'upload failed',
    }
  }
}

async function resolveTarget(
  verificationId: string,
  clientIdInput: string,
): Promise<
  | { ok: true; context: IntakeContext; egnyteCredentials?: EgnyteCredentials }
  | { ok: false; response: Response }
> {
  if (!verificationId) {
    return {
      ok: false,
      response: jsonResponse({ error: 'missing verificationId' }, 400),
    }
  }
  const context = await resolveIntakeContext({
    clientId: clientIdInput,
    verificationId,
    // Uploads create documents, so a past-cutoff target rolls forward to the
    // next cycle (Tim's rule: late submissions join the next verification).
    rollPastCutoff: true,
  })
  if (!context) {
    return {
      ok: false,
      response: jsonResponse(
        { error: `unknown verification ${verificationId}` },
        404,
      ),
    }
  }
  const user = await assertClientAccess(context.client.id)
  // Stage to the connecting user's own Egnyte account when they've linked one;
  // undefined falls back to the shared service token (if configured) inside ingest.
  const egnyteCredentials =
    (await buildEgnyteCredentialsForUser(user.id)) ?? undefined
  return { ok: true, context, egnyteCredentials }
}

async function processUpload(form: FormData): Promise<Response> {
  const target = await resolveTarget(
    String(form.get('verificationId') ?? ''),
    String(form.get('clientId') ?? ''),
  )
  if (!target.ok) return target.response
  const { context, egnyteCredentials } = target

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
    uploaded.push(
      await ingestOne(
        context,
        egnyteCredentials,
        {
          filename: fileName,
          contents,
          contentType: file.type || undefined,
          sizeBytes: file.size,
        },
        i,
      ),
    )
  }

  return jsonResponse({
    uploaded,
    verificationId: context.verification.id,
    rolledFrom: context.rolledFrom ?? null,
  })
}

type BlobDescriptor = {
  url: string
  filename: string
  contentType?: string
  sizeBytes?: number
}

type BlobUploadPayload = {
  verificationId?: string
  clientId?: string
  blobs?: Array<BlobDescriptor>
}

/**
 * Large-file path: the browser already uploaded each file directly to Vercel
 * Blob, so we fetch the bytes server-side (no request-body cap applies),
 * ingest, then delete the blob to avoid orphaned objects.
 */
async function processBlobUpload(
  payload: BlobUploadPayload,
): Promise<Response> {
  const target = await resolveTarget(
    payload.verificationId ?? '',
    payload.clientId ?? '',
  )
  if (!target.ok) return target.response
  const { context, egnyteCredentials } = target

  const blobs = Array.isArray(payload.blobs) ? payload.blobs : []
  if (blobs.length === 0) {
    return jsonResponse({ error: 'no blobs provided' }, 400)
  }

  const uploaded: Array<StoredDocument> = []
  for (let i = 0; i < blobs.length; i += 1) {
    const blob = blobs[i]
    let contents: ArrayBuffer
    try {
      const res = await fetch(blob.url)
      if (!res.ok) throw new Error(`blob fetch failed (${res.status})`)
      contents = await res.arrayBuffer()
    } catch (err) {
      uploaded.push({
        id: `upload-error-${Date.now()}-${i}`,
        clientId: context.client.id,
        verificationId: context.verification.id,
        sourceKind: 'upload',
        originalName: blob.filename,
        displayName: blob.filename,
        docType: 'UNK',
        status: 'error',
        uploadedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        duplicateFlag: 'none',
        errorMessage:
          err instanceof Error ? err.message : 'could not read uploaded file',
      })
      continue
    }

    uploaded.push(
      await ingestOne(
        context,
        egnyteCredentials,
        {
          filename: blob.filename,
          contents,
          contentType: blob.contentType,
          sizeBytes: blob.sizeBytes ?? contents.byteLength,
        },
        i,
      ),
    )

    // Best-effort cleanup; a leftover blob is harmless but wasteful.
    try {
      await del(blob.url)
    } catch (err) {
      console.warn('[uploads] blob cleanup failed', blob.url, err)
    }
  }

  return jsonResponse({
    uploaded,
    verificationId: context.verification.id,
    rolledFrom: context.rolledFrom ?? null,
  })
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
        const contentType = request.headers.get('content-type') ?? ''
        try {
          if (contentType.includes('application/json')) {
            const payload = (await request.json()) as BlobUploadPayload
            return await processBlobUpload(payload)
          }
          let form: FormData
          try {
            form = await request.formData()
          } catch (err) {
            const message =
              err instanceof Error ? err.message : 'failed to parse form data'
            return jsonResponse({ error: message }, 400)
          }
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
