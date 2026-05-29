/**
 * Pure duplicate-detection over (vendor, document_number, amount, date).
 *
 * - Exact: same normalized `(vendorName, documentNumber, amount)` appears in
 *   any prior filing for this client.
 * - Likely: same `(vendorName, amount)` with `documentDate` within ±7 days
 *   of a prior filing, but a different `documentNumber`.
 * - None: everything else.
 *
 * Keeps missing fields lenient — we return `none` rather than throw when
 * DocuPipe extraction is incomplete, and let the UI surface the gap.
 */

import type { DuplicateFlag } from '#/lib/sg-dream'
import type { ExtractedFields, StoredDocument } from './store/types'

export type DuplicateMatch = {
  flag: DuplicateFlag
  matchedPreviousName?: string
  matchedVerificationRef?: string
}

type PriorLookupInput = {
  extracted: ExtractedFields
  priorFilings: ReadonlyArray<StoredDocument>
  /** verificationId → ref, so we can surface the human ref. */
  verificationRefs: Record<string, string>
}

function normalizeVendor(v?: string): string {
  return (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeDocNumber(n?: string): string {
  return (n ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '')
}

function normalizeAmount(a?: number): number | null {
  if (typeof a !== 'number' || Number.isNaN(a)) return null
  return Math.round(a * 100) / 100
}

function parseDate(d?: string): number | null {
  if (!d) return null
  const t = Date.parse(d)
  return Number.isFinite(t) ? t : null
}

const DAY = 24 * 60 * 60 * 1000

export function detectDuplicate(input: PriorLookupInput): DuplicateMatch {
  const vendor = normalizeVendor(input.extracted.vendorName)
  const docNumber = normalizeDocNumber(input.extracted.documentNumber)
  const amount = normalizeAmount(input.extracted.amount)
  const date = parseDate(input.extracted.documentDate)

  if (!vendor || amount === null) return { flag: 'none' }

  let likely: StoredDocument | null = null

  for (const prior of input.priorFilings) {
    const pVendor = normalizeVendor(prior.extractedFields?.vendorName)
    const pDocNum = normalizeDocNumber(prior.extractedFields?.documentNumber)
    const pAmount = normalizeAmount(prior.extractedFields?.amount)
    const pDate = parseDate(prior.extractedFields?.documentDate)

    if (pVendor !== vendor) continue
    if (pAmount === null || pAmount !== amount) continue

    if (docNumber && pDocNum && docNumber === pDocNum) {
      return {
        flag: 'exact',
        matchedPreviousName: prior.originalName,
        matchedVerificationRef:
          input.verificationRefs[prior.verificationId] ?? prior.verificationId,
      }
    }

    if (
      date !== null &&
      pDate !== null &&
      Math.abs(date - pDate) <= 7 * DAY &&
      docNumber !== pDocNum
    ) {
      likely = prior
    }
  }

  if (likely) {
    return {
      flag: 'likely',
      matchedPreviousName: likely.originalName,
      matchedVerificationRef:
        input.verificationRefs[likely.verificationId] ?? likely.verificationId,
    }
  }

  return { flag: 'none' }
}
