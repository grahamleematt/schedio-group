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

import { getDocupipeWebhookSecret } from '#/server/env'
import {
  computeLowConfidence,
  createVisualReview,
  getClassMap,
  getReview,
  getStandardization,
  getWorkflow,
  carryAppliedPercents,
  normalizeExtractedFields,
  standardizeV3,
  unwrapReviewData,
} from '#/server/docupipe'
import { SPEC_CLASS_NAMES } from '#/server/docupipe-spec'
import { getStore } from '#/server/store'
import { detectDuplicate } from '#/server/duplicateDetector'
import { planFiling } from '#/server/intake/filing'
import type { DocType } from '#/lib/sg-dream'
import type {
  AuditCategory,
  AuditResult,
  DocumentStatus,
  ReviewState,
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

/**
 * Pull the Review object ID from a `review.*` event. Mirrors the
 * standardization extractor: explicit `reviewId` keys win, and a bare root
 * `id` is honored only when the event is unambiguously a review event.
 */
export function extractReviewId(event: BaseEvent): string | undefined {
  for (const root of payloadRoots(event)) {
    const id = asString(root.reviewId) ?? asString(root.review_id)
    if (id) return id
  }
  if (event.eventType.startsWith('review.')) {
    for (const root of payloadRoots(event)) {
      const id = asString(root.id)
      if (id) return id
    }
  }
  return undefined
}

function parseReviewState(raw: string | undefined): ReviewState | undefined {
  const lower = raw?.toLowerCase()
  return lower === 'unverified' || lower === 'verified' || lower === 'rejected'
    ? lower
    : undefined
}

/**
 * Derive the review lifecycle state from a `review.*` event name when the
 * fetched review object doesn't carry one (or the fetch failed).
 */
export function reviewStateFromEventType(
  type: string,
): ReviewState | undefined {
  if (type.startsWith('review.verified')) return 'verified'
  if (type.startsWith('review.rejected')) return 'rejected'
  if (type.startsWith('review.') && type.endsWith('.success')) {
    return 'unverified'
  }
  return undefined
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
  // Review events describe the optional human-review layer, never pipeline
  // progress — even `review.processed.error` must not flip a completed
  // extraction to `error`.
  if (type.startsWith('review.')) return null
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
      extractReviewId(event) ?? document.docupipeReviewId,
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
  if (eventType.startsWith('review.')) {
    if (eventType.endsWith('.error')) {
      return {
        event: 'Review overlay generation failed',
        result: 'failed',
        detail: errorMessage,
      }
    }
    if (next.docupipeReviewState === 'verified') {
      return {
        event: 'Extraction verified by reviewer',
        result: 'ok',
        detail:
          next.extractedFields?.amount !== undefined
            ? `$${next.extractedFields.amount.toLocaleString()} from ${
                next.extractedFields.vendorName ?? 'unknown vendor'
              }`
            : undefined,
      }
    }
    if (next.docupipeReviewState === 'rejected') {
      return { event: 'Extraction rejected by reviewer', result: 'flagged' }
    }
    // Review generated / reset to unverified — not worth an audit row.
    return null
  }
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
  errorMessage?: string
}): Promise<void> {
  const store = getStore()
  const { event, stored, next, errorMessage } = input
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
      event.eventType.endsWith('.error') && next.status === 'error'
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

  for (const row of rows) {
    try {
      await store.appendAuditEvent(row)
    } catch (err) {
      console.warn('[docupipe webhook] audit write failed', err)
    }
  }
}

/**
 * Sync the human-review layer back into the store.
 *
 * - `review.processed.error` (generation failed): clear the dead review ID so
 *   the UI offers "Generate review overlay" again instead of a broken viewer.
 * - `review.verified.success`: fetch the review and mirror the reviewer's
 *   (possibly corrected) values into `extractedFields` — corrections made in
 *   the hosted editor or via in-app corrections both land here, keeping
 *   costs-submitted math and duplicate context on the corrected truth.
 * - `review.rejected.success`: record the rejected state; extracted values
 *   are left as-is (a rejection means "don't rely on this", not new data).
 *
 * Never touches `status` — reviews are an optional layer on top of a
 * completed extraction.
 */
async function handleReviewEvent(
  event: BaseEvent,
  stored: StoredDocument,
): Promise<void> {
  const store = getStore()
  const eventReviewId = extractReviewId(event)
  const updatedAt = new Date().toISOString()

  if (event.eventType.endsWith('.error')) {
    // Only clear the stored ID when the failure is about *that* review (or
    // the event didn't say which one) — an error for a stale review must not
    // orphan a newer, healthy one.
    const matchesStored =
      !eventReviewId || eventReviewId === stored.docupipeReviewId
    if (!matchesStored || !stored.docupipeReviewId) return
    const persisted = await store.upsertDocument({
      ...stored,
      updatedAt,
      docupipeReviewId: undefined,
      docupipeReviewState: undefined,
    })
    await emitAuditEvents({
      event,
      stored,
      next: persisted,
      errorMessage: 'Review overlay generation failed',
    })
    return
  }

  const reviewId = eventReviewId ?? stored.docupipeReviewId
  const review = reviewId ? await getReview(reviewId) : null
  const reviewState =
    parseReviewState(review?.reviewState) ??
    reviewStateFromEventType(event.eventType)
  if (!reviewState) return

  const update: Partial<StoredDocument> = {
    updatedAt,
    docupipeReviewId: reviewId ?? stored.docupipeReviewId,
    docupipeReviewState: reviewState,
  }
  if (reviewState === 'verified' && review) {
    const extracted = normalizeExtractedFields(unwrapReviewData(review.data))
    // Same normalization as the standardization path: POP amounts are
    // magnitudes, never outflows.
    if (
      stored.docType === 'POP' &&
      typeof extracted.amount === 'number' &&
      extracted.amount < 0
    ) {
      extracted.amount = Math.abs(extracted.amount)
    }
    extracted.lineItems = carryAppliedPercents(
      stored.extractedFields?.lineItems,
      extracted.lineItems,
    )
    update.extractedFields = extracted
  }

  const persisted = await store.upsertDocument({ ...stored, ...update })
  await emitAuditEvents({ event, stored, next: persisted })
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
  // Review events identify the Review object, not the document — join back
  // through the persisted review ID when the usual lookups came up empty.
  if (!stored && event.eventType.startsWith('review.')) {
    const reviewId = extractReviewId(event)
    if (reviewId) stored = await store.findDocumentByReviewId(reviewId)
  }

  if (!stored) return

  if (event.eventType.startsWith('review.')) {
    await handleReviewEvent(event, stored)
    return
  }

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
  // Set when this classification came from a user-requested high-effort
  // re-run (rerunExtraction set `pendingEffortLevel`). Standalone
  // classification never chains into standardization the way the workflow
  // does, so we fire the V3 high-effort standardization from here.
  let chainedHighEffort = false
  if (isClassificationSuccess(event.eventType)) {
    const classId = extractClassId(event)
    if (classId) {
      earlyDocType = await docTypeForClassId(classId)
      let schemaId: string | undefined
      try {
        const workflow = await getWorkflow()
        if (workflow) {
          schemaId = workflow.classToSchema[classId]
          if (!schemaId) unmappedClass = true
        }
      } catch (err) {
        console.warn('[docupipe webhook] workflow lookup failed', err)
      }
      const dpDocumentId = stored.docupipeDocumentId ?? docupipeDocumentId
      if (stored.pendingEffortLevel === 'high' && schemaId && dpDocumentId) {
        try {
          await standardizeV3({
            documentId: dpDocumentId,
            schemaId,
            effortLevel: 'high',
          })
          chainedHighEffort = true
        } catch (err) {
          console.warn(
            '[docupipe webhook] high-effort standardization failed',
            err,
          )
        }
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
  if (chainedHighEffort) newStatus = 'standardizing'
  if (newStatus) baseUpdate.status = newStatus
  // A classification result consumes the high-effort marker either way: the
  // chained standardization fired, or the class is (still) unmapped and
  // there is nothing to standardize.
  if (
    isClassificationSuccess(event.eventType) &&
    stored.pendingEffortLevel !== undefined
  ) {
    baseUpdate.pendingEffortLevel = undefined
  }

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
        const extracted = normalizeExtractedFields(
          result.data as Record<string, unknown>,
        )

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

        // A proof of payment records the magnitude disbursed; the model
        // occasionally emits it as a negative (an outflow). Normalize to a
        // positive amount so POP figures are consistent and duplicate /
        // reconciliation math compares like signs.
        if (
          docType === 'POP' &&
          typeof extracted.amount === 'number' &&
          extracted.amount < 0
        ) {
          extracted.amount = Math.abs(extracted.amount)
        }

        extracted.lineItems = carryAppliedPercents(
          stored.extractedFields?.lineItems,
          extracted.lineItems,
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

        const lowConfidence = computeLowConfidence(result.fieldConfidence)

        // Kick off a DocuPipe Visual Review (the yellow-box overlay). This is
        // an async job; we persist the review ID and mint a presigned viewer
        // URL on demand later (see /api/docupipe/review-url). Optional —
        // treat any failure as "not available" so it never blocks extraction.
        let docupipeReviewId: string | undefined
        try {
          const review = await createVisualReview(standardizationId)
          docupipeReviewId = review?.reviewIds[0]
        } catch (err) {
          console.warn('[docupipe webhook] visual review create failed', err)
        }

        // Assign the standardized filing name + destination path, but do NOT
        // file to Egnyte yet — the move is gated behind the confirmation page
        // (see fileSubmissionToEgnyte). The document lands in `ready`.
        const plan = await planFiling({
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
          custodyState: plan.custodyState,
          egnytePlannedPath: plan.plannedPath ?? stored.egnytePlannedPath,
          renamedName: plan.renamedName ?? stored.renamedName,
          docupipeReviewId,
          // A fresh standardization means a fresh review — any prior
          // verified/rejected decision applied to the old extraction.
          docupipeReviewState: undefined,
          fieldConfidence: result.fieldConfidence,
          lowConfidence,
          errorMessage: plan.errorMessage,
        })
        await emitAuditEvents({
          event,
          stored,
          next: persisted,
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
        const webhookSecret = getDocupipeWebhookSecret()
        const headers: Record<string, string> = {}
        request.headers.forEach((value, key) => {
          headers[key] = value
        })
        let verified: unknown
        try {
          const wh = new Webhook(webhookSecret)
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
