/**
 * Minimal typed fetch wrapper over the DocuPipe REST API.
 *
 * Only the methods the testing-stage flow actually needs:
 *   - `postDocument`: upload + kick off the SG DREAM Ingest workflow.
 *   - `getStandardization`: fetch the structured extraction once the
 *     webhook reports `standardization.completed`.
 *
 * There is deliberately no polling helper — the Svix-signed webhook is the
 * only source of progress updates.
 */

import { getEnv } from './env'

import type { ExtractedFields, ExtractedLineItem } from './store/types'

export class DocuPipeError extends Error {
  readonly status: number
  readonly body: unknown
  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name = 'DocuPipeError'
    this.status = status
    this.body = body
  }
}

export type DocuPipeMetadata = {
  clientId: string
  verificationId: string
  storeDocumentId: string
}

export type PostDocumentInput = {
  contents: ArrayBuffer | Uint8Array
  filename: string
  metadata: DocuPipeMetadata
}

export type PostDocumentResult = {
  documentId: string
  /**
   * Workflow job ID returned by DocuPipe. Optional because some preview
   * workflows (without standardization) emit only the document ID. We
   * persist it on the StoredDocument as `docupipeJobId` for correlation
   * with later workflow events.
   */
  jobId?: string
}

export type StandardizationField =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<unknown>
  | Record<string, unknown>

export type StandardizationData = Record<string, StandardizationField>

export type StandardizationResult = {
  id: string
  documentId: string
  schemaId?: string
  className?: string
  data: StandardizationData
  /**
   * Per-scalar-field confidence 0..1, when DocuPipe returns it. DocuPipe's
   * response shape is not 100% stable across schema versions; we accept any
   * shape that surfaces numeric confidences keyed by field name.
   */
  fieldConfidence: Record<string, number>
}

export type CreateReviewResult = {
  /** Review object IDs that DocuPipe will generate (one per standardization). */
  reviewIds: ReadonlyArray<string>
  /** Async job IDs that produce the review objects. */
  jobIds: ReadonlyArray<string>
}

/**
 * Default cutoff for `lowConfidence` flagging. Per-field confidences below
 * this number push the document into the engineer-review path regardless
 * of classification. Can be overridden per-doc-type later.
 */
export const LOW_CONFIDENCE_THRESHOLD = 0.85

/**
 * Extract per-field confidence numbers from DocuPipe's heterogeneous
 * response shapes. Known forms observed in their docs + sample payloads:
 *
 *   1. `{ data: {...}, confidence: { vendor_name: 0.92, ... } }`
 *   2. `{ data: { vendor_name: { value: '...', confidence: 0.92 } } }`
 *   3. `{ data: { vendor_name: '...', vendor_name_confidence: 0.92 } }` —
 *      the AI schema builder emits this when asked for "a confidence score
 *      for each field" because per-field nested objects don't survive its
 *      JSON-Schema generator. We strip the `_confidence` suffix and re-key.
 *   4. Confidence not returned at all (older workflows / preview schemas).
 *
 * (4) returns an empty record; `computeLowConfidence` treats an empty map as
 * low-confidence (needs review) so an un-scored extraction is never silently
 * trusted. Earlier shapes win over later ones — e.g. an explicit top-level
 * map overrides a sibling `_confidence` field for the same key.
 */
const CONFIDENCE_SUFFIX = '_confidence'

export function extractFieldConfidence(
  raw: Record<string, unknown>,
): Record<string, number> {
  const out: Record<string, number> = {}

  const topLevel = raw.confidence
  if (topLevel && typeof topLevel === 'object') {
    for (const [k, v] of Object.entries(topLevel)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    }
  }

  const data = raw.data
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && 'confidence' in v) {
        const c = (v as { confidence?: unknown }).confidence
        if (typeof c === 'number' && Number.isFinite(c)) out[k] = c
        continue
      }
      if (
        k.endsWith(CONFIDENCE_SUFFIX) &&
        typeof v === 'number' &&
        Number.isFinite(v)
      ) {
        const baseKey = k.slice(0, -CONFIDENCE_SUFFIX.length)
        if (baseKey.length > 0 && !(baseKey in out)) {
          out[baseKey] = v
        }
      }
    }
  }

  return out
}

/**
 * True iff the extraction should route to engineer review: either any field
 * confidence value is below `LOW_CONFIDENCE_THRESHOLD`, OR there is no
 * confidence data at all.
 *
 * An empty map means DocuPipe returned no per-field confidence (older
 * workflows, or a schema whose `_confidence` siblings the model left blank).
 * We treat "no signal" as needs-review rather than silently trusting it — an
 * un-scored extraction is exactly the case a human should eyeball, so it must
 * not pass as high-confidence.
 */
export function computeLowConfidence(
  fieldConfidence: Record<string, number>,
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): boolean {
  const values = Object.values(fieldConfidence)
  if (values.length === 0) return true
  for (const v of values) {
    if (v < threshold) return true
  }
  return false
}

function fieldString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function fieldNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v.replace(/[$,\s]/g, ''))
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

/** Unwrap a DocuPipe leaf that may be a primitive or `{ value, confidence }`. */
function unwrapLeaf(x: unknown): unknown {
  if (x && typeof x === 'object' && 'value' in x) {
    return (x as { value?: unknown }).value
  }
  return x
}

const LINE_ITEM_CAP = 200

/**
 * Parse one INV/PA `line_items` element. Leaves may be plain values or
 * `{ value }`-wrapped; keys may be snake_case or camelCase. PA `this_period`
 * maps onto `amount`. Empty rows (no description and no numbers) are skipped
 * by the caller.
 */
function normalizeLineItem(raw: unknown): ExtractedLineItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const leaf = (snake: string, camel: string): unknown =>
    unwrapLeaf(row[snake] !== undefined ? row[snake] : row[camel])

  const description =
    fieldString(leaf('description', 'description')) ??
    fieldString(leaf('description_of_work', 'descriptionOfWork'))
  const itemNumber = fieldString(leaf('item_number', 'itemNumber'))
  const taskOrderReference = fieldString(
    leaf('task_order_reference', 'taskOrderReference'),
  )
  // INV `amount` and PA `this_period` (col E) both land on `amount`.
  const amount =
    fieldNumber(leaf('amount', 'amount')) ??
    fieldNumber(leaf('this_period', 'thisPeriod'))
  const scheduledValue = fieldNumber(
    leaf('scheduled_value', 'scheduledValue'),
  )
  const fromPreviousApplication = fieldNumber(
    leaf('from_previous_application', 'fromPreviousApplication'),
  )
  const materialsStored = fieldNumber(
    leaf('materials_stored', 'materialsStored'),
  )
  const totalCompletedAndStored = fieldNumber(
    leaf('total_completed_and_stored', 'totalCompletedAndStored'),
  )
  const percentComplete = fieldNumber(
    leaf('percent_complete', 'percentComplete'),
  )
  const balanceToFinish = fieldNumber(
    leaf('balance_to_finish', 'balanceToFinish'),
  )
  const retainage = fieldNumber(leaf('retainage', 'retainage'))

  const hasDescription = Boolean(description)
  const hasNumber =
    amount !== undefined ||
    scheduledValue !== undefined ||
    fromPreviousApplication !== undefined ||
    materialsStored !== undefined ||
    totalCompletedAndStored !== undefined ||
    percentComplete !== undefined ||
    balanceToFinish !== undefined ||
    retainage !== undefined
  if (!hasDescription && !hasNumber) return null

  return {
    itemNumber,
    description,
    taskOrderReference,
    amount,
    scheduledValue,
    fromPreviousApplication,
    materialsStored,
    totalCompletedAndStored,
    percentComplete,
    balanceToFinish,
    retainage,
  }
}

function normalizeLineItems(raw: unknown): ReadonlyArray<ExtractedLineItem> | undefined {
  const unwrapped = unwrapLeaf(raw)
  if (!Array.isArray(unwrapped)) return undefined
  const items: Array<ExtractedLineItem> = []
  for (const row of unwrapped.slice(0, LINE_ITEM_CAP)) {
    const item = normalizeLineItem(row)
    if (item) items.push(item)
  }
  return items.length > 0 ? items : undefined
}

/**
 * Map a raw DocuPipe data payload (standardization data, or an unwrapped
 * review payload) onto our `ExtractedFields` shape. DocuPipe can return
 * either primitives (`vendor_name: 'Rusin'`) or objects
 * (`vendor_name: { value: 'Rusin', confidence: 0.92 }`); both are handled.
 * Shared by the webhook (standardization success) and the review-corrections
 * flow (mirroring verified review data back onto the stored document).
 */
export function normalizeExtractedFields(
  raw: Record<string, unknown>,
): ExtractedFields {
  const v = (key: string, alt?: string): unknown => {
    const primary = raw[key]
    const fallback = alt !== undefined ? raw[alt] : undefined
    for (const x of [primary, fallback]) {
      if (x !== undefined) {
        const unwrapped = unwrapLeaf(x)
        // Prefer the unwrapped leaf when present; fall through only when the
        // primary key was absent (undefined), not when it was an empty wrap.
        if (x && typeof x === 'object' && 'value' in x) return unwrapped
        return x
      }
    }
    return undefined
  }
  // PA schema pins `amount` to Current Payment Due (G702 Line 11) and emits a
  // duplicate `current_payment_due` for cross-checking. Prefer the explicit
  // current-payment-due value when present so the headline figure can never
  // regress to a different waterfall line.
  const amount =
    fieldNumber(v('current_payment_due', 'currentPaymentDue')) ??
    fieldNumber(v('amount'))
  return {
    vendorName: fieldString(v('vendor_name', 'vendorName')),
    vendorIdGuess: fieldString(v('vendor_id_guess', 'vendorIdGuess')),
    documentNumber: fieldString(v('document_number', 'documentNumber')),
    amount,
    currency: fieldString(v('currency')),
    documentDate: fieldString(v('document_date', 'documentDate')),
    periodStart: fieldString(v('period_start', 'periodStart')),
    periodEnd: fieldString(v('period_end', 'periodEnd')),
    contractReference: fieldString(
      v('contract_reference', 'contractReference'),
    ),
    contractSumToDate: fieldNumber(
      v('contract_sum_to_date', 'contractSumToDate'),
    ),
    completedAndStoredToDate: fieldNumber(
      v('completed_and_stored_to_date', 'completedAndStoredToDate'),
    ),
    retainage: fieldNumber(v('retainage')),
    totalEarnedLessRetainage: fieldNumber(
      v('total_earned_less_retainage', 'totalEarnedLessRetainage'),
    ),
    lessPreviousPayments: fieldNumber(
      v('less_previous_payments', 'lessPreviousPayments'),
    ),
    balanceToFinish: fieldNumber(v('balance_to_finish', 'balanceToFinish')),
    lineItems: normalizeLineItems(raw.line_items ?? raw.lineItems),
  }
}

function uniqueLineItemKeyMap(
  rows: ReadonlyArray<ExtractedLineItem>,
  keyOf: (row: ExtractedLineItem) => string | undefined,
): Map<string, ExtractedLineItem> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key === undefined) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const map = new Map<string, ExtractedLineItem>()
  for (const row of rows) {
    const key = keyOf(row)
    if (key === undefined || counts.get(key) !== 1) continue
    map.set(key, row)
  }
  return map
}

function normalizedLineItemDescription(
  description: string | undefined,
): string | undefined {
  if (description === undefined) return undefined
  return description.trim().toLowerCase()
}

/**
 * Preserve reviewer-entered `appliedPercent` values across a re-normalization
 * of line items (webhook standardization, review verify, etc.). Matches by
 * unique `itemNumber`, then unique normalized description, then same index
 * when array lengths match. Never invents rows; never overwrites a percent
 * already present on `next`.
 */
export function carryAppliedPercents(
  prev: ReadonlyArray<ExtractedLineItem> | undefined,
  next: ReadonlyArray<ExtractedLineItem> | undefined,
): ReadonlyArray<ExtractedLineItem> | undefined {
  if (next === undefined || next.length === 0) return next
  if (prev === undefined || prev.length === 0) return next
  const hasPrevPercent = prev.some(
    (row) => typeof row.appliedPercent === 'number',
  )
  if (!hasPrevPercent) return next

  const prevByItem = uniqueLineItemKeyMap(prev, (r) => r.itemNumber)
  const nextByItem = uniqueLineItemKeyMap(next, (r) => r.itemNumber)
  const prevByDesc = uniqueLineItemKeyMap(prev, (r) =>
    normalizedLineItemDescription(r.description),
  )
  const nextByDesc = uniqueLineItemKeyMap(next, (r) =>
    normalizedLineItemDescription(r.description),
  )
  const equalLength = prev.length === next.length

  return next.map((nextRow, index) => {
    if (typeof nextRow.appliedPercent === 'number') return nextRow

    let matched: ExtractedLineItem | undefined
    const itemNumber = nextRow.itemNumber
    if (
      itemNumber !== undefined &&
      nextByItem.has(itemNumber) &&
      prevByItem.has(itemNumber)
    ) {
      matched = prevByItem.get(itemNumber)
    }

    if (!matched) {
      const desc = normalizedLineItemDescription(nextRow.description)
      if (
        desc !== undefined &&
        nextByDesc.has(desc) &&
        prevByDesc.has(desc)
      ) {
        matched = prevByDesc.get(desc)
      }
    }

    if (!matched && equalLength) {
      matched = prev[index]
    }

    if (matched && typeof matched.appliedPercent === 'number') {
      return { ...nextRow, appliedPercent: matched.appliedPercent }
    }
    return nextRow
  })
}

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  // Buffer is always available in the server runtime (Node + Vercel Edge polyfill).
  return Buffer.from(u8).toString('base64')
}

async function dpFetch<T>(
  path: string,
  init: RequestInit & { expectJson?: boolean } = {},
): Promise<T> {
  const env = getEnv()
  const url = `${env.DOCUPIPE_BASE_URL.replace(/\/$/, '')}${path}`
  const headers = new Headers(init.headers)
  headers.set('X-API-Key', env.DOCUPIPE_API_KEY)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  const res = await fetch(url, { ...init, headers })
  const text = await res.text()
  let body: unknown = text
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      // keep as text
    }
  }
  if (!res.ok) {
    throw new DocuPipeError(
      res.status,
      body,
      `DocuPipe ${init.method ?? 'GET'} ${path} failed: ${res.status}`,
    )
  }
  return body as T
}

export async function postDocument(
  input: PostDocumentInput,
): Promise<PostDocumentResult> {
  const env = getEnv()
  // Per DocuPipe's OpenAPI: POST /document expects `document.file.contents`
  // (base64) and a top-level camelCase `workflowId`. snake_case keys at the
  // top level are not accepted; passing `workflow_id` produces a 400.
  const payload = {
    document: {
      file: {
        filename: input.filename,
        contents: toBase64(input.contents),
      },
    },
    workflowId: env.DOCUPIPE_WORKFLOW_ID,
    metadata: input.metadata,
  }
  const body = await dpFetch<{
    documentId?: string
    document_id?: string
    jobId?: string
    job_id?: string
    workflowJobId?: string
    workflow_job_id?: string
  }>('/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const documentId = body.documentId ?? body.document_id
  if (!documentId) {
    throw new DocuPipeError(
      500,
      body,
      'DocuPipe POST /document response missing documentId',
    )
  }
  // DocuPipe returns the workflow job under `jobId`; snake_case +
  // workflowJobId fallbacks are defensive for any portal still on a stale
  // response shape.
  const jobId =
    body.jobId ?? body.job_id ?? body.workflowJobId ?? body.workflow_job_id
  return { documentId, jobId }
}

export async function getStandardization(
  standardizationId: string,
): Promise<StandardizationResult> {
  const body = await dpFetch<{
    id: string
    document_id?: string
    documentId?: string
    schema_id?: string
    schemaId?: string
    class_name?: string
    className?: string
    data?: StandardizationData
    confidence?: Record<string, unknown>
  }>(`/standardization/${encodeURIComponent(standardizationId)}`)
  return {
    id: body.id,
    documentId: body.documentId ?? body.document_id ?? '',
    schemaId: body.schemaId ?? body.schema_id,
    className: body.className ?? body.class_name,
    data: body.data ?? {},
    fieldConfidence: extractFieldConfidence(body as Record<string, unknown>),
  }
}

/**
 * Fetch every class registered on the DocuPipe account and return a map
 * from `classId` → `className`. Cached at module scope because classes only
 * change when an operator edits them in the DocuPipe portal — far less
 * often than per-request — and webhooks ship us bare classIds we must
 * translate to the SG DREAM `DocType` enum.
 *
 * The cache is invalidated by `clearDocupipeCaches()` which the test suite
 * uses to force a refetch.
 */
let classCachePromise: Promise<Record<string, string>> | null = null
let workflowCachePromise: Promise<WorkflowDefinition | null> | null = null

export function clearDocupipeCaches(): void {
  classCachePromise = null
  workflowCachePromise = null
}

/** @deprecated Kept for back-compat with earlier tests; prefer clearDocupipeCaches. */
export function clearClassCache(): void {
  clearDocupipeCaches()
}

export type WorkflowDefinition = {
  workflowId: string
  workflowName?: string
  /** Map from DocuPipe classId → schemaId. Empty when no mapping is defined. */
  classToSchema: Record<string, string>
}

export async function getClassMap(): Promise<Record<string, string>> {
  if (classCachePromise) return classCachePromise
  classCachePromise = dpFetch<
    Array<{
      classId?: string
      class_id?: string
      className?: string
      class_name?: string
    }>
  >('/classes').then((rows) => {
    const map: Record<string, string> = {}
    for (const row of rows) {
      const id = row.classId ?? row.class_id
      const name = row.className ?? row.class_name
      if (id && name) map[id] = name
    }
    return map
  })
  try {
    return await classCachePromise
  } catch (err) {
    classCachePromise = null
    throw err
  }
}

/**
 * Fetch the configured DocuPipe workflow and surface its `classToSchema`
 * mapping. Used by the webhook handler to decide, at classification time,
 * whether a standardization event will follow — DocuPipe silently drops
 * standardization for any classId not in the mapping, and emits no further
 * events for that document, so we have to terminate the row ourselves.
 *
 * Cached at module scope. Returns `null` if the workflow ID isn't found
 * (treated as "we don't know — assume standardization will run" so we don't
 * accidentally short-circuit a valid pipeline).
 */
export async function getWorkflow(): Promise<WorkflowDefinition | null> {
  if (workflowCachePromise) return workflowCachePromise
  const env = getEnv()
  workflowCachePromise = dpFetch<
    Array<{
      workflowId?: string
      workflow_id?: string
      workflowName?: string
      workflow_name?: string
      workflowContents?: {
        step?: { classToSchema?: Record<string, string> | null }
      }
    }>
  >('/workflows').then((rows) => {
    const wanted = env.DOCUPIPE_WORKFLOW_ID
    const match = rows.find((w) => (w.workflowId ?? w.workflow_id) === wanted)
    if (!match) return null
    return {
      workflowId: match.workflowId ?? match.workflow_id ?? wanted,
      workflowName: match.workflowName ?? match.workflow_name,
      classToSchema: match.workflowContents?.step?.classToSchema ?? {},
    }
  })
  try {
    return await workflowCachePromise
  } catch (err) {
    workflowCachePromise = null
    throw err
  }
}

// ============================================================================
// Admin / CRUD helpers
// ============================================================================
//
// Used exclusively by `scripts/docupipe/align.ts` to provision and update the
// DocuPipe workspace from `src/server/docupipe-spec.ts`. The runtime webhook
// + upload paths never call these — they only consume cached reads via
// `getClassMap()` / `getWorkflow()` above. Keeping the writers in the same
// module gives us one fetch wrapper, one error type, and one place to stub
// in tests.
// ============================================================================

export type DocupipeClass = {
  classId: string
  className: string
  description?: string
}

export type DocupipeSchema = {
  schemaId: string
  schemaName: string
  jsonSchema: Record<string, unknown> | null
  guidelines?: string | null
}

export type DocupipeWorkflowSummary = {
  workflowId: string
  workflowName?: string
  /** Raw `step` block as DocuPipe returns it; passed back into update verbatim. */
  step: Record<string, unknown>
  stepType?: string
}

export type ClassifyStandardizeStep = {
  classIds?: ReadonlyArray<string>
  multiClass?: boolean
  includeUnknown?: boolean
  instructions?: string
  classToSchema: Record<string, string>
  stdVersion?: number
  guidelines?: string
  useMetadata?: boolean
  displayMode?: 'auto' | 'spatial' | 'sections'
  splitMode?: 'auto' | 'never' | 'all'
  effortLevel?: 'standard' | 'high'
  standardizeTimeout?: number
}

export type WorkflowOnSubmitDocumentRequest = {
  classifyStandardizeStep?: ClassifyStandardizeStep
}

export type WebhookEvent =
  | 'document.processed.success'
  | 'document.processed.error'
  | 'classification.processed.success'
  | 'classification.processed.error'
  | 'standardization.processed.success'
  | 'standardization.processed.error'
  | 'workflow.processed.success'
  | 'workflow.processed.error'
  // Human-review lifecycle: fired when a reviewer finalizes or rejects a
  // Review object (hosted editor or our in-app corrections flow).
  | 'review.verified.success'
  | 'review.rejected.success'

/** List every class in the workspace. */
export async function listClasses(): Promise<ReadonlyArray<DocupipeClass>> {
  const rows = await dpFetch<
    Array<{
      classId?: string
      class_id?: string
      className?: string
      class_name?: string
      description?: string
    }>
  >('/classes')
  const out: Array<DocupipeClass> = []
  for (const row of rows) {
    const id = row.classId ?? row.class_id
    const name = row.className ?? row.class_name
    if (id && name) {
      out.push({ classId: id, className: name, description: row.description })
    }
  }
  return out
}

/** Create a new class. Returns the assigned classId. */
export async function createClass(input: {
  className: string
  description: string
}): Promise<DocupipeClass> {
  const body = await dpFetch<{
    classId?: string
    class_id?: string
    className?: string
    class_name?: string
    description?: string
  }>('/class', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      className: input.className,
      description: input.description,
    }),
  })
  const classId = body.classId ?? body.class_id
  if (!classId) {
    throw new DocuPipeError(
      500,
      body,
      `DocuPipe POST /class for ${input.className} returned no classId`,
    )
  }
  return {
    classId,
    className: body.className ?? body.class_name ?? input.className,
    description: body.description ?? input.description,
  }
}

/** Edit an existing class. Omitted fields are left unchanged. */
export async function editClass(input: {
  classId: string
  className?: string
  description?: string
}): Promise<DocupipeClass> {
  const body = await dpFetch<{
    classId?: string
    class_id?: string
    className?: string
    class_name?: string
    description?: string
  }>('/class/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return {
    classId: body.classId ?? body.class_id ?? input.classId,
    className: body.className ?? body.class_name ?? input.className ?? '',
    description: body.description ?? input.description,
  }
}

/** List every schema in the workspace. */
export async function listSchemas(): Promise<ReadonlyArray<DocupipeSchema>> {
  const rows = await dpFetch<
    Array<{
      schemaId?: string
      schema_id?: string
      schemaName?: string
      schema_name?: string
      jsonSchema?: Record<string, unknown> | null
      json_schema?: Record<string, unknown> | null
      guidelines?: string | null
    }>
  >('/schemas')
  const out: Array<DocupipeSchema> = []
  for (const row of rows) {
    const id = row.schemaId ?? row.schema_id
    const name = row.schemaName ?? row.schema_name
    if (id && name) {
      out.push({
        schemaId: id,
        schemaName: name,
        jsonSchema: row.jsonSchema ?? row.json_schema ?? null,
        guidelines: row.guidelines,
      })
    }
  }
  return out
}

/** Fetch one schema by ID, including its full `jsonSchema` body. */
export async function getSchema(schemaId: string): Promise<DocupipeSchema> {
  const body = await dpFetch<{
    schemaId?: string
    schema_id?: string
    schemaName?: string
    schema_name?: string
    jsonSchema?: Record<string, unknown> | null
    json_schema?: Record<string, unknown> | null
    guidelines?: string | null
  }>(`/schema/${encodeURIComponent(schemaId)}`)
  return {
    schemaId: body.schemaId ?? body.schema_id ?? schemaId,
    schemaName: body.schemaName ?? body.schema_name ?? '',
    jsonSchema: body.jsonSchema ?? body.json_schema ?? null,
    guidelines: body.guidelines,
  }
}

/** Create a new schema. Returns the assigned schemaId. */
export async function createSchema(input: {
  schemaName: string
  jsonSchema: Record<string, unknown>
  guidelines?: string
}): Promise<DocupipeSchema> {
  const body = await dpFetch<{
    schemaId?: string
    schema_id?: string
    schemaName?: string
    schema_name?: string
    jsonSchema?: Record<string, unknown> | null
    guidelines?: string | null
  }>('/schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const id = body.schemaId ?? body.schema_id
  if (!id) {
    throw new DocuPipeError(
      500,
      body,
      `DocuPipe POST /schema for ${input.schemaName} returned no schemaId`,
    )
  }
  return {
    schemaId: id,
    schemaName: body.schemaName ?? body.schema_name ?? input.schemaName,
    jsonSchema: body.jsonSchema ?? input.jsonSchema,
    guidelines: body.guidelines ?? input.guidelines,
  }
}

/** Edit an existing schema's name / description / guidelines.
 *  DocuPipe does **not** accept `jsonSchema` here — body changes require
 *  creating a new schema (see align.ts `replaceSchema`). */
export async function editSchema(input: {
  schemaId: string
  schemaName?: string
  description?: string
  guidelines?: string
}): Promise<{ success: boolean; schemaId: string }> {
  const body = await dpFetch<{
    success?: boolean
  }>('/schema/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return {
    success: body.success ?? true,
    schemaId: input.schemaId,
  }
}

/**
 * List every workflow in the workspace, surfacing the raw `step` block so
 * the align script can pass it back verbatim into `updateWorkflow` after
 * patching specific keys (e.g. adding entries to `classToSchema`).
 */
export async function listWorkflows(): Promise<
  ReadonlyArray<DocupipeWorkflowSummary>
> {
  const rows = await dpFetch<
    Array<{
      workflowId?: string
      workflow_id?: string
      workflowName?: string
      workflow_name?: string
      workflowContents?: {
        step?: Record<string, unknown>
        stepType?: string
      }
    }>
  >('/workflows')
  const out: Array<DocupipeWorkflowSummary> = []
  for (const row of rows) {
    const id = row.workflowId ?? row.workflow_id
    if (!id) continue
    out.push({
      workflowId: id,
      workflowName: row.workflowName ?? row.workflow_name,
      step: row.workflowContents?.step ?? {},
      stepType: row.workflowContents?.stepType,
    })
  }
  return out
}

/**
 * Create a workflow. Currently only supports the `classifyStandardize`
 * step shape — the only one this codebase models — so the input is the
 * step config plus a name; the wrapper handles the request envelope.
 */
export async function createWorkflow(input: {
  workflowName: string
  classifyStandardizeStep: ClassifyStandardizeStep
}): Promise<{ workflowId: string }> {
  const body = await dpFetch<{
    workflowId?: string
    workflow_id?: string
  }>('/workflow/on-submit-document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflowName: input.workflowName,
      classifyStandardizeStep: input.classifyStandardizeStep,
    }),
  })
  const id = body.workflowId ?? body.workflow_id
  if (!id) {
    throw new DocuPipeError(
      500,
      body,
      `DocuPipe POST /workflow/on-submit-document for ${input.workflowName} returned no workflowId`,
    )
  }
  return { workflowId: id }
}

/**
 * Update an existing workflow's step config. The DocuPipe contract expects
 * the full step body (not a partial patch), so callers should fetch the
 * current workflow via `listWorkflows()`, mutate the relevant fields on
 * the `step` object, and pass the result here.
 */
export async function updateWorkflow(
  workflowId: string,
  input: WorkflowOnSubmitDocumentRequest,
): Promise<void> {
  await dpFetch(`/workflow/${encodeURIComponent(workflowId)}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

/**
 * Register a webhook endpoint URL with DocuPipe's Svix layer. DocuPipe
 * does not expose a list endpoint for registered webhooks, so this
 * helper is fire-and-forget — re-registering an existing URL with the
 * same events is a no-op (Svix dedupes), and the user can always fall
 * back to the portal link returned by `/webhook/get-portal-link` for
 * manual inspection.
 */
export async function registerWebhookEndpoint(input: {
  url: string
  subscribedEvents: ReadonlyArray<WebhookEvent>
}): Promise<void> {
  await dpFetch('/webhook/generate-endpoint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: input.url,
      subscribedEvents: input.subscribedEvents,
    }),
  })
}

/**
 * Kick off a DocuPipe Visual Review for a completed standardization.
 *
 * A Review is a *separate object* generated from a standardization: DocuPipe
 * re-reads the document and ties every extracted value to a page + bounding
 * box (the yellow-marker overlay) plus a low/medium/high confidence. The job
 * is asynchronous (≈10s for a one-pager, minutes for long docs), so this only
 * returns the review IDs that *will* be produced — we persist `reviewIds[0]`
 * and mint a viewer URL on demand later via `getReviewPresignedUrl`.
 *
 * Returns `null` (rather than throwing) when DocuPipe rejects the request,
 * so a missing review never blocks the extraction pipeline.
 *
 * @see https://docs.docupipe.ai/reference/post_review_batch  (POST /review/batch)
 */
export async function createVisualReview(
  standardizationId: string,
): Promise<CreateReviewResult | null> {
  try {
    const body = await dpFetch<{
      reviewIds?: ReadonlyArray<string>
      review_ids?: ReadonlyArray<string>
      jobIds?: ReadonlyArray<string>
      job_ids?: ReadonlyArray<string>
    }>('/review/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ standardizationIds: [standardizationId] }),
    })
    const reviewIds = body.reviewIds ?? body.review_ids ?? []
    const jobIds = body.jobIds ?? body.job_ids ?? []
    if (reviewIds.length === 0) return null
    return { reviewIds, jobIds }
  } catch (err) {
    // Visual review isn't available on every plan/workflow; treat any 4xx as
    // "not available" rather than a pipeline error.
    if (err instanceof DocuPipeError && err.status >= 400 && err.status < 500) {
      return null
    }
    throw err
  }
}

// ============================================================================
// Review objects (extraction overlay data)
// ============================================================================
//
// A Review is the standardization payload with every leaf value replaced by
// `{ value, review: { page, confidence, boundingBox } }`. We fetch it raw and
// flatten it into a list of positioned fields that the in-app overlay viewer
// renders on top of the original document, so alignment and rotation are under
// our control instead of DocuPipe's hosted viewer.
// ============================================================================

/** Normalized 0..1 rectangle on a page, origin top-left. */
export type OverlayRect = {
  x: number
  y: number
  width: number
  height: number
}

export type OverlayField = {
  /** Dot path into the standardization payload, e.g. `amount`. */
  path: string
  /** Extracted value as DocuPipe returned it. */
  value: string | number | boolean | null
  /** 1-based page number, when DocuPipe localized the value. */
  page?: number
  /** Normalized bounding box on that page, when available. */
  rect?: OverlayRect
  /** DocuPipe review confidence — `low` / `medium` / `high` or 0..1. */
  confidence?: string | number
}

export type ReviewObject = {
  reviewId: string
  standardizationId: string
  documentId: string
  reviewState?: string
  data: Record<string, unknown>
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/**
 * Parse DocuPipe's `boundingBox` into a normalized rect. The docs describe two
 * shapes: the API reference says `[x1, y1, x2, y2]` corners (top-left +
 * bottom-right), while sample payloads show `[x, y, width, height]`. Both are
 * normalized 0..1. We prefer the corners reading and fall back to
 * width/height when the corners reading is degenerate (x2 <= x1 or y2 <= y1).
 * Accepts an array of numbers or a comma-separated string.
 */
export function parseReviewBoundingBox(raw: unknown): OverlayRect | null {
  let nums: Array<number> | null = null
  if (Array.isArray(raw)) {
    nums = raw.map((v) => Number(v))
  } else if (typeof raw === 'string') {
    nums = raw.split(',').map((v) => Number(v.trim()))
  }
  if (!nums || nums.length < 4 || nums.some((n) => !Number.isFinite(n))) {
    return null
  }
  const [a, b, c, d] = nums
  if (c > a && d > b) {
    // Corners: x1,y1,x2,y2.
    return {
      x: clamp01(a),
      y: clamp01(b),
      width: clamp01(c - a),
      height: clamp01(d - b),
    }
  }
  if (c > 0 && d > 0) {
    // Width/height: x,y,w,h.
    return {
      x: clamp01(a),
      y: clamp01(b),
      width: clamp01(c),
      height: clamp01(d),
    }
  }
  return null
}

function isReviewLeaf(node: Record<string, unknown>): boolean {
  if (!('value' in node)) return false
  if ('review' in node) return true
  // A bare `{ value }` with nothing else is a leaf DocuPipe couldn't localize.
  return Object.keys(node).every((k) => k === 'value' || k === 'review')
}

function leafToField(
  path: string,
  node: Record<string, unknown>,
): OverlayField {
  const value = node.value
  const review =
    node.review && typeof node.review === 'object'
      ? (node.review as Record<string, unknown>)
      : undefined
  const pageRaw = review?.page
  const page =
    typeof pageRaw === 'number' && Number.isFinite(pageRaw) && pageRaw > 0
      ? Math.floor(pageRaw)
      : undefined
  const boxes = review?.boundingBoxes
  const rect =
    parseReviewBoundingBox(review?.boundingBox) ??
    parseReviewBoundingBox(Array.isArray(boxes) ? boxes[0] : null) ??
    undefined
  const confidenceRaw = review?.confidence
  const confidence =
    typeof confidenceRaw === 'string' || typeof confidenceRaw === 'number'
      ? confidenceRaw
      : undefined
  return {
    path,
    value:
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
        ? value
        : null,
    page,
    rect,
    confidence,
  }
}

/**
 * Walk the reviewed payload and return every localized leaf as a flat,
 * render-ready field list, ordered by page then vertical position so the
 * overlay's field rail reads top-to-bottom through the document.
 */
export function flattenReviewData(
  data: Record<string, unknown>,
): ReadonlyArray<OverlayField> {
  const out: Array<OverlayField> = []
  const walk = (node: unknown, path: string) => {
    if (node === null || node === undefined) return
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, path ? `${path}.${i}` : String(i)))
      return
    }
    if (typeof node !== 'object') return
    const record = node as Record<string, unknown>
    if (isReviewLeaf(record)) {
      const field = leafToField(path, record)
      if (field.value !== null && field.value !== '') out.push(field)
      return
    }
    for (const [key, child] of Object.entries(record)) {
      walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(data, '')
  return out.sort((a, b) => {
    const pageA = a.page ?? Number.MAX_SAFE_INTEGER
    const pageB = b.page ?? Number.MAX_SAFE_INTEGER
    if (pageA !== pageB) return pageA - pageB
    return (a.rect?.y ?? 1) - (b.rect?.y ?? 1)
  })
}

/**
 * Fetch a review object by ID. Returns `null` when the review doesn't exist
 * yet (async generation still running) or the plan doesn't support reviews,
 * mirroring `createVisualReview`'s soft-failure contract.
 */
export async function getReview(
  reviewId: string,
): Promise<ReviewObject | null> {
  try {
    const body = await dpFetch<{
      reviewId?: string
      review_id?: string
      standardizationId?: string
      standardization_id?: string
      documentId?: string
      document_id?: string
      reviewState?: string
      review_state?: string
      data?: Record<string, unknown>
    }>(`/review?review_id=${encodeURIComponent(reviewId)}`)
    return {
      reviewId: body.reviewId ?? body.review_id ?? reviewId,
      standardizationId:
        body.standardizationId ?? body.standardization_id ?? '',
      documentId: body.documentId ?? body.document_id ?? '',
      reviewState: body.reviewState ?? body.review_state,
      data: body.data ?? {},
    }
  } catch (err) {
    if (err instanceof DocuPipeError && err.status >= 400 && err.status < 500) {
      return null
    }
    throw err
  }
}

/**
 * Collapse a review payload back into plain standardization-shaped data:
 * every `{ value, review }` leaf becomes its bare `value`. The result can be
 * fed to `normalizeExtractedFields` to mirror reviewer-corrected values onto
 * the stored document.
 */
export function unwrapReviewData(
  data: Record<string, unknown>,
): Record<string, unknown> {
  const unwrap = (node: unknown): unknown => {
    if (node === null || node === undefined) return node
    if (Array.isArray(node)) return node.map(unwrap)
    if (typeof node !== 'object') return node
    const record = node as Record<string, unknown>
    if (isReviewLeaf(record)) return record.value
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(record)) {
      out[key] = unwrap(child)
    }
    return out
  }
  return unwrap(data) as Record<string, unknown>
}

export type ReviewEdit = {
  /** Dot path into the review payload, as produced by `flattenReviewData`. */
  path: string
  value: string | number | boolean | null
}

/**
 * Apply in-app corrections to a review payload without disturbing its
 * localization metadata: each edit walks to the `{ value, review }` leaf at
 * `path` and replaces only `value`, keeping page/box/confidence intact so the
 * overlay still points at where the original was read. Unknown paths are
 * skipped (the review may have regenerated since the client loaded it);
 * returns the new payload plus the paths that actually applied.
 */
export function applyReviewEdits(
  data: Record<string, unknown>,
  edits: ReadonlyArray<ReviewEdit>,
): { data: Record<string, unknown>; appliedPaths: ReadonlyArray<string> } {
  const next = structuredClone(data)
  const applied: Array<string> = []
  for (const edit of edits) {
    const segments = edit.path.split('.')
    let node: unknown = next
    let ok = true
    for (const segment of segments) {
      if (Array.isArray(node)) {
        node = node[Number(segment)]
      } else if (node && typeof node === 'object') {
        node = (node as Record<string, unknown>)[segment]
      } else {
        ok = false
        break
      }
    }
    if (!ok || !node || typeof node !== 'object' || Array.isArray(node)) {
      continue
    }
    const leaf = node as Record<string, unknown>
    if (!isReviewLeaf(leaf)) continue
    leaf.value = edit.value
    applied.push(edit.path)
  }
  return { data: next, appliedPaths: applied }
}

export type ReviewBoxEdit = {
  /** Dot path into the review payload, as produced by `flattenReviewData`. */
  path: string
  /** New normalized rect (0..1, origin top-left, base page orientation). */
  rect: OverlayRect
  /** 1-based page the box lives on. Omit to keep the leaf's current page. */
  page?: number
}

/**
 * Apply dragged-box corrections to a review payload: each edit walks to the
 * `{ value, review }` leaf at `path` and replaces `review.boundingBoxes` with
 * the new rect (stored in DocuPipe's corner form `[x1, y1, x2, y2]`), leaving
 * the extracted `value` untouched. The mirror image of `applyReviewEdits`,
 * which replaces values and leaves boxes alone. Unknown paths are skipped;
 * returns the new payload plus the paths that actually applied.
 */
export function applyReviewBoxEdits(
  data: Record<string, unknown>,
  edits: ReadonlyArray<ReviewBoxEdit>,
): { data: Record<string, unknown>; appliedPaths: ReadonlyArray<string> } {
  const next = structuredClone(data)
  const applied: Array<string> = []
  for (const edit of edits) {
    const segments = edit.path.split('.')
    let node: unknown = next
    let ok = true
    for (const segment of segments) {
      if (Array.isArray(node)) {
        node = node[Number(segment)]
      } else if (node && typeof node === 'object') {
        node = (node as Record<string, unknown>)[segment]
      } else {
        ok = false
        break
      }
    }
    if (!ok || !node || typeof node !== 'object' || Array.isArray(node)) {
      continue
    }
    const leaf = node as Record<string, unknown>
    if (!isReviewLeaf(leaf)) continue
    const review =
      leaf.review && typeof leaf.review === 'object'
        ? (leaf.review as Record<string, unknown>)
        : {}
    const { x, y, width, height } = edit.rect
    review.boundingBoxes = [[x, y, x + width, y + height]]
    if (edit.page !== undefined) review.page = edit.page
    leaf.review = review
    applied.push(edit.path)
  }
  return { data: next, appliedPaths: applied }
}

export type ReviewStatus = 'unverified' | 'verified' | 'rejected'

/**
 * Update a review object: replace its data (optional) and set its lifecycle
 * status. This is the entire write surface behind DocuPipe's hosted editor —
 * finalize maps to `reviewStatus: 'verified'`, reject to `'rejected'`.
 * Reviews are forks: updating one never mutates the parent standardization,
 * so callers must mirror accepted values into the store themselves.
 *
 * @see https://docs.docupipe.ai/reference/update_review
 *   (POST /review/{review_id}/update)
 */
export async function updateReview(
  reviewId: string,
  input: { data?: Record<string, unknown>; reviewStatus: ReviewStatus },
): Promise<void> {
  await dpFetch(`/review/${encodeURIComponent(reviewId)}/update`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(input.data !== undefined ? { data: input.data } : {}),
      reviewStatus: input.reviewStatus,
    }),
  })
}

export type StandardizeV3Result = {
  jobId: string
  standardizationId: string
}

/**
 * Kick off a targeted V3 standardization for one document — the per-document
 * escalation lever behind "Re-run extraction (high effort)". Unlike the
 * workflow path (which runs at the workflow's default effort), this lets us
 * re-extract a single problem document with `effortLevel: 'high'` (+2
 * credits/page) without raising cost for the whole pipeline. The job is
 * async; results arrive via the same `standardization.processed.success`
 * webhook the workflow uses.
 *
 * @see https://docs.docupipe.ai/reference/post_standardize_v3
 */
export async function standardizeV3(input: {
  documentId: string
  schemaId: string
  effortLevel: 'standard' | 'high'
}): Promise<StandardizeV3Result> {
  const body = await dpFetch<{
    jobId?: string
    job_id?: string
    standardizationId?: string
    standardization_id?: string
  }>('/v3/standardize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      documentId: input.documentId,
      schemaId: input.schemaId,
      effortLevel: input.effortLevel,
    }),
  })
  const jobId = body.jobId ?? body.job_id
  const standardizationId = body.standardizationId ?? body.standardization_id
  if (!jobId || !standardizationId) {
    throw new DocuPipeError(
      500,
      body,
      'DocuPipe POST /v3/standardize response missing jobId/standardizationId',
    )
  }
  return { jobId, standardizationId }
}

/**
 * Re-run classification for one document against the given classes. Used by
 * the high-effort re-run when a document is stuck at UNK — classification has
 * no effort knob, but a standalone re-classify (with `displayMode` left to
 * the AI) gives the classifier a second look; the result arrives via the
 * `classification.processed.success` webhook.
 *
 * @see https://docs.docupipe.ai/reference/post_classify_batch
 */
export async function classifyDocument(input: {
  documentId: string
  classIds?: ReadonlyArray<string>
}): Promise<{ jobId?: string }> {
  const body = await dpFetch<{ jobId?: string; job_id?: string }>(
    '/classify/batch',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentIds: [input.documentId],
        ...(input.classIds && input.classIds.length > 0
          ? { classIds: [...input.classIds] }
          : {}),
        includeUnknown: true,
      }),
    },
  )
  return { jobId: body.jobId ?? body.job_id }
}

/**
 * Presigned URL for a document's original file bytes — the exact rendition
 * DocuPipe extracted from (converted PDF for HTML/Word/TIFF uploads), which
 * makes it the ideal source for the in-app overlay: box coordinates and page
 * geometry are guaranteed to match. Returns `null` when the document is gone.
 */
export async function getOriginalFileUrl(
  documentId: string,
): Promise<string | null> {
  try {
    const body = await dpFetch<{ url?: string; data?: { url?: string } }>(
      `/document/${encodeURIComponent(documentId)}/download/original-url`,
    )
    return body.url ?? body.data?.url ?? null
  } catch (err) {
    if (err instanceof DocuPipeError && err.status >= 400 && err.status < 500) {
      return null
    }
    throw err
  }
}

/**
 * Mint a short-lived presigned URL to DocuPipe's hosted review viewer for a
 * single review object. These links carry their own signature + expiry, so we
 * generate them on demand (never store them) — that keeps the link scoped to
 * one review and lets it expire.
 *
 * Returns `null` when the review doesn't exist yet (the async generation job
 * is still running) or isn't available.
 *
 * @param expiryHours — link validity window; omit for a non-expiring link.
 * @see https://docs.docupipe.ai/reference/get_presigned_url
 *   (GET /review/{review_id}/presigned-url)
 */
export async function getReviewPresignedUrl(
  reviewId: string,
  expiryHours = 24,
): Promise<string | null> {
  try {
    const query =
      expiryHours > 0 ? `?expiry_hours=${encodeURIComponent(expiryHours)}` : ''
    const body = await dpFetch<{ url?: string }>(
      `/review/${encodeURIComponent(reviewId)}/presigned-url${query}`,
    )
    return body.url ?? null
  } catch (err) {
    if (err instanceof DocuPipeError && err.status >= 400 && err.status < 500) {
      return null
    }
    throw err
  }
}
