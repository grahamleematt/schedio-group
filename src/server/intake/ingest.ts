import { createHash } from 'node:crypto'

import type { DocType } from '#/lib/sg-dream'
import { postDocument } from '#/server/docupipe'
import {
  createFolderIfMissing,
  egnyteFileWebUrlById,
  egnyteWebUrl,
  setMetadata,
  uploadFile,
} from '#/server/egnyte'
import type { EgnyteCredentials } from '#/server/egnyte'
import {
  isDocupipeConfigured,
  isEgnyteConfigured,
  isEgnyteExportEnabled,
} from '#/server/env'
import { getStore } from '#/server/store'
import type { ExtractedFields, StoredDocument } from '#/server/store'

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

/**
 * Whether we can stage to Egnyte for this ingest (per-user or service token).
 * The export kill switch overrides both — while Egnyte space is unavailable,
 * uploads stay portal-side and nothing is written into Incoming/.
 */
function canStageEgnyte(input: {
  egnyteCredentials?: EgnyteCredentials
}): boolean {
  if (!isEgnyteExportEnabled()) return false
  return Boolean(input.egnyteCredentials) || isEgnyteConfigured()
}

/**
 * Filename-heuristic classification for simulated (no-DocuPipe) ingests.
 * Order matters: more specific phrases first so "Application for Payment"
 * lands on PA before the generic payment/proof patterns.
 */
const SIMULATED_TYPE_PATTERNS: ReadonlyArray<readonly [RegExp, DocType]> = [
  [/pay\s*app|payapp|g\s*70[23]|application\s+(for|and certif)/i, 'PA'],
  [/invoice|\binv\b/i, 'INV'],
  [/change\s*order|\bco[-_ ]?\d/i, 'CO'],
  [/task\s*order|\bto[-_ ]?\d/i, 'TO'],
  [/contract|agreement|\bctr\b/i, 'CTR'],
  [/proof\s*of\s*payment|\bpop\b|check|receipt|remittance/i, 'POP'],
  [/plat|survey/i, 'LSP'],
  [/drawing|\bcd[-_ ]?\d/i, 'CD'],
]

function simulatedDocType(filename: string): DocType {
  for (const [pattern, docType] of SIMULATED_TYPE_PATTERNS) {
    if (pattern.test(filename)) return docType
  }
  return 'UNK'
}

/**
 * Deterministic stand-in for DocuPipe extraction, used when DocuPipe is not
 * configured (contributor sandbox / degraded dev). Values derive from the
 * content hash so re-uploads of the same file produce the same numbers.
 */
function simulatedExtraction(
  filename: string,
  contentHash: string,
  docType: DocType,
): ExtractedFields {
  const seed = Number.parseInt(contentHash.slice(0, 8), 16)
  const monetary = docType === 'PA' || docType === 'INV' || docType === 'POP'
  const base = filename.replace(/\.[^.]+$/, '')
  const vendorToken = base
    .split(/[-_ .]+/)
    .find(
      (token) =>
        /^[A-Za-z]{3,}$/.test(token) &&
        !/^(pay|app|application|invoice|inv|contract|order|proof|payment|plat|survey|drawing|for|the|and)$/i.test(
          token,
        ),
    )
  const vendorName = vendorToken
    ? vendorToken[0].toUpperCase() + vendorToken.slice(1)
    : 'Sandbox Vendor'
  return {
    vendorName,
    documentNumber: `${docType}-${contentHash.slice(0, 6).toUpperCase()}`,
    amount: monetary ? ((seed % 9_000_000) + 250_000) / 100 : undefined,
    currency: monetary ? 'USD' : undefined,
    documentDate: new Date().toISOString().slice(0, 10),
  }
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

  if (!isDocupipeConfigured()) {
    // Degraded/sandbox mode: no DocuPipe credentials on this machine. Rather
    // than erroring the document, simulate what the extraction webhook would
    // deliver so the upload → processing → confirmation story completes
    // locally. Strict-mode deployments always have DocuPipe configured, so
    // this path only runs in dev and contributor sandboxes.
    const docType = simulatedDocType(input.filename)
    const patched = await store.patchDocument(id, {
      status: 'completed',
      docType,
      extractedFields: simulatedExtraction(input.filename, contentHash, docType),
      errorMessage: egnyteError,
    })
    if (patched) return patched
    const snapshot = await store.getSnapshot(input.context.verification.id)
    const queued = snapshot?.verification.documents.find((doc) => doc.id === id)
    if (queued) return queued
    throw new Error(`ingested document ${id} disappeared before patch`)
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
