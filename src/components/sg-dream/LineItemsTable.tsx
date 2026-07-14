/**
 * Collapsible INV/PA line-item table with reviewer-applied approval %.
 *
 * Collapsed by default so the detail card stays compact; expands into a
 * scrollable table with live approved-amount math and a dirty-gated save.
 */

import { useState } from 'react'
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCurrencyPrecise } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { saveLineItemPercents } from '#/server/fns/lineItemPercents'
import type { SaveLineItemPercentsResult } from '#/server/fns/lineItemPercents'
import type { ExtractedLineItem } from '#/server/store'

function draftsFromItems(
  items: ReadonlyArray<ExtractedLineItem>,
): Record<number, string> {
  const drafts: Record<number, string> = {}
  items.forEach((item, index) => {
    if (typeof item.appliedPercent === 'number') {
      drafts[index] = String(item.appliedPercent)
    }
  })
  return drafts
}

function parseDraftPercent(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return n
}

function rowBaseAmount(
  item: ExtractedLineItem,
  docType: 'INV' | 'PA',
): number | undefined {
  return docType === 'PA' ? item.scheduledValue : item.amount
}

function approvedAmount(
  item: ExtractedLineItem,
  docType: 'INV' | 'PA',
  draft: string | undefined,
): number | undefined {
  const pct = parseDraftPercent(draft)
  if (pct === null) return undefined
  const base = rowBaseAmount(item, docType)
  if (typeof base !== 'number') return undefined
  const clamped = Math.min(100, Math.max(0, pct))
  return (clamped / 100) * base
}

function isDirty(
  items: ReadonlyArray<ExtractedLineItem>,
  drafts: Record<number, string>,
): boolean {
  for (let i = 0; i < items.length; i += 1) {
    const applied = items[i].appliedPercent
    const saved = typeof applied === 'number' ? String(applied) : ''
    const draft = drafts[i] ?? ''
    if (draft !== saved) return true
  }
  for (const key of Object.keys(drafts)) {
    const index = Number(key)
    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      if ((drafts[index] ?? '').trim() !== '') return true
    }
  }
  return false
}

function countSavedPercents(items: ReadonlyArray<ExtractedLineItem>): number {
  return items.reduce(
    (n, item) => (typeof item.appliedPercent === 'number' ? n + 1 : n),
    0,
  )
}

function sumBase(
  items: ReadonlyArray<ExtractedLineItem>,
  docType: 'INV' | 'PA',
): number {
  return items.reduce((sum, item) => {
    const base = rowBaseAmount(item, docType)
    return typeof base === 'number' ? sum + base : sum
  }, 0)
}

/** Draft-backed body — remounts when saved applied-% values change. */
function LineItemsTableBody({
  doc,
  verificationId,
  lineItems,
}: {
  doc: Document
  verificationId: string
  lineItems: ReadonlyArray<ExtractedLineItem>
}) {
  const docType = doc.docType as 'INV' | 'PA'
  const [drafts, setDrafts] = useState(() => draftsFromItems(lineItems))

  const queryClient = useQueryClient()
  const saveMut = useMutation({
    mutationFn: () => {
      const percents = lineItems.map((_, index) => ({
        index,
        percent: parseDraftPercent(drafts[index]),
      }))
      const dirty = percents.filter(({ index, percent }) => {
        const saved = lineItems[index]?.appliedPercent
        if (percent === null) return typeof saved === 'number'
        return saved !== percent
      })
      return saveLineItemPercents({
        data: {
          verificationId,
          documentId: doc.id,
          percents: dirty,
        },
      })
    },
    onSuccess: (result: SaveLineItemPercentsResult) => {
      if (result.snapshot) {
        queryClient.setQueryData(
          verificationSnapshotQuery(verificationId).queryKey,
          result.snapshot,
        )
      }
      if (result.ok) {
        const nextItems =
          result.snapshot?.verification.documents.find((d) => d.id === doc.id)
            ?.extractedFields?.lineItems ?? lineItems
        setDrafts(draftsFromItems(nextItems))
      }
    },
  })

  const billedOrScheduled = sumBase(lineItems, docType)
  const totalApproved = lineItems.reduce((sum, item, index) => {
    const amt = approvedAmount(item, docType, drafts[index])
    return typeof amt === 'number' ? sum + amt : sum
  }, 0)
  const dirty = isDirty(lineItems, drafts)
  const totalLabel = docType === 'PA' ? 'Scheduled' : 'Billed'
  const saveFailed =
    saveMut.isError || (saveMut.isSuccess && !saveMut.data.ok)
  const saveOk = saveMut.isSuccess && saveMut.data.ok && !dirty

  return (
    <>
      <div className="line-items-scroll v2-table-scroll">
        <table className="v2-tbl line-items-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Description</th>
              {docType === 'PA' ? (
                <>
                  <th scope="col" className="num">
                    Scheduled value
                  </th>
                  <th scope="col" className="num">
                    % complete
                  </th>
                </>
              ) : (
                <>
                  <th scope="col">Task order</th>
                  <th scope="col" className="num">
                    Amount
                  </th>
                </>
              )}
              <th scope="col" className="num">
                Applied %
              </th>
              <th scope="col" className="num">
                Approved amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              const draft = drafts[index] ?? ''
              const approved = approvedAmount(item, docType, draft)
              return (
                <tr key={`${item.itemNumber ?? 'row'}-${index}`}>
                  <td className="mono line-items-num">
                    {item.itemNumber ?? String(index + 1)}
                  </td>
                  <td className="line-items-desc">
                    {item.description ?? '—'}
                  </td>
                  {docType === 'PA' ? (
                    <>
                      <td className="num">
                        {typeof item.scheduledValue === 'number'
                          ? formatCurrencyPrecise(item.scheduledValue)
                          : '—'}
                      </td>
                      <td className="num">
                        {typeof item.percentComplete === 'number'
                          ? `${item.percentComplete}`
                          : '—'}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="mono">
                        {item.taskOrderReference ?? '—'}
                      </td>
                      <td className="num">
                        {typeof item.amount === 'number'
                          ? formatCurrencyPrecise(item.amount)
                          : '—'}
                      </td>
                    </>
                  )}
                  <td className="num">
                    <input
                      type="number"
                      className="line-items-pct-input"
                      min={0}
                      max={100}
                      step={1}
                      inputMode="decimal"
                      aria-label={`Applied percent for row ${item.itemNumber ?? index + 1}`}
                      value={draft}
                      onChange={(e) => {
                        const next = e.target.value
                        setDrafts((prev) => {
                          const copy = { ...prev }
                          if (next === '') {
                            delete copy[index]
                          } else {
                            copy[index] = next
                          }
                          return copy
                        })
                      }}
                    />
                  </td>
                  <td className="num">
                    {typeof approved === 'number'
                      ? formatCurrencyPrecise(approved)
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="line-items-footer">
        <span className="line-items-footer-totals mono">
          Approved {formatCurrencyPrecise(totalApproved)}
          <span aria-hidden>·</span>
          {totalLabel} {formatCurrencyPrecise(billedOrScheduled)}
        </span>
        <div className="line-items-actions">
          <span className="invite-note" role="status">
            {saveFailed ? (
              <span className="invite-note-error">
                {(saveMut.data && !saveMut.data.ok && saveMut.data.error) ||
                  'Couldn’t save percentages — try again.'}
              </span>
            ) : saveOk ? (
              <>
                <CheckCircle2
                  className="size-3.5 shrink-0"
                  style={{ color: 'var(--color-green-base)' }}
                  aria-hidden
                />
                Percentages saved
              </>
            ) : dirty ? (
              'Unsaved changes'
            ) : (
              ' '
            )}
          </span>
          <button
            type="button"
            className="v2-btn primary"
            disabled={!dirty || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : null}
            {saveMut.isPending ? 'Saving…' : 'Save percentages'}
          </button>
        </div>
      </div>
    </>
  )
}

/**
 * Render only for INV/PA docs with a non-empty `lineItems` array. Expansion
 * state lives outside the body so toggles survive saves; drafts seed from
 * props via useState initializer and reset in the save mutation onSuccess.
 */
export function LineItemsTable({
  doc,
  verificationId,
}: {
  doc: Document
  verificationId?: string
}) {
  const lineItems = doc.extractedFields?.lineItems
  const [expanded, setExpanded] = useState(false)

  if (
    !verificationId ||
    !lineItems ||
    lineItems.length === 0 ||
    (doc.docType !== 'INV' && doc.docType !== 'PA')
  ) {
    return null
  }

  const docType = doc.docType
  const rowCount = lineItems.length
  const withPercent = countSavedPercents(lineItems)
  const billedOrScheduled = sumBase(lineItems, docType)
  const totalLabel = docType === 'PA' ? 'Scheduled' : 'Billed'

  return (
    <div className="line-items">
      <div className="line-items-head">
        <div className="line-items-summary">
          <span className="qk">
            Line items · {rowCount.toLocaleString()} row
            {rowCount === 1 ? '' : 's'}
          </span>
          <span className="line-items-meta mono">
            {totalLabel} {formatCurrencyPrecise(billedOrScheduled)}
            <span aria-hidden>·</span>
            {withPercent.toLocaleString()} with applied %
          </span>
        </div>
        <button
          type="button"
          className="line-items-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <ChevronDown className="size-3.5" aria-hidden />
          ) : (
            <ChevronRight className="size-3.5" aria-hidden />
          )}
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded ? (
        <LineItemsTableBody
          key={doc.id}
          doc={doc}
          verificationId={verificationId}
          lineItems={lineItems}
        />
      ) : null}
    </div>
  )
}
