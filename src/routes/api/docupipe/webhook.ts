/**
 * DocuPipe webhook endpoint. Verified with Svix (DocuPipe publishes via the
 * Svix infrastructure). Every state transition for an uploaded document —
 * classification, standardization, completion, error — flows through here.
 *
 * The handler is idempotent and tolerant of out-of-order deliveries: unknown
 * DocuPipe document IDs are swallowed with a 200 so Svix doesn't retry
 * forever.
 */

import { createFileRoute } from '@tanstack/react-router'
import { Webhook } from 'svix'

import {
  clients as mockClients,
  renamed,
  verifications as mockVerifications,
} from '#/lib/sg-dream'
import { getEnv, getEgnyteEnv, isEgnyteConfigured } from '#/server/env'
import {
  computeLowConfidence,
  getClassMap,
  getStandardization,
  getVisualReview,
  getWorkflow,
} from '#/server/docupipe'
import { SPEC_CLASS_NAMES } from '#/server/docupipe-spec'
import {
  createFolderIfMissing,
  egnyteWebUrl,
  isDestinationExistsError,
  moveFile,
} from '#/server/egnyte'
import { getStore } from '#/server/store'
import { detectDuplicate } from '#/server/duplicateDetector'
import type { DocType } from '#/lib/sg-dream'
import type {
  AuditCategory,
  AuditResult,
  CustodyState,
  DocumentStatus,
  ExtractedFields,
  StoredAuditEvent,
  StoredDocument,
} from '#/server/store'

type DocuPipeMetadata = {
  clientId: string
  verificationId: string
  storeDocumentId: string
}

/**
 * DocuPipe webhook payload shape. Per DocuPipe docs the event fields are flat
 * (`eventType`, `documentId`, `jobId`) on the root object; we still accept a
 * nested `data` wrapper as fallback because some of their workflow events are
 * documented with a `data` wrapper on the v2 API surface.
 */
type BaseEvent = {
  eventType: string
  data?: Record<string, unknown>
} & Record<string, unknown>

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v.replace(/[$,\s]/g, ''))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function payloadRoots(event: BaseEvent): Array<Record<string, unknown>> {
  const roots: Array<Record<string, unknown>> = [event]
  if (event.data && typeof event.data === 'object') roots.push(event.data)
  return roots
}

function extractMetadata(event: BaseEvent): DocuPipeMetadata | null {
  for (const root of payloadRoots(event)) {
    const metadata = root.metadata as Record<string, unknown> | undefined
    if (!metadata) continue
    const clientId = asString(metadata.clientId)
    const verificationId = asString(metadata.verificationId)
    const storeDocumentId = asString(metadata.storeDocumentId)
    if (clientId && verificationId && storeDocumentId) {
      return { clientId, verificationId, storeDocumentId }
    }
  }
  return null
}

function extractDocupipeDocumentId(event: BaseEvent): string | undefined {
  for (const root of payloadRoots(event)) {
    const id =
      asString(root.documentId) ??
      asString(root.document_id) ??
      asString(root.id)
    if (id) return id
  }
  return undefined
}

function extractDocupipeJobId(event: BaseEvent): string | undefined {
  for (const root of payloadRoots(event)) {
    const id = asString(root.jobId) ?? asString(root.job_id)
    if (id) return id
  }
  return undefined
}

function extractWebhookDeliveryId(event: BaseEvent): string | undefined {
  for (const root of payloadRoots(event)) {
    const id =
      asString(root.eventId) ??
      asString(root.event_id) ??
      asString(root.webhookEventId) ??
      asString(root.webhook_event_id) ??
      asString(root.svixId) ??
      asString(root.svix_id) ??
      asString(root.svixMessageId) ??
      asString(root.svix_message_id) ??
      asString(root.messageId) ??
      asString(root.message_id)
    if (id) return id
  }
  return undefined
}

/**
 * Pull the first DocuPipe class ID from a `classification.processed.success`
 * event. DocuPipe ships them as `classIds: string[]` (always non-empty when
 * `classified === true`) and we surface the highest-ranked guess as the
 * row's `docType` so the UI can label the document the moment classification
 * lands — well before standardization.
 */
function extractClassId(event: BaseEvent): string | undefined {
  for (const root of payloadRoots(event)) {
    const ids = root.classIds ?? root.class_ids
    if (Array.isArray(ids) && ids.length > 0) {
      const first = asString(ids[0])
      if (first) return first
    }
    const single = asString(root.classId) ?? asString(root.class_id)
    if (single) return single
  }
  return undefined
}

function extractStandardizationId(event: BaseEvent): string | undefined {
  for (const root of payloadRoots(event)) {
    const id =
      asString(root.standardizationId) ??
      asString(root.standardization_id) ??
      asString(
        (root.standardization as Record<string, unknown> | undefined)?.id,
      )
    if (id) return id
  }
  // For `standardization.*` events DocuPipe sometimes ships the standardization
  // ID at the root as `id` rather than `standardizationId`; only honor that
  // shape when the event is unambiguously a standardization event so we don't
  // mistake a document or workflow ID for a standardization.
  if (event.eventType.startsWith('standardization.')) {
    for (const root of payloadRoots(event)) {
      const id = asString(root.id)
      if (id) return id
    }
  }
  return undefined
}

function normalizeExtracted(raw: Record<string, unknown>): ExtractedFields {
  // DocuPipe can return either primitives (`vendor_name: 'Rusin'`) or objects
  // (`vendor_name: { value: 'Rusin', confidence: 0.92 }`). Unwrap the object
  // case here so downstream logic sees the raw scalar.
  const v = (key: string, alt?: string): unknown => {
    const primary = raw[key]
    const fallback = alt !== undefined ? raw[alt] : undefined
    for (const x of [primary, fallback]) {
      if (x && typeof x === 'object' && 'value' in x) {
        return (x as { value?: unknown }).value
      }
      if (x !== undefined) return x
    }
    return undefined
  }
  return {
    vendorName: asString(v('vendor_name', 'vendorName')),
    vendorIdGuess: asString(v('vendor_id_guess', 'vendorIdGuess')),
    documentNumber: asString(v('document_number', 'documentNumber')),
    amount: asNumber(v('amount')),
    currency: asString(v('currency')),
    documentDate: asString(v('document_date', 'documentDate')),
    periodStart: asString(v('period_start', 'periodStart')),
    periodEnd: asString(v('period_end', 'periodEnd')),
    contractReference: asString(v('contract_reference', 'contractReference')),
  }
}

// Derived from src/server/docupipe-spec.ts so the webhook's known-classes
// list and the alignment spec can never drift apart. `'UNK'` is appended as
// the local fallback — DocuPipe never emits this class, but `toDocType` uses
// it when the live workspace surfaces a name we don't recognize.
const DOC_TYPES: ReadonlyArray<DocType> = [...SPEC_CLASS_NAMES, 'UNK']

/**
 * Map a DocuPipe `className` to our `DocType` enum. DocuPipe returns the
 * Class ID directly when the classifier was set up per docs/docupipe-setup.md,
 * so exact-match works and we fall back to UNK on anything unrecognized.
 */
export function toDocType(className: string | undefined): DocType {
  if (!className) return 'UNK'
  const upper = className.toUpperCase().trim()
  return DOC_TYPES.find((t) => t === upper) ?? 'UNK'
}

/**
 * Resolve the docType to write on a `standardization.processed.success`
 * upsert, preferring (a) what DocuPipe reported on the standardization
 * payload, then (b) the docType we already had on the row (e.g. resolved
 * earlier from the classification event).
 *
 * Without this fallback a stale class cache or a DocuPipe payload that
 * shipped `className` as a long-form name (`"Pay Application"` instead of
 * `"PA"`) would silently downgrade an already-classified row back to UNK.
 */
export function resolveStandardizedDocType(
  standardizedClassName: string | undefined,
  fallback: DocType,
): DocType {
  const fromStandardization = toDocType(standardizedClassName)
  if (fromStandardization !== 'UNK') return fromStandardization
  return fallback
}

function vendorCodeFrom(name: string | undefined): string {
  if (!name) return 'UNK'
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  return letters.length > 0 ? letters.padEnd(4, 'X') : 'UNK'
}

type PromotionResult = {
  custodyState: CustodyState
  classifiedPath?: string
  renamedName?: string
  webUrl?: string
  errorMessage?: string
}

/**
 * Promote a freshly classified document from Egnyte Incoming/ to
 * Classified/<DocType>/ with the SG DREAM renamed filename.
 *
 * Idempotency: a webhook may be redelivered after we already moved this
 * document. We detect that by comparing the row's existing
 * `egnyteClassifiedPath` against the destination we'd compute now. If they
 * match, we treat it as a no-op success (the prior delivery did the move).
 * If they don't, the destination collision is a real bug and we surface it
 * as an error so we can investigate rather than silently lose the file.
 *
 * The renamed-filename `seq` segment is minted from a store-managed
 * counter scoped to `(verificationId, docType)`, which guarantees two
 * distinct uploads in the same verification + class never collide.
 */
async function promoteInEgnyte(input: {
  stored: StoredDocument
  docType: DocType
  vendorName: string | undefined
}): Promise<PromotionResult> {
  const { stored, docType, vendorName } = input
  if (!isEgnyteConfigured() || !stored.egnyteIncomingPath) {
    return { custodyState: 'classified' }
  }

  const client = mockClients.find((c) => c.id === stored.clientId)
  const verification = mockVerifications.find(
    (v) => v.id === stored.verificationId,
  )
  if (!client || !verification) {
    return {
      custodyState: 'processing',
      errorMessage: 'unknown client or verification for Egnyte promotion',
    }
  }

  // Webhook-redelivery short-circuit: if we already moved this row to its
  // Classified destination, return the cached path verbatim. We never
  // re-mint a seq for the same StoredDocument, which would otherwise leak
  // counter values on every retry.
  if (
    stored.egnyteClassifiedPath &&
    stored.renamedName &&
    stored.custodyState === 'classified'
  ) {
    return {
      custodyState: 'classified',
      classifiedPath: stored.egnyteClassifiedPath,
      renamedName: stored.renamedName,
      webUrl: stored.egnyteWebUrl ?? egnyteWebUrl(stored.egnyteClassifiedPath),
    }
  }

  try {
    const env = getEgnyteEnv()
    const root = env.EGNYTE_ROOT_PATH.replace(/\/$/, '')
    // Upload convention: <root>/<clientCode>/<verificationRef>/Incoming/<name>.
    // Derive the verification folder from the known pieces so a reorganized
    // root never confuses the split.
    const incomingSegments = stored.egnyteIncomingPath.split('/')
    const verificationRef = incomingSegments[incomingSegments.length - 3] ?? ''
    const base = `${root}/${client.code}/${verificationRef}`
    const classifiedDir = `${base}/Classified/${docType}`

    const store = getStore()
    const seq = await store.nextDocSeqForVerification(
      stored.verificationId,
      docType,
    )
    const renamedName = renamed(
      client.code,
      verification.number,
      docType,
      vendorCodeFrom(vendorName),
      seq,
      verification.year,
    )
    const dest = `${classifiedDir}/${renamedName}`

    await createFolderIfMissing(classifiedDir)
    try {
      await moveFile({ from: stored.egnyteIncomingPath, to: dest })
    } catch (err) {
      // Only treat destination-exists as benign when the destination matches
      // a path this same row already owns. Any other "already exists" is a
      // real collision — surface it.
      if (
        isDestinationExistsError(err) &&
        stored.egnyteClassifiedPath === dest
      ) {
        return {
          custodyState: 'classified',
          classifiedPath: dest,
          renamedName,
          webUrl: stored.egnyteWebUrl ?? egnyteWebUrl(dest),
        }
      }
      throw err
    }

    return {
      custodyState: 'classified',
      classifiedPath: dest,
      renamedName,
      webUrl: egnyteWebUrl(dest),
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'egnyte promotion failed'
    console.error('[egnyte] promotion failed', err)
    return { custodyState: 'processing', errorMessage: message }
  }
}

/**
 * Event-name catalog.
 *
 * DocuPipe's live event stream (verified via Svix replay 2026-04-27) uses
 * `<entity>.processed.<status>`:
 *   - document.processed.success            (file uploaded + parsed)
 *   - classification.processed.success      (class assigned)
 *   - standardization.processed.success     (extraction done — the payload
 *                                            we actually care about)
 *   - workflow.processed.success            (whole workflow finished)
 *   - <any of above>.error                  (matching failure cases)
 *
 * Older docs and some portal pages reference `.processing.success` and
 * `.completed`; we keep those as harmless aliases so a future DocuPipe
 * rename doesn't silently break us again.
 */
const DOC_SUCCESS_NAMES = new Set([
  'document.processed.success',
  'document.processing.success',
])
const CLASSIFICATION_SUCCESS_NAMES = new Set([
  'classification.processed.success',
  'classification.processing.success',
  'classification.completed',
])
const STD_SUCCESS_NAMES = new Set([
  'standardization.processed.success',
  'standardization.processing.success',
  'standardization.completed',
])
const WORKFLOW_SUCCESS_NAMES = new Set([
  'workflow.processed.success',
  'workflow.processing.success',
  'workflow.completed',
])

function isDocumentSuccess(type: string): boolean {
  return DOC_SUCCESS_NAMES.has(type)
}

function isClassificationSuccess(type: string): boolean {
  return CLASSIFICATION_SUCCESS_NAMES.has(type)
}

function isStandardizationSuccess(type: string): boolean {
  return STD_SUCCESS_NAMES.has(type)
}

function isWorkflowSuccess(type: string): boolean {
  return WORKFLOW_SUCCESS_NAMES.has(type)
}

/**
 * Map an event type to the next status, given the row we're about to update.
 *
 * Three subtleties baked in:
 *
 * 1. `standardization.processed.success` returns `null` here — the
 *    standardization handler in `handleEvent` is authoritative because it
 *    only knows whether the row is truly `completed` after fetching the
 *    standardization payload + writing extracted fields. If we returned
 *    `'completed'` blindly we'd risk marking malformed events (no
 *    `standardizationId`) complete with no data; if we returned
 *    `'standardizing'` we'd never transition because no later event arrives.
 *
 * 2. `workflow.processed.success` arrives whenever the DocuPipe workflow
 *    finishes — including when classification was successful but the class
 *    has no schema mapped. We still want to mark the row `completed` so the
 *    polling loop terminates. (Note: our spec doesn't subscribe to workflow
 *    events today, but we keep the branch so re-enabling them is a one-line
 *    change in `docupipe-spec.ts`.)
 *
 * 3. Workflow events can also land BEFORE classification on a brand-new
 *    upload (DocuPipe doesn't promise ordering across categories). When
 *    that happens we still hold the line at the current status — the
 *    classification + standardization events will catch us up.
 */
export function statusFromEvent(
  type: string,
  stored: StoredDocument,
): DocumentStatus | null {
  if (isDocumentSuccess(type) || isClassificationSuccess(type)) {
    return 'classifying'
  }
  if (isStandardizationSuccess(type)) return null
  if (isWorkflowSuccess(type)) {
    const standardized =
      stored.docupipeStandardizationId !== undefined ||
      (stored.extractedFields !== undefined &&
        Object.keys(stored.extractedFields).length > 0)
    if (standardized) return 'completed'
    // Classified but no schema applied. Mark complete so the UI stops
    // spinning; `handleEvent` will attach an explanatory errorMessage.
    if (stored.docType !== 'UNK') return 'completed'
    return null
  }
  if (type.endsWith('.error')) return 'error'
  return null
}

/**
 * Resolve a DocuPipe class ID to our SG DREAM `DocType` enum. Looks up the
 * cached `/classes` map and falls back to UNK on any failure so a transient
 * DocuPipe outage never poisons a row.
 */
async function docTypeForClassId(classId: string): Promise<DocType> {
  try {
    const map = await getClassMap()
    return toDocType(map[classId])
  } catch (err) {
    console.warn('[docupipe webhook] class lookup failed', err)
    return 'UNK'
  }
}

function auditIdPart(value: string | undefined): string {
  const normalized = value?.trim().replace(/[^A-Za-z0-9_.:-]+/g, '_')
  return normalized && normalized.length > 0 ? normalized.slice(0, 160) : 'none'
}

export function stableAuditEventId(input: {
  scope: 'docupipe' | 'egnyte-promote' | 'egnyte-error'
  event: BaseEvent
  document: StoredDocument
  detail?: string
}): string {
  const { event, document, detail, scope } = input
  const identity =
    extractWebhookDeliveryId(event) ??
    [
      event.eventType,
      extractDocupipeDocumentId(event) ?? document.docupipeDocumentId,
      extractStandardizationId(event) ?? document.docupipeStandardizationId,
      extractClassId(event),
      extractDocupipeJobId(event) ?? document.docupipeJobId,
      detail,
    ]
      .filter((part): part is string => Boolean(part))
      .join(':')

  return [
    'audit',
    scope,
    document.id,
    event.eventType,
    identity || detail || 'event',
  ]
    .map(auditIdPart)
    .join(':')
}

/**
 * Translate a DocuPipe webhook event into a human-friendly audit row label.
 * Returns null when the event isn't worth logging (e.g. an unrecognized
 * sub-type that the handler ignored anyway).
 */
function describeAuditEvent(input: {
  eventType: string
  stored: StoredDocument
  next: StoredDocument
  errorMessage?: string
}): { event: string; result: AuditResult; detail?: string } | null {
  const { eventType, stored, next, errorMessage } = input
  if (eventType.endsWith('.error')) {
    return {
      event: 'DocuPipe error',
      result: 'failed',
      detail: errorMessage,
    }
  }
  if (isDocumentSuccess(eventType)) {
    return { event: 'DocuPipe accepted document', result: 'ok' }
  }
  if (isClassificationSuccess(eventType)) {
    const docType = next.docType !== 'UNK' ? next.docType : stored.docType
    return {
      event: `Document classified as ${docType}`,
      result: 'ok',
    }
  }
  if (isStandardizationSuccess(eventType)) {
    const flagged =
      next.duplicateFlag === 'exact' || next.duplicateFlag === 'likely'
    if (flagged) {
      return {
        event: 'Duplicate flagged',
        result: 'flagged',
        detail: next.matchedPreviousName
          ? `matches ${next.matchedPreviousName}`
          : undefined,
      }
    }
    return {
      event: 'Field extraction complete',
      result: 'ok',
      detail:
        next.extractedFields?.amount !== undefined
          ? `$${next.extractedFields.amount.toLocaleString()} from ${
              next.extractedFields.vendorName ?? 'unknown vendor'
            }`
          : undefined,
    }
  }
  if (isWorkflowSuccess(eventType)) {
    return { event: 'Workflow complete', result: 'ok' }
  }
  return null
}

/**
 * Append one or more audit rows for the document state transition we just
 * persisted. We log the DocuPipe event itself, plus a separate row when the
 * webhook also promoted the file in Egnyte (so the timeline shows custody
 * promotion explicitly, not buried inside "standardization complete").
 *
 * Failures inside the audit writer are swallowed — the audit log is a UX
 * surface, not a transactional dependency.
 */
async function emitAuditEvents(input: {
  event: BaseEvent
  stored: StoredDocument
  next: StoredDocument
  promotion?: PromotionResult
  errorMessage?: string
}): Promise<void> {
  const store = getStore()
  const { event, stored, next, promotion, errorMessage } = input
  const ts = new Date().toISOString()
  const description = describeAuditEvent({
    eventType: event.eventType,
    stored,
    next,
    errorMessage,
  })
  const rows: Array<StoredAuditEvent> = []
  if (description) {
    const category: AuditCategory =
      event.eventType.endsWith('.error') &&
      next.status === 'error'
        ? 'documents'
        : 'documents'
    rows.push({
      id: stableAuditEventId({
        scope: 'docupipe',
        event,
        document: next,
        detail: description.detail,
      }),
      ts,
      source: 'docupipe',
      category,
      actor: 'DocuPipe',
      event: description.event,
      object: next.displayName || next.originalName,
      result: description.result,
      ip: 'webhook',
      clientId: next.clientId,
      verificationId: next.verificationId,
      documentId: next.id,
      docupipeDocumentId: next.docupipeDocumentId,
      docupipeEventType: event.eventType,
      detail: description.detail,
    })
  }

  if (promotion) {
    if (promotion.errorMessage) {
      rows.push({
        id: stableAuditEventId({
          scope: 'egnyte-error',
          event,
          document: next,
          detail: promotion.errorMessage,
        }),
        ts,
        source: 'egnyte',
        category: 'documents',
        actor: 'Egnyte',
        event: 'Egnyte promotion failed',
        object: next.displayName || next.originalName,
        result: 'failed',
        ip: 'system',
        clientId: next.clientId,
        verificationId: next.verificationId,
        documentId: next.id,
        detail: promotion.errorMessage,
      })
    } else if (promotion.classifiedPath) {
      rows.push({
        id: stableAuditEventId({
          scope: 'egnyte-promote',
          event,
          document: next,
          detail: promotion.classifiedPath,
        }),
        ts,
        source: 'egnyte',
        category: 'documents',
        actor: 'Egnyte',
        event: 'Filed in Egnyte',
        object: promotion.renamedName ?? next.displayName,
        result: 'ok',
        ip: 'system',
        clientId: next.clientId,
        verificationId: next.verificationId,
        documentId: next.id,
        detail: promotion.classifiedPath,
      })
    }
  }

  for (const row of rows) {
    try {
      await store.appendAuditEvent(row)
    } catch (err) {
      console.warn('[docupipe webhook] audit write failed', err)
    }
  }
}

async function handleEvent(event: BaseEvent): Promise<void> {
  const metadata = extractMetadata(event)
  const docupipeDocumentId = extractDocupipeDocumentId(event)
  const store = getStore()

  let stored: StoredDocument | null = null
  if (metadata) {
    const snapshot = await store.getSnapshot(metadata.verificationId)
    stored =
      snapshot?.verification.documents.find(
        (d) => d.id === metadata.storeDocumentId,
      ) ?? null
  } else if (docupipeDocumentId) {
    stored = await store.findDocumentByDocupipeId(docupipeDocumentId)
  }

  if (!stored) return

  // Resolve docType from the classification event (`classIds[0]` → className
  // → DocType) so the UI can label the doc the moment classification lands,
  // not only after standardization. Standardization normally writes the same
  // value via `resolveStandardizedDocType`; if DocuPipe ships a blank or
  // long-form className on the standardization payload we keep the
  // classification-derived value. For classes with no schema mapped (e.g.
  // a class without a configured extraction schema) this is the only place
  // docType ever gets set.
  //
  // We also short-circuit to `completed` here when the classified classId
  // isn't in the workflow's `classToSchema` map. DocuPipe silently skips
  // standardization for unmapped classes AND emits no workflow event, so
  // without this branch the row would hang at `classifying` indefinitely.
  let earlyDocType: DocType | undefined
  let unmappedClass = false
  if (isClassificationSuccess(event.eventType)) {
    const classId = extractClassId(event)
    if (classId) {
      earlyDocType = await docTypeForClassId(classId)
      try {
        const workflow = await getWorkflow()
        if (workflow && !(classId in workflow.classToSchema)) {
          unmappedClass = true
        }
      } catch (err) {
        console.warn('[docupipe webhook] workflow lookup failed', err)
      }
    }
  }

  const baseUpdate: Partial<StoredDocument> = {
    updatedAt: new Date().toISOString(),
    docupipeDocumentId:
      stored.docupipeDocumentId ?? docupipeDocumentId ?? undefined,
  }
  if (earlyDocType !== undefined && earlyDocType !== 'UNK') {
    baseUpdate.docType = earlyDocType
  }

  // Recompute status against an effective row that includes the just-derived
  // docType so the workflow-completion branch sees the right value when the
  // classification + workflow events arrive in one batch.
  const effectiveStored: StoredDocument =
    earlyDocType !== undefined && earlyDocType !== 'UNK'
      ? { ...stored, docType: earlyDocType }
      : stored
  let newStatus = statusFromEvent(event.eventType, effectiveStored)
  if (unmappedClass) newStatus = 'completed'
  if (newStatus) baseUpdate.status = newStatus

  // Either: (a) classification landed a class with no schema mapped, or
  // (b) the workflow finished without a standardization. Both deserve a
  // human-readable note so the engineer review screen can render "classified
  // as PA, no extraction schema configured" instead of an empty data block.
  const noExtractionYet =
    effectiveStored.docupipeStandardizationId === undefined &&
    (effectiveStored.extractedFields === undefined ||
      Object.keys(effectiveStored.extractedFields).length === 0)
  if (
    newStatus === 'completed' &&
    noExtractionYet &&
    (unmappedClass || isWorkflowSuccess(event.eventType))
  ) {
    baseUpdate.errorMessage = `Classified as ${effectiveStored.docType} — no extraction schema configured`
  }

  if (isStandardizationSuccess(event.eventType)) {
    const standardizationId = extractStandardizationId(event)
    if (standardizationId) {
      try {
        const result = await getStandardization(standardizationId)
        const extracted = normalizeExtracted(
          result.data as Record<string, unknown>,
        )
        const priorSnapshot = await store.getSnapshot(stored.verificationId)
        const verificationRefs: Record<string, string> = {}
        if (priorSnapshot) {
          verificationRefs[priorSnapshot.verification.id] =
            priorSnapshot.verification.ref
          for (const d of priorSnapshot.priorFilings) {
            verificationRefs[d.verificationId] =
              verificationRefs[d.verificationId] ?? d.verificationId
          }
        }
        const duplicate = detectDuplicate({
          extracted,
          priorFilings: priorSnapshot?.priorFilings ?? [],
          verificationRefs,
        })

        const docType = resolveStandardizedDocType(
          result.className,
          effectiveStored.docType,
        )
        if (toDocType(result.className) === 'UNK' && docType !== 'UNK') {
          console.warn(
            `[docupipe webhook] standardization className "${
              result.className ?? ''
            }" did not resolve; falling back to ${docType} from prior state`,
          )
        }
        const lowConfidence = computeLowConfidence(result.fieldConfidence)

        // Visual review is optional — treat failures as "not available".
        let visualReviewUrl: string | undefined
        try {
          const review = await getVisualReview(standardizationId)
          visualReviewUrl = review?.url
        } catch (err) {
          console.warn('[docupipe webhook] visual review failed', err)
        }

        // Egnyte promotion: Incoming/ → Classified/<DocType>/<renamed>.
        const promotion = await promoteInEgnyte({
          stored,
          docType,
          vendorName: extracted.vendorName,
        })

        const persisted = await store.upsertDocument({
          ...stored,
          ...baseUpdate,
          status: 'completed',
          docType,
          docupipeStandardizationId: standardizationId,
          extractedFields: extracted,
          duplicateFlag: duplicate.flag,
          matchedPreviousName: duplicate.matchedPreviousName,
          matchedVerificationRef: duplicate.matchedVerificationRef,
          custodyState: promotion.custodyState,
          egnyteClassifiedPath:
            promotion.classifiedPath ?? stored.egnyteClassifiedPath,
          egnyteWebUrl: promotion.webUrl ?? stored.egnyteWebUrl,
          renamedName: promotion.renamedName ?? stored.renamedName,
          visualReviewUrl,
          fieldConfidence: result.fieldConfidence,
          lowConfidence,
          errorMessage: promotion.errorMessage,
        })
        await emitAuditEvents({
          event,
          stored,
          next: persisted,
          promotion,
        })
        return
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'getStandardization failed'
        const persisted = await store.upsertDocument({
          ...stored,
          ...baseUpdate,
          status: 'error',
          errorMessage: message,
        })
        await emitAuditEvents({
          event,
          stored,
          next: persisted,
          errorMessage: message,
        })
        return
      }
    }
  }

  if (event.eventType.endsWith('.error')) {
    const root = payloadRoots(event)[0] ?? {}
    const message =
      asString(root.errorMessage) ??
      asString(root.message) ??
      asString((root.error as Record<string, unknown> | undefined)?.message) ??
      'DocuPipe reported an error'
    const persisted = await store.upsertDocument({
      ...stored,
      ...baseUpdate,
      status: 'error',
      errorMessage: message,
    })
    await emitAuditEvents({
      event,
      stored,
      next: persisted,
      errorMessage: message,
    })
    return
  }

  const persisted = await store.upsertDocument({ ...stored, ...baseUpdate })
  await emitAuditEvents({ event, stored, next: persisted })
}

export const Route = createFileRoute('/api/docupipe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.text()
        const env = getEnv()
        const headers: Record<string, string> = {}
        request.headers.forEach((value, key) => {
          headers[key] = value
        })
        let verified: unknown
        try {
          const wh = new Webhook(env.DOCUPIPE_WEBHOOK_SECRET)
          verified = wh.verify(body, headers)
        } catch {
          return new Response('invalid signature', { status: 401 })
        }
        if (
          typeof verified !== 'object' ||
          verified === null ||
          typeof (verified as { eventType?: unknown }).eventType !== 'string'
        ) {
          return new Response('invalid event', { status: 400 })
        }
        const event = verified as BaseEvent
        try {
          await handleEvent(event)
        } catch (err) {
          console.error('[docupipe webhook] handler error', err)
          // Return 200 so Svix doesn't hammer us on unrecoverable data issues;
          // we log and move on. Real errors are already captured on the document.
        }
        return new Response('ok', { status: 200 })
      },
    },
  },
})
