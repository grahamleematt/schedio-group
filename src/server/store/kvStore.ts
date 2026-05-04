/**
 * Prod DREAM store backed by Vercel KV (Upstash Redis).
 *
 * The whole `DreamStoreState` lives under a single key. Every read goes
 * straight to KV — we keep no in-process cache because Vercel can route
 * sequential requests to different lambda instances, and a stale per-instance
 * cache caused webhook handlers to silently miss documents written by the
 * upload server function.
 *
 * Writes use a small revision-guarded retry loop so two concurrent writers
 * don't lose each other's updates. Three attempts is enough for the demo:
 * if all three lose the CAS we throw and the webhook returns a non-fatal
 * `200` (its caller swallows handler errors so Svix doesn't hammer us).
 */

import { kv } from '@vercel/kv'

import { buildSeedState } from './seed'
import type {
  DreamSnapshot,
  DreamStore,
  DreamStoreState,
  StoredAuditEvent,
  StoredDocument,
  StoredVerification,
} from './types'

const STATE_KEY = 'dream:state'
const MAX_RETRIES = 3

function emptyState(): DreamStoreState {
  return {
    verifications: {},
    documents: {},
    documentsByVerification: {},
    docSeqs: {},
    auditEvents: [],
    revision: 0,
    seeded: false,
  }
}

function normalize(state: Partial<DreamStoreState> | null): DreamStoreState {
  if (!state) return emptyState()
  return {
    ...emptyState(),
    ...state,
    verifications: state.verifications ?? {},
    documents: state.documents ?? {},
    documentsByVerification: state.documentsByVerification ?? {},
    docSeqs: state.docSeqs ?? {},
    auditEvents: state.auditEvents ?? [],
    revision: state.revision ?? 0,
    seeded: state.seeded ?? false,
  }
}

class KvStore implements DreamStore {
  private seededOnce = false

  async init(): Promise<void> {
    if (this.seededOnce) return
    const existing = await kv.get<DreamStoreState>(STATE_KEY)
    if (existing && existing.seeded) {
      this.seededOnce = true
      return
    }
    await kv.set(STATE_KEY, buildSeedState())
    this.seededOnce = true
  }

  /**
   * Read → mutate → write loop, guarded by `state.revision`. We only retry
   * on detected concurrent writes; transport errors propagate so the caller
   * (webhook / server fn) can decide what to do.
   */
  private async withState<T>(
    mutate: (state: DreamStoreState) => Promise<T> | T,
  ): Promise<T> {
    await this.init()
    let lastError: unknown
    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const fresh = normalize(await kv.get<DreamStoreState>(STATE_KEY))
      const startingRev = fresh.revision
      const result = await mutate(fresh)
      // Re-read to detect intervening writes; fall back to optimistic write
      // when KV doesn't support a transactional get-set.
      const current = normalize(await kv.get<DreamStoreState>(STATE_KEY))
      if (current.revision !== startingRev) {
        lastError = new Error(
          `KvStore stale write (rev ${startingRev} → ${current.revision})`,
        )
        continue
      }
      fresh.revision = startingRev + 1
      await kv.set(STATE_KEY, fresh)
      return result
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('KvStore exhausted retries')
  }

  async ensureVerification(input: {
    verificationId: string
    clientId: string
    ref: string
  }): Promise<void> {
    await this.withState((state) => {
      if (!state.verifications[input.verificationId]) {
        state.verifications[input.verificationId] = {
          id: input.verificationId,
          clientId: input.clientId,
          ref: input.ref,
        }
      }
      if (!state.documentsByVerification[input.verificationId]) {
        state.documentsByVerification[input.verificationId] = []
      }
    })
  }

  async upsertDocument(doc: StoredDocument): Promise<StoredDocument> {
    return this.withState((state) => {
      const existing = state.documents[doc.id]
      const merged: StoredDocument = existing
        ? { ...existing, ...doc, updatedAt: new Date().toISOString() }
        : { ...doc, updatedAt: new Date().toISOString() }
      state.documents[merged.id] = merged
      const list =
        state.documentsByVerification[merged.verificationId] ?? []
      if (!list.includes(merged.id)) list.push(merged.id)
      state.documentsByVerification[merged.verificationId] = list
      return merged
    })
  }

  async patchDocument(
    id: string,
    patch: Partial<StoredDocument>,
  ): Promise<StoredDocument | null> {
    let result: StoredDocument | null = null
    await this.withState((state) => {
      const existing = state.documents[id]
      if (!existing) return
      const merged: StoredDocument = {
        ...existing,
        updatedAt: new Date().toISOString(),
      }
      for (const [k, v] of Object.entries(patch) as Array<
        [keyof StoredDocument, unknown]
      >) {
        if (v === undefined) continue
        ;(merged as Record<string, unknown>)[k as string] = v
      }
      state.documents[id] = merged
      result = merged
    })
    return result
  }

  async findDocumentByDocupipeId(
    docupipeDocumentId: string,
  ): Promise<StoredDocument | null> {
    await this.init()
    const state = normalize(await kv.get<DreamStoreState>(STATE_KEY))
    for (const d of Object.values(state.documents)) {
      if (d && d.docupipeDocumentId === docupipeDocumentId) return d
    }
    return null
  }

  async getSnapshot(verificationId: string): Promise<DreamSnapshot | null> {
    await this.init()
    const state = normalize(await kv.get<DreamStoreState>(STATE_KEY))
    const header = state.verifications[verificationId]
    if (!header) return null
    const ids = state.documentsByVerification[verificationId] ?? []
    const docs = ids
      .map((id) => state.documents[id])
      .filter((d): d is StoredDocument => Boolean(d))
    const verification: StoredVerification = {
      id: header.id,
      clientId: header.clientId,
      ref: header.ref,
      documents: docs,
    }
    const priorFilings: Array<StoredDocument> = []
    for (const d of Object.values(state.documents)) {
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
    let assigned = 0
    await this.withState((state) => {
      const key = `${verificationId}::${docType}`
      const next = (state.docSeqs[key] ?? 0) + 1
      state.docSeqs[key] = next
      assigned = next
    })
    return assigned
  }

  async appendAuditEvent(event: StoredAuditEvent): Promise<void> {
    await this.withState((state) => {
      if (state.auditEvents.some((existing) => existing.id === event.id)) {
        return
      }
      state.auditEvents.push(event)
    })
  }

  async listAuditEvents(input?: {
    clientId?: string
    verificationId?: string
    limit?: number
  }): Promise<ReadonlyArray<StoredAuditEvent>> {
    await this.init()
    const state = normalize(await kv.get<DreamStoreState>(STATE_KEY))
    let events = state.auditEvents.slice()
    if (input?.clientId) {
      events = events.filter((e) => e.clientId === input.clientId)
    }
    if (input?.verificationId) {
      events = events.filter((e) => e.verificationId === input.verificationId)
    }
    events.sort((a, b) => b.ts.localeCompare(a.ts))
    if (input?.limit !== undefined) {
      events = events.slice(0, input.limit)
    }
    return events
  }
}

let singleton: KvStore | null = null

export function createKvStore(): DreamStore {
  if (!singleton) singleton = new KvStore()
  return singleton
}
