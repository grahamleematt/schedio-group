import { postDocument } from '#/server/docupipe'
import {
  createFolderIfMissing,
  egnyteFileWebUrlById,
  egnyteWebUrl,
  setMetadata,
  uploadFile,
} from '#/server/egnyte'
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
}): Promise<EgnyteIdentity | null> {
  if (!isEgnyteConfigured()) return null
  await createFolderIfMissing(input.context.incomingFolder)
  const fullPath = `${input.context.incomingFolder}/${input.filename}`
  const ref = await uploadFile({
    path: fullPath,
    contents: input.contents,
    contentType: input.contentType,
  })
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
}): Promise<void> {
  if (!input.entryId) return
  try {
    await setMetadata(input.entryId, 'sg-dream', {
      clientId: input.context.client.id,
      verificationId: input.context.verification.id,
      verificationRef: input.context.verificationRef,
      documentId: input.documentId,
      docupipeDocumentId: input.docupipeDocumentId ?? '',
      docupipeJobId: input.docupipeJobId ?? '',
    })
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
      : input.stageUploadInEgnyte && isEgnyteConfigured()
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
