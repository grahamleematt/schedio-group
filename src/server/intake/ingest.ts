import { createHash } from 'node:crypto'

import { postDocument } from '#/server/docupipe'
import {
  createFolderIfMissing,
  egnyteFileWebUrlById,
  egnyteWebUrl,
  setMetadata,
  uploadFile,
} from '#/server/egnyte'
import type { EgnyteCredentials } from '#/server/egnyte'
import { isEgnyteConfigured } from '#/server/env'
import { getStore } from '#/server/store'
import type { StoredDocument } from '#/server/store'

import type { IntakeContext } from './context'

type EgnyteIdentity = {
  path: string
  entryId?: string
  groupId?: string
  checksum?: string
  webUrl?: string
}

type IngestInput = {
  context: IntakeContext
  filename: string
  contents: ArrayBuffer
  contentType?: string
  sizeBytes?: number
  sourceKind: 'upload' | 'egnyte_import'
  importJobId?: string
  egnyteIdentity?: EgnyteIdentity
  stageUploadInEgnyte?: boolean
  /**
   * Per-user Egnyte credentials for the connecting user. When present, staging
   * runs as that user; when absent we fall back to the shared service token
   * (only if `isEgnyteConfigured()`).
   */
  egnyteCredentials?: EgnyteCredentials
}

/** Whether we can stage to Egnyte for this ingest (per-user or service token). */
function canStageEgnyte(input: {
  egnyteCredentials?: EgnyteCredentials
}): boolean {
  return Boolean(input.egnyteCredentials) || isEgnyteConfigured()
}

export function newDocumentId(prefix = 'u'): string {
  const cryptoRef = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') {
    return `${prefix}-${cryptoRef.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function stageUpload(input: {
  context: IntakeContext
  filename: string
  contents: ArrayBuffer
  contentType?: string
  egnyteCredentials?: EgnyteCredentials
}): Promise<EgnyteIdentity | null> {
  if (!canStageEgnyte(input)) return null
  const creds = input.egnyteCredentials
  await createFolderIfMissing(input.context.incomingFolder, creds)
  const fullPath = `${input.context.incomingFolder}/${input.filename}`
  const ref = await uploadFile(
    {
      path: fullPath,
      contents: input.contents,
      contentType: input.contentType,
    },
    creds,
  )
  return {
    path: fullPath,
    entryId: ref.guid || undefined,
    checksum: ref.checksum,
    webUrl: ref.guid ? egnyteFileWebUrlById(ref.guid) : egnyteWebUrl(fullPath),
  }
}

async function stampEgnyteMetadata(input: {
  entryId?: string
  context: IntakeContext
  documentId: string
  docupipeDocumentId?: string
  docupipeJobId?: string
  egnyteCredentials?: EgnyteCredentials
}): Promise<void> {
  if (!input.entryId) return
  try {
    await setMetadata(
      input.entryId,
      'sg-dream',
      {
        clientId: input.context.client.id,
        verificationId: input.context.verification.id,
        verificationRef: input.context.verificationRef,
        documentId: input.documentId,
        docupipeDocumentId: input.docupipeDocumentId ?? '',
        docupipeJobId: input.docupipeJobId ?? '',
      },
      input.egnyteCredentials,
    )
  } catch (err) {
    console.warn('[egnyte] setMetadata failed', err)
  }
}

export async function ingestDocument(
  input: IngestInput,
): Promise<StoredDocument> {
  const store = getStore()
  await store.ensureVerification({
    verificationId: input.context.verification.id,
    clientId: input.context.client.id,
    ref: input.context.verificationRef,
  })

  const id = newDocumentId(input.sourceKind === 'egnyte_import' ? 'e' : 'u')
  const now = new Date().toISOString()
  const incoming = input.egnyteIdentity

  // Pre-classification duplicate guard: SHA-256 the bytes and short-circuit if
  // the identical file was already submitted to this verification. This avoids
  // spending a DocuPipe call on a re-drop and surfaces the duplicate
  // immediately, rather than waiting for the extracted-field detector to maybe
  // catch it post-standardization.
  const contentHash = createHash('sha256')
    .update(Buffer.from(input.contents))
    .digest('hex')
  const existingSnapshot = await store.getSnapshot(input.context.verification.id)
  const priorSameBytes = existingSnapshot?.verification.documents.find(
    (d) => d.contentHash === contentHash && d.status !== 'error',
  )
  if (priorSameBytes) {
    return store.upsertDocument({
      id,
      clientId: input.context.client.id,
      verificationId: input.context.verification.id,
      sourceKind: input.sourceKind,
      originalName: input.filename,
      displayName: input.filename,
      docType: 'UNK',
      status: 'completed',
      uploadedAt: now,
      updatedAt: now,
      duplicateFlag: 'exact',
      matchedPreviousName:
        priorSameBytes.renamedName ?? priorSameBytes.originalName,
      matchedVerificationRef: input.context.verificationRef,
      mimeType: input.contentType,
      sizeBytes: input.sizeBytes,
      importJobId: input.importJobId,
      contentHash,
      errorMessage:
        'Identical file already in this submission — not sent to DocuPipe.',
    })
  }

  await store.upsertDocument({
    id,
    clientId: input.context.client.id,
    verificationId: input.context.verification.id,
    sourceKind: input.sourceKind,
    originalName: input.filename,
    displayName: input.filename,
    docType: 'UNK',
    status: 'queued',
    uploadedAt: now,
    updatedAt: now,
    duplicateFlag: 'none',
    custodyState: incoming
      ? 'incoming'
      : input.stageUploadInEgnyte && canStageEgnyte(input)
        ? 'processing'
        : undefined,
    egnyteIncomingPath: incoming?.path,
    egnyteSourcePath:
      input.sourceKind === 'egnyte_import' ? incoming?.path : undefined,
    egnyteGuid: incoming?.entryId,
    egnyteEntryId: incoming?.entryId,
    egnyteGroupId: incoming?.groupId,
    egnyteChecksum: incoming?.checksum,
    egnyteWebUrl:
      incoming?.webUrl ??
      (incoming?.entryId
        ? egnyteFileWebUrlById(incoming.entryId)
        : incoming?.path
          ? egnyteWebUrl(incoming.path)
          : undefined),
    mimeType: input.contentType,
    sizeBytes: input.sizeBytes,
    importJobId: input.importJobId,
    contentHash,
  })

  let staged: EgnyteIdentity | undefined = incoming
  let egnyteError: string | undefined
  if (!staged && input.stageUploadInEgnyte) {
    try {
      staged =
        (await stageUpload({
          context: input.context,
          filename: input.filename,
          contents: input.contents,
          contentType: input.contentType,
          egnyteCredentials: input.egnyteCredentials,
        })) ?? undefined
      if (staged) {
        await store.patchDocument(id, {
          custodyState: 'incoming',
          egnyteIncomingPath: staged.path,
          egnyteGuid: staged.entryId,
          egnyteEntryId: staged.entryId,
          egnyteGroupId: staged.groupId,
          egnyteChecksum: staged.checksum,
          egnyteWebUrl: staged.webUrl ?? egnyteWebUrl(staged.path),
        })
      }
    } catch (err) {
      egnyteError = err instanceof Error ? err.message : 'egnyte staging failed'
      console.error('[egnyte] stage failed', err)
    }
  }

  try {
    const result = await postDocument({
      contents: input.contents,
      filename: input.filename,
      metadata: {
        clientId: input.context.client.id,
        verificationId: input.context.verification.id,
        storeDocumentId: id,
      },
    })
    await stampEgnyteMetadata({
      entryId: staged?.entryId,
      context: input.context,
      documentId: id,
      docupipeDocumentId: result.documentId,
      docupipeJobId: result.jobId,
      egnyteCredentials: input.egnyteCredentials,
    })
    const patched = await store.patchDocument(id, {
      docupipeDocumentId: result.documentId,
      docupipeJobId: result.jobId,
      errorMessage: egnyteError,
    })
    if (patched) return patched
    const snapshot = await store.getSnapshot(input.context.verification.id)
    const queued = snapshot?.verification.documents.find((doc) => doc.id === id)
    if (queued) return queued
    throw new Error(`ingested document ${id} disappeared before patch`)
  } catch (err) {
    const patched = await store.patchDocument(id, {
      status: 'error',
      errorMessage:
        err instanceof Error ? err.message : 'DocuPipe upload failed',
    })
    if (patched) return patched
    throw err
  }
}
