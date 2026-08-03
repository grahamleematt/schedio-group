/**
 * Shared DocuPipe extraction detail block, rendered on the document library
 * so filed rows carry the full extracted record. Surfaces the high-value
 * extracted fields (document number, dates, billing period, contract
 * reference), the AIA G702 pay-application waterfall with a
 * Current-Payment-Due math check, line items, the specific fields that
 * scored low-confidence, and a button to the document review page.
 *
 * `ExtractedRecord` is the presentational core (facts + waterfall + line
 * items + confidence notes) reused by the document detail route. Review
 * actions (generate overlay, re-run extraction, finalize) live in the
 * detail route's header — this surface only navigates there.
 */

import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import {
  formatCurrencyPrecise,
  formatDocDate,
  lowConfidenceFields,
  payAppWaterfall,
  validatePayApp,
} from '#/lib/sg-dream'
import type { Document, PayAppCheck } from '#/lib/sg-dream'
import { LineItemsTable } from '#/components/sg-dream/LineItemsTable'

export function PayAppCheckPill({ check }: { check: PayAppCheck }) {
  if (check.status === 'ok') {
    return (
      <span className="pill pill-green">
        <span className="dot" />
        Math checks out
      </span>
    )
  }
  if (check.status === 'mismatch') {
    return (
      <span className="pill pill-red">
        <span className="dot" />
        Check math
      </span>
    )
  }
  return <span className="pill pill-gray">Waterfall incomplete</span>
}

/**
 * The extracted record for one document: quick facts, the pay-app waterfall
 * with math check, editable line items, and low-confidence notes. Pure
 * display plus the line-item percent editor — no review actions.
 */
export function ExtractedRecord({
  doc,
  verificationId,
}: {
  doc: Document
  verificationId?: string
}) {
  const fields = doc.extractedFields

  const period = (() => {
    const start = formatDocDate(fields?.periodStart)
    const end = formatDocDate(fields?.periodEnd)
    if (!start && !end) return undefined
    return `${start ?? '—'} – ${end ?? '—'}`
  })()
  const facts: ReadonlyArray<{ label: string; value: string }> = [
    { label: 'Doc #', value: fields?.documentNumber },
    { label: 'Dated', value: formatDocDate(fields?.documentDate) },
    { label: 'Period', value: period },
    { label: 'Contract', value: fields?.contractReference },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value))

  const waterfall = doc.docType === 'PA' ? payAppWaterfall(fields) : []
  const payCheck = doc.docType === 'PA' ? validatePayApp(fields) : null

  const lowFields = lowConfidenceFields(doc.fieldConfidence)
  const noScores = Boolean(doc.lowConfidence) && lowFields.length === 0

  return (
    <>
      {facts.length > 0 ? (
        <div className="qfacts">
          {facts.map((f) => (
            <span key={f.label}>
              <span className="qk">{f.label}</span> {f.value}
            </span>
          ))}
        </div>
      ) : null}

      {waterfall.length > 0 || payCheck?.status === 'mismatch' ? (
        <div className="pa-waterfall">
          <div className="pa-waterfall-head">
            <span className="qk">Pay-app waterfall (AIA G702)</span>
            {payCheck ? <PayAppCheckPill check={payCheck} /> : null}
          </div>
          {waterfall.length > 0 ? (
            <dl className="pa-waterfall-grid">
              {waterfall.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd className="mono">{formatCurrencyPrecise(row.value)}</dd>
                </div>
              ))}
              <div className="pa-waterfall-due">
                <dt>Current payment due</dt>
                <dd className="mono">
                  {typeof fields?.amount === 'number'
                    ? formatCurrencyPrecise(fields.amount)
                    : '—'}
                </dd>
              </div>
            </dl>
          ) : null}
          {payCheck?.status === 'mismatch' &&
          typeof payCheck.expected === 'number' ? (
            <p className="pa-waterfall-note">
              Expected {formatCurrencyPrecise(payCheck.expected)} (earned less
              retainage − previous payments) ·{' '}
              {typeof payCheck.delta === 'number'
                ? `off by ${formatCurrencyPrecise(Math.abs(payCheck.delta))}`
                : 'amount disagrees'}
            </p>
          ) : null}
        </div>
      ) : null}

      <LineItemsTable doc={doc} verificationId={verificationId} />

      {lowFields.length > 0 ? (
        <p className="qconf">
          <span className="qk">Low confidence:</span>{' '}
          {lowFields
            .map((f) => `${f.label} (${Math.round(f.score * 100)}%)`)
            .join(', ')}
        </p>
      ) : noScores ? (
        <p className="qconf">
          <span className="qk">Low confidence:</span> DocuPipe returned no
          field-level scores — engineer review required.
        </p>
      ) : null}
    </>
  )
}

export function ExtractedDetail({
  doc,
  verificationId,
}: {
  doc: Document
  /** Target verification for the document review page link. */
  verificationId?: string
}) {
  return (
    <>
      <ExtractedRecord doc={doc} verificationId={verificationId} />

      {doc.clientId ? (
        <Link
          to="/document"
          search={{
            client: doc.clientId,
            verification: verificationId ?? doc.verificationId,
            doc: doc.id,
          }}
          className="v2-btn detail-open-btn"
        >
          Open document review
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </>
  )
}
