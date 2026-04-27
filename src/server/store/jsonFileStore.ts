/**
 * Dev-only DREAM store backed by a single JSON file at `.data/dream.json`.
 *
 * The store is the single source of truth for uploaded documents. The
 * webhook writes here; routes read via `getSnapshot`. The browser learns
 * about updates by polling `verificationSnapshotQuery` (see
 * `src/lib/queries.ts`), so there is no in-process EventEmitter to keep in
 * sync — a deliberate simplification that lets the prod KV store and this
 * dev store share the same `DreamStore` interface.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { buildSeedState } from './seed'
import type {
  DreamSnapshot,
  DreamStore,
  DreamStoreState,
  StoredDocument,
  StoredVerification,
} from './types'

const DATA_DIR = path.resolve(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'dream.json')

function emptyState(): DreamStoreState {
  return {
    verifications: {},
    documents: {},
    documentsByVerification: {},
    docSeqs: {},
    revision: 0,
    seeded: false,
  }
}

class JsonFileStore implements DreamStore {
  private state: DreamStoreState = emptyState()
  private writeLock: Promise<void> = Promise.resolve()
  private loaded = false

  async init(): Promise<void> {
    if (this.loaded) return
    await fs.mkdir(DATA_DIR, { recursive: true })
    try {
      const raw = await fs.readFile(DATA_FILE, 'utf8')
      const parsed = JSON.parse(raw) as Partial<DreamStoreState>
      this.state = {
        ...emptyState(),
        ...parsed,
        verifications: parsed.verifications ?? {},
        documents: parsed.documents ?? {},
        documentsByVerification: parsed.documentsByVerification ?? {},
        docSeqs: parsed.docSeqs ?? {},
        revision: parsed.revision ?? 0,
        seeded: parsed.seeded ?? false,
      }
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
      this.state = emptyState()
    }
    if (!this.state.seeded) {
      this.state = buildSeedState()
      await this.flush()
    }
    this.loaded = true
  }

  private async flush(): Promise<void> {
    this.state.revision += 1
    this.writeLock = this.writeLock.then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, JSON.stringify(this.state, null, 2), 'utf8')
    })
    await this.writeLock
  }

  async ensureVerification(input: {
    verificationId: string
    clientId: string
    ref: string
  }): Promise<void> {
    await this.init()
    let mutated = false
    if (!this.state.verifications[input.verificationId]) {
      this.state.verifications[input.verificationId] = {
        id: input.verificationId,
        clientId: input.clientId,
        ref: input.ref,
      }
      mutated = true
    }
    if (!this.state.documentsByVerification[input.verificationId]) {
      this.state.documentsByVerification[input.verificationId] = []
      mutated = true
    }
    if (mutated) await this.flush()
  }

  async upsertDocument(doc: StoredDocument): Promise<StoredDocument> {
    await this.init()
    const existing = this.state.documents[doc.id]
    const merged: StoredDocument = existing
      ? { ...existing, ...doc, updatedAt: new Date().toISOString() }
      : { ...doc, updatedAt: new Date().toISOString() }
    this.state.documents[merged.id] = merged

    const list = this.state.documentsByVerification[merged.verificationId] ?? []
    if (!list.includes(merged.id)) list.push(merged.id)
    this.state.documentsByVerification[merged.verificationId] = list

    await this.flush()
    return merged
  }

  async patchDocument(
    id: string,
    patch: Partial<StoredDocument>,
  ): Promise<StoredDocument | null> {
    await this.init()
    const existing = this.state.documents[id]
    if (!existing) return null
    const merged: StoredDocument = { ...existing, updatedAt: new Date().toISOString() }
    for (const [k, v] of Object.entries(patch) as Array<
      [keyof StoredDocument, unknown]
    >) {
      if (v === undefined) continue
      ;(merged as Record<string, unknown>)[k as string] = v
    }
    this.state.documents[id] = merged
    await this.flush()
    return merged
  }

  async findDocumentByDocupipeId(
    docupipeDocumentId: string,
  ): Promise<StoredDocument | null> {
    await this.init()
    for (const doc of Object.values(this.state.documents)) {
      if (doc && doc.docupipeDocumentId === docupipeDocumentId) return doc
    }
    return null
  }

  async getSnapshot(verificationId: string): Promise<DreamSnapshot | null> {
    await this.init()
    const header = this.state.verifications[verificationId]
    if (!header) return null
    const ids = this.state.documentsByVerification[verificationId] ?? []
    const docs = ids
      .map((id) => this.state.documents[id])
      .filter((d): d is StoredDocument => Boolean(d))
    const verification: StoredVerification = {
      id: header.id,
      clientId: header.clientId,
      ref: header.ref,
      documents: docs,
    }
    const priorFilings: Array<StoredDocument> = []
    for (const d of Object.values(this.state.documents)) {
      if (
        d &&
        d.clientId === header.clientId &&
        d.verificationId !== verificationId &&
        d.status === 'completed'
      ) {
        priorFilings.push(d)
      }
    }
    return { verification, priorFilings }
  }

  async nextDocSeqForVerification(
    verificationId: string,
    docType: string,
  ): Promise<number> {
    await this.init()
    const key = `${verificationId}::${docType}`
    const next = (this.state.docSeqs[key] ?? 0) + 1
    this.state.docSeqs[key] = next
    await this.flush()
    return next
  }
}

let singleton: JsonFileStore | null = null

export function createJsonFileStore(): DreamStore {
  if (!singleton) singleton = new JsonFileStore()
  return singleton
}
