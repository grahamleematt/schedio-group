/**
 * Durable DREAM store backed by plain Postgres.
 *
 * This is the customer-facing intake store: uploaded/imported files, DocuPipe
 * state, Egnyte custody paths, per-verification filename counters, and audit
 * events. Intelligence tables can consume these rows later, but this store is
 * intentionally independent so the intake portal can stand on its own.
 */

import { dbQuery } from '#/server/database'

import { buildSeedState } from './seed'
import type {
  AuditCategory,
  AuditResult,
  AuditSource,
  CustodyState,
  DocumentStatus,
  DreamSnapshot,
  DreamStore,
  ExtractedFields,
  StoredAuditEvent,
  StoredDocument,
  StoredVerification,
} from './types'
import type { DocType, DuplicateFlag } from '#/lib/sg-dream'

type DocumentRow = {
  id: string
  client_id: string
  verification_id: string
  source_kind: string | null
  original_name: string
  display_name: string
  docupipe_document_id: string | null
  docupipe_job_id: string | null
  docupipe_standardization_id: string | null
  renamed_name: string | null
  doc_type: string
  status: string
  uploaded_at: string | Date
  updated_at: string | Date
  extracted_fields: ExtractedFields | null
  duplicate_flag: string
  matched_previous_name: string | null
  matched_verification_ref: string | null
  error_message: string | null
  custody_state: string | null
  egnyte_incoming_path: string | null
  egnyte_classified_path: string | null
  egnyte_guid: string | null
  egnyte_source_path: string | null
  egnyte_entry_id: string | null
  egnyte_group_id: string | null
  egnyte_checksum: string | null
  egnyte_web_url: string | null
  mime_type: string | null
  size_bytes: string | number | null
  import_job_id: string | null
  visual_review_url: string | null
  field_confidence: Record<string, number> | null
  low_confidence: boolean | null
}

type VerificationRow = {
  id: string
  client_id: string
  ref: string
}

type AuditRow = {
  id: string
  ts: string | Date
  source: string
  category: string
  actor: string
  event: string
  object: string
  result: string
  ip: string | null
  client_id: string | null
  verification_id: string | null
  document_id: string | null
  docupipe_document_id: string | null
  docupipe_event_type: string | null
  detail: string | null
}

function iso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value
}

function maybeNumber(value: string | number | null): number | undefined {
  if (value === null) return undefined
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function rowToDocument(row: DocumentRow): StoredDocument {
  return {
    id: row.id,
    clientId: row.client_id,
    verificationId: row.verification_id,
    sourceKind:
      row.source_kind === 'upload' || row.source_kind === 'egnyte_import'
        ? row.source_kind
        : undefined,
    originalName: row.original_name,
    displayName: row.display_name,
    docupipeDocumentId: row.docupipe_document_id ?? undefined,
    docupipeJobId: row.docupipe_job_id ?? undefined,
    docupipeStandardizationId: row.docupipe_standardization_id ?? undefined,
    renamedName: row.renamed_name ?? undefined,
    docType: row.doc_type as DocType,
    status: row.status as DocumentStatus,
    uploadedAt: iso(row.uploaded_at),
    updatedAt: iso(row.updated_at),
    extractedFields: row.extracted_fields ?? undefined,
    duplicateFlag: row.duplicate_flag as DuplicateFlag,
    matchedPreviousName: row.matched_previous_name ?? undefined,
    matchedVerificationRef: row.matched_verification_ref ?? undefined,
    errorMessage: row.error_message ?? undefined,
    custodyState: (row.custody_state as CustodyState | null) ?? undefined,
    egnyteIncomingPath: row.egnyte_incoming_path ?? undefined,
    egnyteClassifiedPath: row.egnyte_classified_path ?? undefined,
    egnyteGuid: row.egnyte_guid ?? undefined,
    egnyteSourcePath: row.egnyte_source_path ?? undefined,
    egnyteEntryId: row.egnyte_entry_id ?? undefined,
    egnyteGroupId: row.egnyte_group_id ?? undefined,
    egnyteChecksum: row.egnyte_checksum ?? undefined,
    egnyteWebUrl: row.egnyte_web_url ?? undefined,
    mimeType: row.mime_type ?? undefined,
    sizeBytes: maybeNumber(row.size_bytes),
    importJobId: row.import_job_id ?? undefined,
    visualReviewUrl: row.visual_review_url ?? undefined,
    fieldConfidence: row.field_confidence ?? undefined,
    lowConfidence: row.low_confidence ?? undefined,
  }
}

function rowToAudit(row: AuditRow): StoredAuditEvent {
  return {
    id: row.id,
    ts: iso(row.ts),
    source: row.source as AuditSource,
    category: row.category as AuditCategory,
    actor: row.actor,
    event: row.event,
    object: row.object,
    result: row.result as AuditResult,
    ip: row.ip ?? undefined,
    clientId: row.client_id ?? undefined,
    verificationId: row.verification_id ?? undefined,
    documentId: row.document_id ?? undefined,
    docupipeDocumentId: row.docupipe_document_id ?? undefined,
    docupipeEventType: row.docupipe_event_type ?? undefined,
    detail: row.detail ?? undefined,
  }
}

async function ensureSchema(): Promise<void> {
  await dbQuery(`
    create table if not exists dream_store_meta (
      key text primary key,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    );

    create table if not exists dream_verifications (
      id text primary key,
      client_id text not null,
      ref text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table if not exists dream_documents (
      id text primary key,
      client_id text not null,
      verification_id text not null references dream_verifications(id) on delete cascade,
      source_kind text,
      original_name text not null,
      display_name text not null,
      docupipe_document_id text,
      docupipe_job_id text,
      docupipe_standardization_id text,
      renamed_name text,
      doc_type text not null,
      status text not null,
      uploaded_at timestamptz not null,
      updated_at timestamptz not null,
      extracted_fields jsonb,
      duplicate_flag text not null,
      matched_previous_name text,
      matched_verification_ref text,
      error_message text,
      custody_state text,
      egnyte_incoming_path text,
      egnyte_classified_path text,
      egnyte_guid text,
      egnyte_source_path text,
      egnyte_entry_id text,
      egnyte_group_id text,
      egnyte_checksum text,
      egnyte_web_url text,
      mime_type text,
      size_bytes bigint,
      import_job_id text,
      visual_review_url text,
      field_confidence jsonb,
      low_confidence boolean
    );

    create index if not exists dream_documents_verification_idx
      on dream_documents (verification_id, uploaded_at, id);

    create index if not exists dream_documents_docupipe_idx
      on dream_documents (docupipe_document_id)
      where docupipe_document_id is not null;

    create index if not exists dream_documents_egnyte_idx
      on dream_documents (client_id, verification_id, egnyte_group_id, egnyte_entry_id)
      where egnyte_group_id is not null;

    create table if not exists dream_doc_sequences (
      verification_id text not null references dream_verifications(id) on delete cascade,
      doc_type text not null,
      seq integer not null default 0,
      updated_at timestamptz not null default now(),
      primary key (verification_id, doc_type)
    );

    create table if not exists dream_audit_events (
      id text primary key,
      ts timestamptz not null,
      source text not null,
      category text not null,
      actor text not null,
      event text not null,
      object text not null,
      result text not null,
      ip text,
      client_id text,
      verification_id text,
      document_id text,
      docupipe_document_id text,
      docupipe_event_type text,
      detail text
    );

    create index if not exists dream_audit_scope_idx
      on dream_audit_events (client_id, verification_id, ts desc);
  `)
}

async function insertSeedState(): Promise<void> {
  const inserted = await dbQuery<{ key: string }>(
    `
      insert into dream_store_meta (key, value)
      values ('seeded', '{"version": 1}'::jsonb)
      on conflict (key) do nothing
      returning key
    `,
  )
  if (inserted.rowCount === 0) return

  const seed = buildSeedState()
  for (const verification of Object.values(seed.verifications)) {
    if (!verification) continue
    await dbQuery(
      `
        insert into dream_verifications (id, client_id, ref)
        values ($1, $2, $3)
        on conflict (id) do update set
          client_id = excluded.client_id,
          ref = excluded.ref,
          updated_at = now()
      `,
      [verification.id, verification.clientId, verification.ref],
    )
  }
  for (const doc of Object.values(seed.documents)) {
    if (!doc) continue
    await upsertDocumentRow(doc)
  }
  for (const event of seed.auditEvents) {
    await insertAuditEvent(event)
  }
}

async function upsertDocumentRow(doc: StoredDocument): Promise<StoredDocument> {
  const result = await dbQuery<DocumentRow>(
    `
      insert into dream_documents (
        id, client_id, verification_id, source_kind, original_name,
        display_name, docupipe_document_id, docupipe_job_id,
        docupipe_standardization_id, renamed_name, doc_type, status,
        uploaded_at, updated_at, extracted_fields, duplicate_flag,
        matched_previous_name, matched_verification_ref, error_message,
        custody_state, egnyte_incoming_path, egnyte_classified_path,
        egnyte_guid, egnyte_source_path, egnyte_entry_id, egnyte_group_id,
        egnyte_checksum, egnyte_web_url, mime_type, size_bytes,
        import_job_id, visual_review_url, field_confidence, low_confidence
      )
      values (
        $1, $2, $3, $4, $5,
        $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15::jsonb, $16,
        $17, $18, $19,
        $20, $21, $22,
        $23, $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33::jsonb, $34
      )
      on conflict (id) do update set
        client_id = excluded.client_id,
        verification_id = excluded.verification_id,
        source_kind = excluded.source_kind,
        original_name = excluded.original_name,
        display_name = excluded.display_name,
        docupipe_document_id = excluded.docupipe_document_id,
        docupipe_job_id = excluded.docupipe_job_id,
        docupipe_standardization_id = excluded.docupipe_standardization_id,
        renamed_name = excluded.renamed_name,
        doc_type = excluded.doc_type,
        status = excluded.status,
        uploaded_at = excluded.uploaded_at,
        updated_at = now(),
        extracted_fields = excluded.extracted_fields,
        duplicate_flag = excluded.duplicate_flag,
        matched_previous_name = excluded.matched_previous_name,
        matched_verification_ref = excluded.matched_verification_ref,
        error_message = excluded.error_message,
        custody_state = excluded.custody_state,
        egnyte_incoming_path = excluded.egnyte_incoming_path,
        egnyte_classified_path = excluded.egnyte_classified_path,
        egnyte_guid = excluded.egnyte_guid,
        egnyte_source_path = excluded.egnyte_source_path,
        egnyte_entry_id = excluded.egnyte_entry_id,
        egnyte_group_id = excluded.egnyte_group_id,
        egnyte_checksum = excluded.egnyte_checksum,
        egnyte_web_url = excluded.egnyte_web_url,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        import_job_id = excluded.import_job_id,
        visual_review_url = excluded.visual_review_url,
        field_confidence = excluded.field_confidence,
        low_confidence = excluded.low_confidence
      returning *
    `,
    [
      doc.id,
      doc.clientId,
      doc.verificationId,
      doc.sourceKind ?? null,
      doc.originalName,
      doc.displayName,
      doc.docupipeDocumentId ?? null,
      doc.docupipeJobId ?? null,
      doc.docupipeStandardizationId ?? null,
      doc.renamedName ?? null,
      doc.docType,
      doc.status,
      doc.uploadedAt,
      doc.updatedAt,
      doc.extractedFields ? JSON.stringify(doc.extractedFields) : null,
      doc.duplicateFlag,
      doc.matchedPreviousName ?? null,
      doc.matchedVerificationRef ?? null,
      doc.errorMessage ?? null,
      doc.custodyState ?? null,
      doc.egnyteIncomingPath ?? null,
      doc.egnyteClassifiedPath ?? null,
      doc.egnyteGuid ?? null,
      doc.egnyteSourcePath ?? null,
      doc.egnyteEntryId ?? null,
      doc.egnyteGroupId ?? null,
      doc.egnyteChecksum ?? null,
      doc.egnyteWebUrl ?? null,
      doc.mimeType ?? null,
      doc.sizeBytes ?? null,
      doc.importJobId ?? null,
      doc.visualReviewUrl ?? null,
      doc.fieldConfidence ? JSON.stringify(doc.fieldConfidence) : null,
      doc.lowConfidence ?? null,
    ],
  )
  return rowToDocument(result.rows[0])
}

async function insertAuditEvent(event: StoredAuditEvent): Promise<void> {
  await dbQuery(
    `
      insert into dream_audit_events (
        id, ts, source, category, actor, event, object, result, ip,
        client_id, verification_id, document_id, docupipe_document_id,
        docupipe_event_type, detail
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      on conflict (id) do nothing
    `,
    [
      event.id,
      event.ts,
      event.source,
      event.category,
      event.actor,
      event.event,
      event.object,
      event.result,
      event.ip ?? null,
      event.clientId ?? null,
      event.verificationId ?? null,
      event.documentId ?? null,
      event.docupipeDocumentId ?? null,
      event.docupipeEventType ?? null,
      event.detail ?? null,
    ],
  )
}

class PostgresStore implements DreamStore {
  private ready: Promise<void> | null = null

  async init(): Promise<void> {
    if (!this.ready) {
      this.ready = ensureSchema().then(insertSeedState)
    }
    await this.ready
  }

  async ensureVerification(input: {
    verificationId: string
    clientId: string
    ref: string
  }): Promise<void> {
    await this.init()
    await dbQuery(
      `
        insert into dream_verifications (id, client_id, ref)
        values ($1, $2, $3)
        on conflict (id) do update set
          client_id = excluded.client_id,
          ref = excluded.ref,
          updated_at = now()
      `,
      [input.verificationId, input.clientId, input.ref],
    )
  }

  async upsertDocument(doc: StoredDocument): Promise<StoredDocument> {
    await this.init()
    return upsertDocumentRow({ ...doc, updatedAt: new Date().toISOString() })
  }

  async patchDocument(
    id: string,
    patch: Partial<StoredDocument>,
  ): Promise<StoredDocument | null> {
    await this.init()
    const existing = await dbQuery<DocumentRow>(
      `select * from dream_documents where id = $1`,
      [id],
    )
    if (existing.rows.length === 0) return null
    const merged: StoredDocument = {
      ...rowToDocument(existing.rows[0]),
      updatedAt: new Date().toISOString(),
    }
    for (const [key, value] of Object.entries(patch) as Array<
      [keyof StoredDocument, unknown]
    >) {
      if (value === undefined) continue
      ;(merged as Record<string, unknown>)[key as string] = value
    }
    return upsertDocumentRow(merged)
  }

  async findDocumentByDocupipeId(
    docupipeDocumentId: string,
  ): Promise<StoredDocument | null> {
    await this.init()
    const result = await dbQuery<DocumentRow>(
      `select * from dream_documents where docupipe_document_id = $1 limit 1`,
      [docupipeDocumentId],
    )
    return result.rows[0] ? rowToDocument(result.rows[0]) : null
  }

  async getSnapshot(verificationId: string): Promise<DreamSnapshot | null> {
    await this.init()
    const header = await dbQuery<VerificationRow>(
      `select id, client_id, ref from dream_verifications where id = $1`,
      [verificationId],
    )
    const verificationRow = header.rows[0]
    if (!verificationRow) return null

    const docs = await dbQuery<DocumentRow>(
      `
        select * from dream_documents
        where verification_id = $1
        order by uploaded_at asc, id asc
      `,
      [verificationId],
    )
    const verification: StoredVerification = {
      id: verificationRow.id,
      clientId: verificationRow.client_id,
      ref: verificationRow.ref,
      documents: docs.rows.map(rowToDocument),
    }

    const prior = await dbQuery<DocumentRow>(
      `
        select * from dream_documents
        where client_id = $1
          and verification_id <> $2
          and status = 'completed'
        order by uploaded_at desc, id desc
      `,
      [verificationRow.client_id, verificationId],
    )
    return {
      verification,
      priorFilings: prior.rows.map(rowToDocument),
    }
  }

  async nextDocSeqForVerification(
    verificationId: string,
    docType: string,
  ): Promise<number> {
    await this.init()
    const result = await dbQuery<{ seq: number }>(
      `
        insert into dream_doc_sequences (verification_id, doc_type, seq)
        values ($1, $2, 1)
        on conflict (verification_id, doc_type) do update set
          seq = dream_doc_sequences.seq + 1,
          updated_at = now()
        returning seq
      `,
      [verificationId, docType],
    )
    return result.rows[0]?.seq ?? 1
  }

  async appendAuditEvent(event: StoredAuditEvent): Promise<void> {
    await this.init()
    await insertAuditEvent(event)
  }

  async listAuditEvents(input?: {
    clientId?: string
    verificationId?: string
    limit?: number
  }): Promise<ReadonlyArray<StoredAuditEvent>> {
    await this.init()
    const values: Array<string | number> = []
    const where: Array<string> = []
    if (input?.clientId) {
      values.push(input.clientId)
      where.push(`client_id = $${values.length}`)
    }
    if (input?.verificationId) {
      values.push(input.verificationId)
      where.push(`verification_id = $${values.length}`)
    }
    const limit = input?.limit ?? 200
    values.push(limit)
    const result = await dbQuery<AuditRow>(
      `
        select * from dream_audit_events
        ${where.length > 0 ? `where ${where.join(' and ')}` : ''}
        order by ts desc
        limit $${values.length}
      `,
      values,
    )
    return result.rows.map(rowToAudit)
  }
}

let singleton: PostgresStore | null = null

export function createPostgresStore(): DreamStore {
  if (!singleton) singleton = new PostgresStore()
  return singleton
}
