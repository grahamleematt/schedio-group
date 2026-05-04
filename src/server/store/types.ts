/**
 * Types for the server-side DREAM store. The store is the single source of
 * truth for uploaded documents + their DocuPipe processing status; the
 * webhook writes, routes read via server functions.
 */

import type { DocType, DuplicateFlag } from '#/lib/sg-dream'

/**
 * Phase of a document inside the SG DREAM Ingest workflow.
 *
 * - `queued`       — POSTed to DocuPipe, awaiting first webhook
 * - `classifying`  — DocuPipe reports the classifier is running
 * - `standardizing`— classifier done, schema extraction running
 * - `completed`    — extraction + duplicate detection finished
 * - `error`        — any step failed; `errorMessage` populated
 */
export type DocumentStatus =
  | 'queued'
  | 'classifying'
  | 'standardizing'
  | 'completed'
  | 'error'

/**
 * Minimum extracted shape we surface in the UI. Superset of every per-class
 * schema in docs/docupipe-setup.md; everything optional so one type covers
 * all doc types.
 */
export type ExtractedFields = {
  vendorName?: string
  vendorIdGuess?: string
  documentNumber?: string
  amount?: number
  currency?: string
  documentDate?: string
  periodStart?: string
  periodEnd?: string
  contractReference?: string
}

/**
 * SG DREAM System Constitution document custody lifecycle. Phase 1 of the
 * wiring follow-up produces only `incoming` → `processing` → `classified`;
 * `relied` and `locked` are reserved for the engineer-approval lifecycle
 * that lands in a later phase but exist on the union for forward compat.
 */
export type CustodyState =
  | 'incoming'
  | 'processing'
  | 'classified'
  | 'relied'
  | 'locked'

export type StoredDocument = {
  id: string
  clientId: string
  verificationId: string
  originalName: string
  /** Stable label the UI falls back to until `extractedFields` populates. */
  displayName: string
  /** DocuPipe document ID; populated after `postDocument` resolves. */
  docupipeDocumentId?: string
  /** DocuPipe workflow job ID; persisted so we can correlate workflow events. */
  docupipeJobId?: string
  /** DocuPipe standardization ID; populated by the webhook. */
  docupipeStandardizationId?: string
  /** Renamed-file label per SG DREAM naming convention, assembled post-extract. */
  renamedName?: string
  docType: DocType
  status: DocumentStatus
  uploadedAt: string
  updatedAt: string
  extractedFields?: ExtractedFields
  duplicateFlag: DuplicateFlag
  matchedPreviousName?: string
  matchedVerificationRef?: string
  errorMessage?: string

  /** Egnyte Layer 1 custody state; see CustodyState doc above. */
  custodyState?: CustodyState
  /** Full Egnyte path where the original was dropped on upload. */
  egnyteIncomingPath?: string
  /** Full Egnyte path after the classifier promoted the file to Classified/. */
  egnyteClassifiedPath?: string
  /** Egnyte GUID (stable across moves / renames). */
  egnyteGuid?: string
  /** Pre-built human-facing Egnyte Web URL (computed server-side). */
  egnyteWebUrl?: string

  /** DocuPipe Visual Review URL (yellow-box overlay image). */
  visualReviewUrl?: string
  /** Per-scalar-field confidence 0..1, when DocuPipe returns it. */
  fieldConfidence?: Record<string, number>
  /**
   * True iff any scalar field's confidence is below
   * `LOW_CONFIDENCE_THRESHOLD`. Governance requires engineer review before
   * reliance when this is true.
   */
  lowConfidence?: boolean
}

export type StoredVerification = {
  id: string
  clientId: string
  ref: string
  documents: ReadonlyArray<StoredDocument>
}

export type DreamSnapshot = {
  verification: StoredVerification
  /** All docs for the same clientId across prior verifications, for duplicate UI. */
  priorFilings: ReadonlyArray<StoredDocument>
}

/* ─────────────────────────────── Audit events ──────────────────────────── */

export type AuditCategory =
  | 'auth'
  | 'documents'
  | 'verifications'
  | 'access'
  | 'system'

export type AuditResult =
  | 'ok'
  | 'override'
  | 'flagged'
  | 'pending'
  | 'failed'

export type AuditSource = 'docupipe' | 'egnyte' | 'system' | 'user'

/**
 * Single immutable audit row appended to the store. Events are
 * append-only (the caller never updates an existing row); each row carries
 * enough provenance to render in the UI and to be filtered per-entity.
 *
 * `docupipeEventType` carries the raw DocuPipe event name (e.g.
 * `standardization.processed.success`) so the audit table can show it as
 * the technical "event" and the rendered label is purely cosmetic.
 */
export type StoredAuditEvent = {
  id: string
  /** ISO timestamp; the audit table renders a friendly label off this. */
  ts: string
  source: AuditSource
  category: AuditCategory
  actor: string
  /** Short human-facing event label (e.g. "Document classified as INV"). */
  event: string
  /** Object the event acted on (doc display name, ref, file, etc.). */
  object: string
  result: AuditResult
  ip?: string
  clientId?: string
  verificationId?: string
  /** SG DREAM document ID (matches `StoredDocument.id`). */
  documentId?: string
  /** DocuPipe document ID, when available. */
  docupipeDocumentId?: string
  /** Raw DocuPipe event type, when the row originated from a webhook. */
  docupipeEventType?: string
  /** Optional free-form note (extracted amount, error message). */
  detail?: string
}

export type DreamStoreState = {
  /** verificationId → header metadata (clientId, ref). */
  verifications: Record<
    string,
    { id: string; clientId: string; ref: string } | undefined
  >
  /** documentId → row. Documents are not nested inside verifications
   * so upserts from the webhook are O(1) without re-indexing. */
  documents: Record<string, StoredDocument | undefined>
  /** verificationId → ordered list of documentIds (upload order). */
  documentsByVerification: Record<string, Array<string> | undefined>
  /** "<verificationId>::<docType>" → highest seq handed out so far (1-based). */
  docSeqs: Record<string, number | undefined>
  /** Append-only audit log. Newest events appended at the end of the array. */
  auditEvents: Array<StoredAuditEvent>
  /** Monotonic revision; bumped on every successful write. */
  revision: number
  seeded: boolean
}

/**
 * Per-verification, per-doc-type monotonic counter used by the webhook to
 * mint the `seq` segment of the SG DREAM renamed filename. Splitting it out
 * here (rather than threading the verification record through) keeps the
 * webhook's renaming step a single store call regardless of backend.
 */
export type DreamStore = {
  /** Seed from prior-filing mock data on first boot if empty. */
  init: () => Promise<void>

  ensureVerification: (input: {
    verificationId: string
    clientId: string
    ref: string
  }) => Promise<void>

  upsertDocument: (doc: StoredDocument) => Promise<StoredDocument>

  /**
   * Field-by-field merge against an existing row. `undefined` values in the
   * patch never overwrite a defined value on the stored row — which lets a
   * slow second writer (e.g. the upload server fn attaching `docupipeJobId`
   * after a fast webhook already advanced `status` to `classifying`) avoid
   * clobbering the webhook's state. Returns the merged row, or `null` when
   * the document does not exist (no upsert semantics).
   */
  patchDocument: (
    id: string,
    patch: Partial<StoredDocument>,
  ) => Promise<StoredDocument | null>

  findDocumentByDocupipeId: (
    docupipeDocumentId: string,
  ) => Promise<StoredDocument | null>

  getSnapshot: (verificationId: string) => Promise<DreamSnapshot | null>

  /**
   * Atomic-ish counter for assembling the SG DREAM renamed filename. Returns
   * the *next* unused sequence number for `(verificationId, docType)`. Each
   * call increments. Implementations must scope the counter so two different
   * docTypes inside the same verification don't share a counter.
   */
  nextDocSeqForVerification: (
    verificationId: string,
    docType: string,
  ) => Promise<number>

  /**
   * Append-only audit log writer. Re-appending an existing `event.id` is a
   * no-op so Svix/DocuPipe replay cannot duplicate audit rows.
   */
  appendAuditEvent: (event: StoredAuditEvent) => Promise<void>

  /**
   * Returns audit events newest-first. Optionally narrow to a single
   * client/verification. `limit` is applied after sorting.
   */
  listAuditEvents: (input?: {
    clientId?: string
    verificationId?: string
    limit?: number
  }) => Promise<ReadonlyArray<StoredAuditEvent>>
}
