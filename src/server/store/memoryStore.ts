/**
 * Ephemeral DREAM store for deployed demos without Vercel KV credentials.
 *
 * This keeps the public mockup renderable when Redis is not provisioned. It is
 * intentionally not durable: serverless instances can cold-start or scale out,
 * so real upload/webhook persistence still requires KV_REST_API_URL and
 * KV_REST_API_TOKEN.
 */

import { buildSeedState } from './seed'
import type {
  DreamSnapshot,
  DreamStore,
  DreamStoreState,
  StoredAuditEvent,
  StoredDocument,
  StoredVerification,
} from './types'

class MemoryStore implements DreamStore {
  private state: DreamStoreState = buildSeedState()
  private seededOnce = false

  async init(): Promise<void> {
    if (this.seededOnce) return
    this.seededOnce = true
  }

  async ensureVerification(input: {
    verificationId: string
    clientId: string
    ref: string
  }): Promise<void> {
    await this.init()
    if (!this.state.verifications[input.verificationId]) {
      this.state.verifications[input.verificationId] = {
        id: input.verificationId,
        clientId: input.clientId,
        ref: input.ref,
      }
    }
    if (!this.state.documentsByVerification[input.verificationId]) {
      this.state.documentsByVerification[input.verificationId] = []
    }
    this.state.revision += 1
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
    this.state.revision += 1
    return merged
  }

  async patchDocument(
    id: string,
    patch: Partial<StoredDocument>,
  ): Promise<StoredDocument | null> {
    await this.init()
    const existing = this.state.documents[id]
    if (!existing) return null
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
    this.state.documents[id] = merged
    this.state.revision += 1
    return merged
  }

  async findDocumentByDocupipeId(
    docupipeDocumentId: string,
  ): Promise<StoredDocument | null> {
    await this.init()
    for (const doc of Object.values(this.state.documents)) {
      if (doc?.docupipeDocumentId === docupipeDocumentId) return doc
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
    this.state.revision += 1
    return next
  }

  async appendAuditEvent(event: StoredAuditEvent): Promise<void> {
    await this.init()
    if (this.state.auditEvents.some((existing) => existing.id === event.id)) {
      return
    }
    this.state.auditEvents.push(event)
    this.state.revision += 1
  }

  async listAuditEvents(input?: {
    clientId?: string
    verificationId?: string
    limit?: number
  }): Promise<ReadonlyArray<StoredAuditEvent>> {
    await this.init()
    let events = this.state.auditEvents.slice()
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

let singleton: MemoryStore | null = null

export function createMemoryStore(): DreamStore {
  if (!singleton) singleton = new MemoryStore()
  return singleton
}
