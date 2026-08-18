/**
 * Persist reviewer-applied approval percentages onto extracted line items.
 *
 * `extracted_fields` is jsonb / full-JSON across store backends, so percentages
 * land on `ExtractedLineItem.appliedPercent` without a schema migration.
 */

import { randomUUID } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'

import { assertInternalClientAccess, resolvePortalUser } from '#/server/authz'
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
  skippedCount: number
  snapshot: DreamSnapshot | null
  error?: string
}

export type LineItemPercentEdit = {
  index: number
  percent: number | null
  /** Optional row identity — when present, must match the target row. */
  itemNumber?: string
  description?: string
}

function isValidPercentInput(percent: number | null): boolean {
  return percent === null || Number.isFinite(percent)
}

/** Clamp a finite reviewer percent into the inclusive 0–100 range. */
export function clampAppliedPercent(percent: number): number {
  return Math.min(100, Math.max(0, percent))
}

function editMatchesRow(
  edit: LineItemPercentEdit,
  row: ExtractedLineItem,
): boolean {
  if (
    edit.itemNumber !== undefined &&
    row.itemNumber !== undefined &&
    edit.itemNumber !== row.itemNumber
  ) {
    return false
  }
  if (edit.description !== undefined && row.description !== undefined) {
    if (
      edit.description.trim().toLowerCase() !==
      row.description.trim().toLowerCase()
    ) {
      return false
    }
  }
  return true
}

/**
 * Apply percent edits onto a line-item array by index. Out-of-range indices
 * are ignored; identity mismatches are skipped; `null` clears `appliedPercent`.
 */
export function applyLineItemPercents(
  lineItems: ReadonlyArray<ExtractedLineItem>,
  percents: ReadonlyArray<LineItemPercentEdit>,
): {
  items: Array<ExtractedLineItem>
  appliedCount: number
  skippedCount: number
} {
  const items = lineItems.map((item) => ({ ...item }))
  let appliedCount = 0
  let skippedCount = 0
  for (const edit of percents) {
    if (
      !Number.isInteger(edit.index) ||
      edit.index < 0 ||
      edit.index >= items.length
    ) {
      continue
    }
    if (!editMatchesRow(edit, items[edit.index])) {
      skippedCount += 1
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
  return { items, appliedCount, skippedCount }
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
    await resolvePortalUser()
    const store = getStore()
    const snapshot = await store.getSnapshot(data.verificationId)
    const doc = snapshot?.verification.documents.find(
      (d) => d.id === data.documentId,
    )
    if (!doc) {
      return {
        ok: false,
        appliedCount: 0,
        skippedCount: 0,
        snapshot: null,
        error: 'unknown document',
      }
    }
    const user = await assertInternalClientAccess(doc.clientId)

    if (data.percents.some((edit) => !isValidPercentInput(edit.percent))) {
      return {
        ok: false,
        appliedCount: 0,
        skippedCount: 0,
        snapshot,
        error: 'invalid percent value',
      }
    }

    const existing = doc.extractedFields?.lineItems ?? []
    if (existing.length === 0) {
      return {
        ok: false,
        appliedCount: 0,
        skippedCount: 0,
        snapshot,
        error: 'no line items on this document',
      }
    }

    const { items, appliedCount, skippedCount } = applyLineItemPercents(
      existing,
      data.percents,
    )
    const persisted = await store.patchDocument(doc.id, {
      updatedAt: new Date().toISOString(),
      extractedFields: {
        ...doc.extractedFields,
        lineItems: items,
      },
    })
    if (!persisted) {
      return {
        ok: false,
        appliedCount: 0,
        skippedCount: 0,
        snapshot,
        error: 'document no longer exists',
      }
    }

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
      skippedCount,
      snapshot: await store.getSnapshot(data.verificationId),
    }
  })
