/**
 * Single entry point for the DREAM store. Selects the right implementation
 * at first access. Vercel uses KV only when the integration env vars are
 * present; otherwise the deployed mock falls back to ephemeral memory so a
 * presentation build can still render seeded data without provisioning Redis.
 */

import { isKvConfigured, isVercel } from '../env'
import { createJsonFileStore } from './jsonFileStore'
import { createKvStore } from './kvStore'
import { createMemoryStore } from './memoryStore'
import type { DreamStore } from './types'

let cached: DreamStore | null = null

export function getStore(): DreamStore {
  if (cached) return cached
  if (isKvConfigured()) {
    cached = createKvStore()
  } else if (isVercel()) {
    console.warn(
      '[dream store] KV env vars missing; using ephemeral memory store.',
    )
    cached = createMemoryStore()
  } else {
    cached = createJsonFileStore()
  }
  return cached
}

export type {
  AuditCategory,
  AuditResult,
  AuditSource,
  CustodyState,
  DocumentStatus,
  DreamSnapshot,
  DreamStore,
  DreamStoreState,
  ExtractedFields,
  StoredAuditEvent,
  StoredDocument,
  StoredVerification,
} from './types'
