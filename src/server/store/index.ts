/**
 * Single entry point for the DREAM store. Selects the right implementation
 * at first access based on `process.env.VERCEL`; every caller uses the same
 * instance for the life of the process.
 */

import { isVercel } from '../env'
import { createJsonFileStore } from './jsonFileStore'
import { createKvStore } from './kvStore'
import type { DreamStore } from './types'

let cached: DreamStore | null = null

export function getStore(): DreamStore {
  if (cached) return cached
  cached = isVercel() ? createKvStore() : createJsonFileStore()
  return cached
}

export type {
  CustodyState,
  DocumentStatus,
  DreamSnapshot,
  DreamStore,
  DreamStoreState,
  ExtractedFields,
  StoredDocument,
  StoredVerification,
} from './types'
