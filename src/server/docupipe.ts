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

export type StandardizationField = string | number | boolean | null

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

export type VisualReviewResult = {
  url: string
  thumbnailUrl?: string
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
 * (4) returns an empty record and `lowConfidence` is left to the caller to
 * interpret (we default to `false` in that case so the UI doesn't alarm on
 * every doc). Earlier shapes win over later ones — e.g. an explicit top-level
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
 * True iff any field confidence value is below `LOW_CONFIDENCE_THRESHOLD`.
 * Returns `false` when `fieldConfidence` is empty — no evidence of low
 * confidence is treated as "good enough" per the plan.
 */
export function computeLowConfidence(
  fieldConfidence: Record<string, number>,
  threshold: number = LOW_CONFIDENCE_THRESHOLD,
): boolean {
  for (const v of Object.values(fieldConfidence)) {
    if (v < threshold) return true
  }
  return false
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
// module gives us one fetch wrapper, one error type, and one place to mock
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

/** Edit an existing schema. Omitted fields are left unchanged. */
export async function editSchema(input: {
  schemaId: string
  schemaName?: string
  jsonSchema?: Record<string, unknown>
  guidelines?: string
}): Promise<DocupipeSchema> {
  const body = await dpFetch<{
    schemaId?: string
    schemaName?: string
    jsonSchema?: Record<string, unknown> | null
    guidelines?: string | null
  }>('/schema/edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return {
    schemaId: body.schemaId ?? input.schemaId,
    schemaName: body.schemaName ?? input.schemaName ?? '',
    jsonSchema: body.jsonSchema ?? input.jsonSchema ?? null,
    guidelines: body.guidelines ?? input.guidelines,
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
 * Fetch DocuPipe's "Visual Review" URL for a completed standardization.
 * DocuPipe renders an image with yellow boxes over the regions of the PDF
 * that contributed to each extracted field; we surface that URL on the
 * `/confirmation` page as the engineer's verification artifact.
 */
export async function getVisualReview(
  standardizationId: string,
): Promise<VisualReviewResult | null> {
  try {
    const body = await dpFetch<{
      url?: string
      visual_review_url?: string
      visualReviewUrl?: string
      thumbnail_url?: string
      thumbnailUrl?: string
    }>(
      `/standardization/${encodeURIComponent(standardizationId)}/visual-review`,
    )
    const url = body.url ?? body.visualReviewUrl ?? body.visual_review_url
    if (!url) return null
    return {
      url,
      thumbnailUrl: body.thumbnailUrl ?? body.thumbnail_url,
    }
  } catch (err) {
    // Visual review may not be enabled on every workflow; treat any 4xx as
    // "not available" rather than an error.
    if (err instanceof DocuPipeError && err.status >= 400 && err.status < 500) {
      return null
    }
    throw err
  }
}
