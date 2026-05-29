import { createFileRoute } from '@tanstack/react-router'

import { assertClientAccess, authzJsonError } from '#/server/authz'
import {
  downloadFile,
  egnyteFileWebUrlById,
  egnyteWebUrl,
  listFolder,
} from '#/server/egnyte'
import {
  isEgnyteConfigured,
  isIntakePipelineEnabled,
  isStrictMode,
} from '#/server/env'
import { getStore } from '#/server/store'
import type { StoredDocument } from '#/server/store'
import { resolveIntakeContext } from '#/server/intake/context'
import { ingestDocument, newDocumentId } from '#/server/intake/ingest'
import {
  createImportJob,
  finishImportJob,
  recordImportFile,
} from '#/server/intake/importJobs'
import type { EgnyteListedFile } from '#/server/egnyte'

const SUPPORTED_EXTENSIONS = new Set([
  'pdf',
  'tif',
  'tiff',
  'jpg',
  'jpeg',
  'png',
])

type ImportRequest = {
  clientId?: string
  verificationId?: string
  sourcePath?: string
}

type ImportPreviewFile = EgnyteListedFile & {
  supported: boolean
  alreadyImported: boolean
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function extensionOf(name: string): string {
  const ext = name.split('.').pop()
  return ext ? ext.toLowerCase() : ''
}

function mimeTypeFor(name: string): string | undefined {
  switch (extensionOf(name)) {
    case 'pdf':
      return 'application/pdf'
    case 'tif':
    case 'tiff':
      return 'image/tiff'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    default:
      return undefined
  }
}

function isSupported(file: EgnyteListedFile): boolean {
  return SUPPORTED_EXTENSIONS.has(extensionOf(file.name))
}

function stableImportFileId(jobId: string, file: EgnyteListedFile): string {
  const identity = file.entryId ?? file.groupId ?? file.path
  return `${jobId}:${identity.replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, 120)}`
}

function fileWebUrl(file: EgnyteListedFile): string {
  return file.entryId
    ? egnyteFileWebUrlById(file.entryId)
    : egnyteWebUrl(file.path)
}

async function crawlFolder(
  path: string,
  input: { maxFiles?: number } = {},
): Promise<Array<EgnyteListedFile>> {
  const maxFiles = input.maxFiles ?? 250
  const files: Array<EgnyteListedFile> = []
  const queue = [path]
  while (queue.length > 0 && files.length < maxFiles) {
    const current = queue.shift()
    if (!current) break
    const listing = await listFolder({
      path: current,
      includeCustomMetadata: true,
    })
    files.push(...listing.files.slice(0, maxFiles - files.length))
    for (const folder of listing.folders) {
      if (folder.name.toLowerCase() === 'classified') continue
      queue.push(folder.path)
    }
  }
  return files
}

function alreadyImported(
  file: EgnyteListedFile,
  docs: ReadonlyArray<StoredDocument>,
): boolean {
  return docs.some((doc) => {
    if (
      doc.egnyteSourcePath === file.path ||
      doc.egnyteIncomingPath === file.path
    ) {
      return true
    }
    if (file.groupId && doc.egnyteGroupId === file.groupId) {
      if (!file.entryId || doc.egnyteEntryId === file.entryId) return true
      if (file.checksum && doc.egnyteChecksum === file.checksum) return true
    }
    return false
  })
}

async function resolveRequest(
  request: Request,
  body?: ImportRequest,
): Promise<{
  context: NonNullable<ReturnType<typeof resolveIntakeContext>>
  sourcePath: string
}> {
  const url = new URL(request.url)
  const verificationId =
    body?.verificationId ?? url.searchParams.get('verificationId') ?? ''
  const clientId = body?.clientId ?? url.searchParams.get('clientId') ?? ''
  const context = resolveIntakeContext({ clientId, verificationId })
  if (!context) {
    throw new Response(
      JSON.stringify({ error: 'unknown client or verification' }),
      {
        status: 404,
        headers: { 'content-type': 'application/json' },
      },
    )
  }
  await assertClientAccess(context.client.id)
  // Strict mode ignores any caller-supplied source path and locks imports to
  // the resolved entity intake folder, so Tim can't accidentally (or a caller
  // maliciously) import from an arbitrary Egnyte location.
  if (isStrictMode()) {
    return { context, sourcePath: context.incomingFolder }
  }
  return {
    context,
    sourcePath:
      body?.sourcePath ??
      url.searchParams.get('sourcePath') ??
      context.incomingFolder,
  }
}

async function previewImport(request: Request): Promise<Response> {
  if (!isEgnyteConfigured()) {
    return jsonResponse({ error: 'Egnyte is not configured' }, 503)
  }
  const { context, sourcePath } = await resolveRequest(request)
  const store = getStore()
  await store.ensureVerification({
    verificationId: context.verification.id,
    clientId: context.client.id,
    ref: context.verificationRef,
  })
  const snapshot = await store.getSnapshot(context.verification.id)
  const files = await crawlFolder(sourcePath)
  const preview: Array<ImportPreviewFile> = files.map((file) => ({
    ...file,
    supported: isSupported(file),
    alreadyImported: alreadyImported(
      file,
      snapshot?.verification.documents ?? [],
    ),
  }))
  return jsonResponse({
    sourcePath,
    verificationRef: context.verificationRef,
    files: preview,
    importableCount: preview.filter(
      (file) => file.supported && !file.alreadyImported,
    ).length,
  })
}

async function runImport(request: Request): Promise<Response> {
  if (!isIntakePipelineEnabled()) {
    return jsonResponse(
      { error: 'intake pipeline is disabled (INTAKE_PIPELINE_ENABLED)' },
      503,
    )
  }
  if (!isEgnyteConfigured()) {
    return jsonResponse({ error: 'Egnyte is not configured' }, 503)
  }
  const body = (await request.json().catch(() => ({}))) as ImportRequest
  const { context, sourcePath } = await resolveRequest(request, body)
  const store = getStore()
  await store.ensureVerification({
    verificationId: context.verification.id,
    clientId: context.client.id,
    ref: context.verificationRef,
  })

  const user = await assertClientAccess(context.client.id)
  const jobId = newDocumentId('eg-import')
  await createImportJob({
    id: jobId,
    clientId: context.client.id,
    verificationId: context.verification.id,
    sourcePath,
    actor: user.email,
  })

  const snapshot = await store.getSnapshot(context.verification.id)
  const existingDocs = snapshot?.verification.documents ?? []
  const files = await crawlFolder(sourcePath)
  const importable = files.filter(isSupported)

  const imported: Array<StoredDocument> = []
  const skipped: Array<EgnyteListedFile> = []
  const failed: Array<{ file: EgnyteListedFile; error: string }> = []

  for (const file of importable) {
    const fileRecordId = stableImportFileId(jobId, file)
    if (alreadyImported(file, [...existingDocs, ...imported])) {
      skipped.push(file)
      await recordImportFile({
        id: fileRecordId,
        jobId,
        path: file.path,
        entryId: file.entryId,
        groupId: file.groupId,
        checksum: file.checksum,
        status: 'skipped',
      })
      continue
    }
    try {
      const downloaded = await downloadFile({ path: file.path })
      const doc = await ingestDocument({
        context,
        filename: file.name,
        contents: downloaded.contents,
        contentType:
          file.mimeType ?? downloaded.contentType ?? mimeTypeFor(file.name),
        sizeBytes: file.sizeBytes,
        sourceKind: 'egnyte_import',
        importJobId: jobId,
        egnyteIdentity: {
          path: file.path,
          entryId: file.entryId,
          groupId: file.groupId,
          checksum: file.checksum,
          webUrl: fileWebUrl(file),
        },
      })
      imported.push(doc)
      await recordImportFile({
        id: fileRecordId,
        jobId,
        documentId: doc.id,
        path: file.path,
        entryId: file.entryId,
        groupId: file.groupId,
        checksum: file.checksum,
        status: 'imported',
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'failed to import file'
      failed.push({ file, error: message })
      await recordImportFile({
        id: fileRecordId,
        jobId,
        path: file.path,
        entryId: file.entryId,
        groupId: file.groupId,
        checksum: file.checksum,
        status: 'failed',
        errorMessage: message,
      })
    }
  }

  await finishImportJob({
    id: jobId,
    status: failed.length > 0 ? 'failed' : 'completed',
    totalFiles: importable.length,
    importedFiles: imported.length,
    skippedFiles: skipped.length,
    failedFiles: failed.length,
    errorMessage:
      failed.length > 0
        ? `${failed.length} file(s) failed to import`
        : undefined,
  })

  await store.appendAuditEvent({
    id: `audit:egnyte-import:${jobId}`,
    ts: new Date().toISOString(),
    source: 'egnyte',
    category: 'documents',
    actor: user.email,
    event: 'Egnyte folder imported',
    object: sourcePath,
    result: failed.length > 0 ? 'flagged' : 'ok',
    ip: 'system',
    clientId: context.client.id,
    verificationId: context.verification.id,
    detail: `${imported.length} imported · ${skipped.length} skipped · ${failed.length} failed`,
  })

  return jsonResponse({
    jobId,
    sourcePath,
    imported,
    skipped,
    failed,
    unsupportedCount: files.length - importable.length,
  })
}

export const Route = createFileRoute('/api/egnyte/imports')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          return await previewImport(request)
        } catch (err) {
          const authError = authzJsonError(err)
          if (authError) return authError
          if (err instanceof Response) return err
          console.error('[egnyte import] preview failed', err)
          const message =
            err instanceof Error ? err.message : 'Egnyte preview failed'
          return jsonResponse({ error: message }, 500)
        }
      },
      POST: async ({ request }) => {
        try {
          return await runImport(request)
        } catch (err) {
          const authError = authzJsonError(err)
          if (authError) return authError
          if (err instanceof Response) return err
          console.error('[egnyte import] import failed', err)
          const message =
            err instanceof Error ? err.message : 'Egnyte import failed'
          return jsonResponse({ error: message }, 500)
        }
      },
    },
  },
})
