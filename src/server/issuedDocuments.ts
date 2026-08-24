/**
 * Schedio-issued deliverables persistence — documents Schedio publishes TO a
 * client entity (cost verification reports, engineer letters), the reverse
 * direction from `dream_documents` (client-submitted intake files).
 *
 * Postgres (`dream_issued_documents`) is the record; file bytes live durably
 * on Vercel Blob under `issued/` (unguessable random-suffixed URLs, same
 * custody model as feedback attachments). Degrades without a database:
 * listing returns empty and publishing reports a clear error.
 */

import { dbQuery } from './database'
import { isDatabaseConfigured } from './env'

export type IssuedDocument = {
  id: string
  clientId: string
  /** Review cycle the deliverable covers, when it maps to one. */
  verificationId?: string
  title: string
  note?: string
  /** Public Vercel Blob URL (unguessable random-suffixed pathname). */
  fileUrl: string
  fileName: string
  contentType?: string
  sizeBytes?: number
  issuedByName: string
  issuedByEmail: string
  createdAtISO: string
}

let tableReady: Promise<void> | null = null

/**
 * Self-healing table create (mirrors db/intelligence/012_issued_documents.sql)
 * so environments that haven't run the migration yet still work.
 */
async function ensureIssuedTable(): Promise<void> {
  if (!tableReady) {
    tableReady = dbQuery(`
      create table if not exists dream_issued_documents (
        id text primary key,
        client_id text not null,
        verification_id text,
        title text not null,
        note text,
        file_url text not null,
        file_name text not null,
        content_type text,
        size_bytes bigint,
        issued_by_name text not null,
        issued_by_email text not null,
        created_at timestamptz not null default now()
      );

      create index if not exists dream_issued_documents_client_idx
        on dream_issued_documents (client_id, created_at desc);
    `).then(() => undefined)
    tableReady.catch(() => {
      tableReady = null
    })
  }
  return tableReady
}

type IssuedRow = {
  id: string
  client_id: string
  verification_id: string | null
  title: string
  note: string | null
  file_url: string
  file_name: string
  content_type: string | null
  size_bytes: string | number | null
  issued_by_name: string
  issued_by_email: string
  created_at: Date
}

function rowToIssued(row: IssuedRow): IssuedDocument {
  return {
    id: row.id,
    clientId: row.client_id,
    verificationId: row.verification_id ?? undefined,
    title: row.title,
    note: row.note ?? undefined,
    fileUrl: row.file_url,
    fileName: row.file_name,
    contentType: row.content_type ?? undefined,
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
    issuedByName: row.issued_by_name,
    issuedByEmail: row.issued_by_email,
    createdAtISO: new Date(row.created_at).toISOString(),
  }
}

export async function storeIssuedDocument(
  doc: Omit<IssuedDocument, 'createdAtISO'>,
): Promise<IssuedDocument> {
  if (!isDatabaseConfigured()) {
    throw new Error('Publishing requires the portal database to be configured')
  }
  await ensureIssuedTable()
  const { rows } = await dbQuery<IssuedRow>(
    `
      insert into dream_issued_documents (
        id, client_id, verification_id, title, note,
        file_url, file_name, content_type, size_bytes,
        issued_by_name, issued_by_email
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *
    `,
    [
      doc.id,
      doc.clientId,
      doc.verificationId ?? null,
      doc.title,
      doc.note ?? null,
      doc.fileUrl,
      doc.fileName,
      doc.contentType ?? null,
      doc.sizeBytes ?? null,
      doc.issuedByName,
      doc.issuedByEmail,
    ],
  )
  return rowToIssued(rows[0])
}

/** Newest first. Empty without a database (degraded mode). */
export async function listIssuedDocumentsForClient(
  clientId: string,
): Promise<IssuedDocument[]> {
  if (!isDatabaseConfigured()) return []
  try {
    await ensureIssuedTable()
    const { rows } = await dbQuery<IssuedRow>(
      `
        select * from dream_issued_documents
        where client_id = $1
        order by created_at desc
      `,
      [clientId],
    )
    return rows.map(rowToIssued)
  } catch (err) {
    console.warn('[issued-documents] list failed', err)
    return []
  }
}

/**
 * Delete one issued document row, scoped to the client so a stale or forged
 * id can't cross entities. Returns the deleted row (for blob cleanup) or
 * null when nothing matched.
 */
export async function removeIssuedDocument(
  id: string,
  clientId: string,
): Promise<IssuedDocument | null> {
  if (!isDatabaseConfigured()) return null
  await ensureIssuedTable()
  const { rows } = await dbQuery<IssuedRow>(
    `
      delete from dream_issued_documents
      where id = $1 and client_id = $2
      returning *
    `,
    [id, clientId],
  )
  return rows.length > 0 ? rowToIssued(rows[0]) : null
}
