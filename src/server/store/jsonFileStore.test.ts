import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { DreamStore, StoredAuditEvent, StoredDocument } from './types'

// The store hardcodes `.data/` against `process.cwd()` at module-load time, so
// we must chdir into an isolated tmp dir BEFORE the first `import()` of
// jsonFileStore. The store is also a module-level singleton, so we keep one
// instance per file and reset its on-disk state between tests.

const originalCwd = process.cwd()
let tmpDir: string
let store: DreamStore
let dataFile: string

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sg-dream-store-'))
  process.chdir(tmpDir)
  dataFile = path.join(tmpDir, '.data', 'dream.json')
  const mod = await import('./jsonFileStore')
  store = mod.createJsonFileStore()
})

afterAll(async () => {
  process.chdir(originalCwd)
  await fs.rm(tmpDir, { recursive: true, force: true })
})

async function resetStore() {
  // Wipe the on-disk file and re-init the singleton from seeds. We can't
  // un-singleton the in-memory state, so we expose this via the public API by
  // overwriting the file and forcing a re-load through ensureVerification.
  await fs.rm(path.dirname(dataFile), { recursive: true, force: true })
  // Force the singleton to re-load from disk on the next call by clearing its
  // private `loaded` flag via the internal field. Tests are the only place
  // this is acceptable.
  ;(store as unknown as { loaded: boolean; state: unknown }).loaded = false
  ;(store as unknown as { state: unknown }).state = {
    verifications: {},
    documents: {},
    documentsByVerification: {},
    docSeqs: {},
    auditEvents: [],
    revision: 0,
    seeded: false,
  }
  await store.init()
}

const baseDoc: StoredDocument = {
  id: 'tmp-doc-1',
  clientId: 'srcab',
  verificationId: 'srcab-v3',
  originalName: 'invoice.pdf',
  displayName: 'invoice.pdf',
  docType: 'INV',
  status: 'queued',
  uploadedAt: '2026-04-15T00:00:00.000Z',
  updatedAt: '2026-04-15T00:00:00.000Z',
  duplicateFlag: 'none',
}

describe('JsonFileStore.nextDocSeqForVerification', () => {
  it('hands out monotonic, per-(verification, doc type) sequence numbers', async () => {
    await resetStore()

    const a1 = await store.nextDocSeqForVerification('srcab-v3', 'INV')
    const a2 = await store.nextDocSeqForVerification('srcab-v3', 'INV')
    const b1 = await store.nextDocSeqForVerification('srcab-v3', 'CTR')
    const c1 = await store.nextDocSeqForVerification('srcab-v4', 'INV')

    expect(a1).toBe(1)
    expect(a2).toBe(2)
    expect(b1).toBe(1)
    expect(c1).toBe(1)
  })
})

describe('JsonFileStore.patchDocument', () => {
  it('returns null when the document does not exist (no implicit upsert)', async () => {
    await resetStore()
    const result = await store.patchDocument('does-not-exist', {
      status: 'completed',
    })
    expect(result).toBeNull()
  })

  it('merges fields without clobbering with undefined', async () => {
    await resetStore()
    await store.ensureVerification({
      verificationId: 'srcab-v3',
      clientId: 'srcab',
      ref: 'SGD-DP-V3-2026-0028',
    })
    await store.upsertDocument({
      ...baseDoc,
      status: 'classifying',
      docupipeDocumentId: 'dp-doc-1',
    })

    const merged = await store.patchDocument(baseDoc.id, {
      docupipeJobId: 'dp-job-1',
      docupipeDocumentId: undefined,
    })

    expect(merged).not.toBeNull()
    expect(merged!.status).toBe('classifying')
    expect(merged!.docupipeDocumentId).toBe('dp-doc-1')
    expect(merged!.docupipeJobId).toBe('dp-job-1')
  })
})

describe('JsonFileStore.appendAuditEvent', () => {
  it('does not append a duplicate row when the audit id already exists', async () => {
    await resetStore()

    const event: StoredAuditEvent = {
      id: 'audit:docupipe:doc-1:standardization.processed.success:std-1',
      ts: '2026-04-15T00:00:00.000Z',
      source: 'docupipe',
      category: 'documents',
      actor: 'DocuPipe',
      event: 'Field extraction complete',
      object: 'invoice.pdf',
      result: 'ok',
      clientId: 'srcab',
      verificationId: 'srcab-v3',
      documentId: 'tmp-doc-1',
      docupipeDocumentId: 'dp-doc-1',
      docupipeEventType: 'standardization.processed.success',
    }

    await store.appendAuditEvent(event)
    await store.appendAuditEvent({ ...event, ts: '2026-04-15T00:01:00.000Z' })

    const events = await store.listAuditEvents()
    expect(events.filter((row) => row.id === event.id)).toHaveLength(1)
  })
})
