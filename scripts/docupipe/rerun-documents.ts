/**
 * Re-run stored documents through the SG DREAM Ingest workflow — used after
 * an engine upgrade (e.g. stdVersion 2.2 → 3.0) to re-extract documents that
 * classified as UNK, errored, or came back low-confidence.
 *
 *   yarn tsx --env-file=.env.local scripts/docupipe/rerun-documents.ts
 *     → list candidate documents (no writes)
 *
 *   yarn tsx --env-file=.env.local scripts/docupipe/rerun-documents.ts --all-problems
 *     → re-run every candidate
 *
 *   yarn tsx --env-file=.env.local scripts/docupipe/rerun-documents.ts <docId> [...]
 *     → re-run specific store document IDs
 *
 * On-submit workflows only trigger on document submission, so a re-run is a
 * re-submission: the original bytes are pulled from DocuPipe's stored copy
 * and POSTed back through `POST /document` with the same store metadata.
 * Results then flow through the normal webhook path — classification and
 * standardization events update the same stored row (metadata join), mint a
 * fresh review, and recompute the low-confidence flag. The standardized
 * filing name is idempotent, so re-runs never re-mint sequence numbers.
 */

import { getOriginalFileUrl, postDocument } from '#/server/docupipe'
import { listVerificationConfigs } from '#/server/portalConfig'
import { getStore } from '#/server/store'
import type { StoredDocument } from '#/server/store'

function isProblemDocument(doc: StoredDocument): boolean {
  return (
    doc.docType === 'UNK' || doc.status === 'error' || doc.lowConfidence === true
  )
}

function describe(doc: StoredDocument): string {
  const reasons = [
    doc.docType === 'UNK' ? 'UNK' : null,
    doc.status === 'error' ? 'error' : null,
    doc.lowConfidence ? 'low-confidence' : null,
  ]
    .filter(Boolean)
    .join(',')
  return `${doc.id}  ${doc.renamedName ?? doc.originalName}  [${doc.docType}/${doc.status}${reasons ? ` · ${reasons}` : ''}]`
}

async function allDocuments(): Promise<Array<StoredDocument>> {
  const store = getStore()
  const out: Array<StoredDocument> = []
  for (const v of await listVerificationConfigs()) {
    const snapshot = await store.getSnapshot(v.id)
    out.push(...(snapshot?.verification.documents ?? []))
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const docs = await allDocuments()
  const store = getStore()

  let targets: Array<StoredDocument>
  if (args.length === 0 || args[0] === '--list') {
    const candidates = docs.filter(isProblemDocument)
    console.log(
      `${docs.length} documents total; ${candidates.length} problem candidates:`,
    )
    for (const doc of candidates) console.log(`  ${describe(doc)}`)
    if (candidates.length > 0) {
      console.log('\nRe-run them with --all-problems, or pass specific IDs.')
    }
    return
  } else if (args[0] === '--all-problems') {
    targets = docs.filter(isProblemDocument)
  } else {
    const byId = new Map(docs.map((d) => [d.id, d]))
    targets = []
    for (const id of args) {
      const doc = byId.get(id)
      if (!doc) {
        console.error(`unknown document id: ${id}`)
        process.exitCode = 1
        return
      }
      targets.push(doc)
    }
  }

  let submitted = 0
  for (const doc of targets) {
    if (!doc.docupipeDocumentId) {
      console.log(`  skip ${doc.id} — no DocuPipe document ID on file`)
      continue
    }
    const url = await getOriginalFileUrl(doc.docupipeDocumentId)
    if (!url) {
      console.log(`  skip ${doc.id} — original file no longer on DocuPipe`)
      continue
    }
    const res = await fetch(url)
    if (!res.ok) {
      console.log(`  skip ${doc.id} — original download failed (${res.status})`)
      continue
    }
    const contents = await res.arrayBuffer()
    const result = await postDocument({
      contents,
      filename: doc.originalName,
      metadata: {
        clientId: doc.clientId,
        verificationId: doc.verificationId,
        storeDocumentId: doc.id,
      },
    })
    // Point the row at the fresh DocuPipe document and reset to queued so the
    // UI's polling loop resumes; the webhook drives it forward from here
    // exactly like a fresh upload.
    await store.upsertDocument({
      ...doc,
      docupipeDocumentId: result.documentId,
      docupipeJobId: result.jobId,
      status: 'queued',
      errorMessage: undefined,
      updatedAt: new Date().toISOString(),
    })
    submitted += 1
    console.log(`  re-submitted ${describe(doc)} → ${result.documentId}`)
  }
  console.log(`\n${submitted} document(s) submitted.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
