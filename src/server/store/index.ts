/**
 * Single entry point for the DREAM store. Selects the right implementation
 * at first access. Plain Postgres is preferred for Tim's real intake testing;
 * KV remains supported for older previews, and local dev still falls back to
 * `.data/dream.json` when no database is configured.
 */

import {
  isDatabaseConfigured,
  isKvConfigured,
  isStrictMode,
  isVercel,
} from '../env'
import { createJsonFileStore } from './jsonFileStore'
import { createKvStore } from './kvStore'
import { createMemoryStore } from './memoryStore'
import { createPostgresStore } from './postgresStore'
import type { DreamStore } from './types'

let cached: DreamStore | null = null

export function getStore(): DreamStore {
  if (cached) return cached
  if (isStrictMode() && !isDatabaseConfigured()) {
    throw new Error(
      '[dream store] SG_DREAM_STRICT_MODE is on but DATABASE_URL is not set. ' +
        'Strict mode requires Postgres; refusing to fall back to KV/memory/JSON.',
    )
  }
  if (isDatabaseConfigured()) {
    cached = createPostgresStore()
  } else if (isKvConfigured()) {
    cached = createKvStore()
  } else if (isVercel()) {
    console.warn(
      '[dream store] DATABASE_URL/KV env vars missing; using ephemeral memory store.',
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
