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
 *   3. Stage a copy in Egnyte Incoming/<verificationRef>/ (best-effort).
 *   4. Patch the row with DocuPipe + Egnyte IDs without clobbering any state
 *      a webhook may have already written.
 *
 * All further state transitions come from the DocuPipe webhook.
 */

import { createFileRoute } from '@tanstack/react-router'

import {
  clients as mockClients,
  verifications as mockVerifications,
  formatRef,
} from '#/lib/sg-dream'
import { postDocument } from '#/server/docupipe'
import {
  createFolderIfMissing,
  egnyteWebUrl,
  setMetadata,
  uploadFile,
} from '#/server/egnyte'
import { getEgnyteEnv, isEgnyteConfigured } from '#/server/env'
import { getStore } from '#/server/store'
import type { StoredDocument } from '#/server/store'

function newDocumentId(): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `u-${cryptoRef.randomUUID()}`
  }
  return `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

type EgnyteStaging = {
  path: string
  guid: string
  webUrl: string
} | null

async function stageInEgnyte(input: {
  clientCode: string
  verificationRef: string
  filename: string
  contents: ArrayBuffer
  metadata: Record<string, string>
}): Promise<{ staged: EgnyteStaging; error?: string }> {
  if (!isEgnyteConfigured()) {
    return { staged: null, error: undefined }
  }
  try {
    const env = getEgnyteEnv()
    const folder = `${env.EGNYTE_ROOT_PATH.replace(/\/$/, '')}/${input.clientCode}/${input.verificationRef}/Incoming`
    await createFolderIfMissing(folder)
    const full = `${folder}/${input.filename}`
    const ref = await uploadFile({ path: full, contents: input.contents })
    if (ref.guid) {
      try {
        await setMetadata(ref.guid, 'sg-dream', input.metadata)
      } catch (err) {
        console.warn('[egnyte] setMetadata failed', err)
      }
    }
    return {
      staged: {
        path: full,
        guid: ref.guid,
        webUrl: egnyteWebUrl(full),
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'egnyte upload failed'
    console.error('[egnyte] stage failed', err)
    return { staged: null, error: message }
  }
}

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

  const verification = mockVerifications.find((v) => v.id === verificationId)
  const client = mockClients.find(
    (c) => c.id === (clientIdInput || verification?.clientId),
  )
  if (!verification || !client) {
    return jsonResponse(
      { error: `unknown verification ${verificationId}` },
      404,
    )
  }

  const verificationRef = formatRef({
    workflow: client.workflow,
    number: verification.number,
    year: verification.year,
    seq: verification.seq,
  })

  const store = getStore()
  await store.ensureVerification({
    verificationId,
    clientId: client.id,
    ref: verificationRef,
  })

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
    const storeDocumentId = newDocumentId()
    const contents = await file.arrayBuffer()
    const fileName =
      file instanceof File && file.name
        ? file.name
        : `upload-${Date.now()}-${i}.bin`

    const initialQueuedAt = new Date().toISOString()
    await store.upsertDocument({
      id: storeDocumentId,
      clientId: client.id,
      verificationId,
      originalName: fileName,
      displayName: fileName,
      docType: 'UNK',
      status: 'queued',
      uploadedAt: initialQueuedAt,
      updatedAt: initialQueuedAt,
      duplicateFlag: 'none',
      custodyState: isEgnyteConfigured() ? 'processing' : undefined,
    })

    let docupipeDocumentId: string | undefined
    let docupipeJobId: string | undefined
    try {
      const result = await postDocument({
        contents,
        filename: fileName,
        metadata: {
          clientId: client.id,
          verificationId,
          storeDocumentId,
        },
      })
      docupipeDocumentId = result.documentId
      docupipeJobId = result.jobId
    } catch (err) {
      const errored = await store.patchDocument(storeDocumentId, {
        status: 'error',
        custodyState: 'incoming',
        errorMessage: err instanceof Error ? err.message : 'upload failed',
      })
      if (errored) uploaded.push(errored)
      continue
    }

    const { staged, error: egnyteError } = await stageInEgnyte({
      clientCode: client.code,
      verificationRef,
      filename: fileName,
      contents,
      metadata: {
        verificationRef,
        documentId: storeDocumentId,
        docupipeDocumentId,
        docupipeJobId: docupipeJobId ?? '',
      },
    })

    const patched = await store.patchDocument(storeDocumentId, {
      docupipeDocumentId,
      docupipeJobId,
      custodyState: staged ? 'incoming' : undefined,
      egnyteIncomingPath: staged?.path,
      egnyteGuid: staged?.guid,
      egnyteWebUrl: staged?.webUrl,
      errorMessage: egnyteError,
    })
    if (patched) uploaded.push(patched)
  }

  return jsonResponse({ uploaded })
}

export const Route = createFileRoute('/api/uploads')({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
          console.error('[uploads] handler error', err)
          const message = err instanceof Error ? err.message : 'upload failed'
          return jsonResponse({ error: message }, 500)
        }
      },
    },
  },
})
