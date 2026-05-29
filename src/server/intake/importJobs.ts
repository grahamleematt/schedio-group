import { dbQuery } from '#/server/database'
import { isDatabaseConfigured } from '#/server/env'

type ImportJobStatus = 'running' | 'completed' | 'failed'
type ImportFileStatus = 'imported' | 'skipped' | 'failed'

export async function createImportJob(input: {
  id: string
  clientId: string
  verificationId: string
  sourcePath: string
  actor: string
}): Promise<void> {
  if (!isDatabaseConfigured()) return
  await dbQuery(
    `
      insert into dream_import_jobs (
        id, client_id, verification_id, source_path, status, actor
      )
      values ($1, $2, $3, $4, 'running', $5)
      on conflict (id) do nothing
    `,
    [
      input.id,
      input.clientId,
      input.verificationId,
      input.sourcePath,
      input.actor,
    ],
  )
}

export async function recordImportFile(input: {
  id: string
  jobId: string
  documentId?: string
  path: string
  entryId?: string
  groupId?: string
  checksum?: string
  status: ImportFileStatus
  errorMessage?: string
}): Promise<void> {
  if (!isDatabaseConfigured()) return
  await dbQuery(
    `
      insert into dream_import_files (
        id, job_id, document_id, egnyte_path, egnyte_entry_id,
        egnyte_group_id, checksum, status, error_message
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      on conflict (id) do update set
        document_id = excluded.document_id,
        status = excluded.status,
        error_message = excluded.error_message
    `,
    [
      input.id,
      input.jobId,
      input.documentId ?? null,
      input.path,
      input.entryId ?? null,
      input.groupId ?? null,
      input.checksum ?? null,
      input.status,
      input.errorMessage ?? null,
    ],
  )
}

export async function finishImportJob(input: {
  id: string
  status: ImportJobStatus
  totalFiles: number
  importedFiles: number
  skippedFiles: number
  failedFiles: number
  errorMessage?: string
}): Promise<void> {
  if (!isDatabaseConfigured()) return
  await dbQuery(
    `
      update dream_import_jobs set
        status = $2,
        total_files = $3,
        imported_files = $4,
        skipped_files = $5,
        failed_files = $6,
        error_message = $7,
        updated_at = now()
      where id = $1
    `,
    [
      input.id,
      input.status,
      input.totalFiles,
      input.importedFiles,
      input.skippedFiles,
      input.failedFiles,
      input.errorMessage ?? null,
    ],
  )
}
