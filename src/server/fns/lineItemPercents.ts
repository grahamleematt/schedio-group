/**
 * Persist reviewer-applied approval percentages onto extracted line items.
 *
 * `extracted_fields` is jsonb / full-JSON across store backends, so percentages
 * land on `ExtractedLineItem.appliedPercent` without a schema migration.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { assertClientAccess } from '#/server/authz'
import { getStore } from '#/server/store'
import type {
  DreamSnapshot,
  ExtractedLineItem,
  StoredAuditEvent,
  StoredDocument,
} from '#/server/store'

export type SaveLineItemPercentsResult = {
  ok: boolean
  appliedCount: number
  snapshot: DreamSnapshot | null
  error?: string
}

export type LineItemPercentEdit = {
  index: number
  percent: number | null
}

/** Clamp a reviewer percent into the inclusive 0–100 range. */
export function clampAppliedPercent(percent: number): number {
  if (!Number.isFinite(percent)) return 0
  return Math.min(100, Math.max(0, percent))
}

/**
 * Apply percent edits onto a line-item array by index. Out-of-range indices
 * are ignored; `null` clears `appliedPercent`.
 */
export function applyLineItemPercents(
  lineItems: ReadonlyArray<ExtractedLineItem>,
  percents: ReadonlyArray<LineItemPercentEdit>,
): { items: Array<ExtractedLineItem>; appliedCount: number } {
  const items = lineItems.map((item) => ({ ...item }))
  let appliedCount = 0
  for (const edit of percents) {
    if (
      !Number.isInteger(edit.index) ||
      edit.index < 0 ||
      edit.index >= items.length
    ) {
      continue
    }
    appliedCount += 1
    if (edit.percent === null) {
      const { appliedPercent: _cleared, ...rest } = items[edit.index]
      items[edit.index] = rest
    } else {
      items[edit.index] = {
        ...items[edit.index],
        appliedPercent: clampAppliedPercent(edit.percent),
      }
    }
  }
  return { items, appliedCount }
}

function percentsAuditEvent(input: {
  actor: string
  document: StoredDocument
  appliedCount: number
  totalRows: number
}): StoredAuditEvent {
  const { actor, document, appliedCount, totalRows } = input
  return {
    id: randomUUID(),
    ts: new Date().toISOString(),
    source: 'user',
    category: 'documents',
    actor,
    event: 'Line-item percentages applied',
    object: document.renamedName ?? document.displayName,
    result: 'ok',
    clientId: document.clientId,
    verificationId: document.verificationId,
    documentId: document.id,
    docupipeDocumentId: document.docupipeDocumentId,
    detail: `${appliedCount} of ${totalRows} rows`,
  }
}

export const saveLineItemPercents = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      verificationId: string
      documentId: string
      percents: Array<LineItemPercentEdit>
    }) => data,
  )
  .handler(async ({ data }): Promise<SaveLineItemPercentsResult> => {
    const store = getStore()
    const snapshot = await store.getSnapshot(data.verificationId)
    const doc = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!doc) {
      return { ok: false, appliedCount: 0, snapshot, error: 'unknown document' }
    }
    const user = await assertClientAccess(doc.clientId)

    const existing = doc.extractedFields?.lineItems ?? []
    if (existing.length === 0) {
      return {
        ok: false,
        appliedCount: 0,
        snapshot,
        error: 'no line items on this document',
      }
    }

    const { items, appliedCount } = applyLineItemPercents(
      existing,
      data.percents,
    )
    const persisted = await store.upsertDocument({
      ...doc,
      updatedAt: new Date().toISOString(),
      extractedFields: {
        ...doc.extractedFields,
        lineItems: items,
      },
    })

    try {
      await store.appendAuditEvent(
        percentsAuditEvent({
          actor: user.name,
          document: persisted,
          appliedCount,
          totalRows: existing.length,
        }),
      )
    } catch (err) {
      console.warn('[line-item percents] audit write failed', err)
    }

    return {
      ok: true,
      appliedCount,
      snapshot: await store.getSnapshot(data.verificationId),
    }
  })
