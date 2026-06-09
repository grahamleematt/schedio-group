/**
 * Shared DocuPipe extraction detail block, rendered identically on the
 * processing/analyze view and in the document library so the two surfaces
 * never drift. Surfaces the high-value extracted fields (document number,
 * dates, billing period, contract reference), the AIA G702 pay-application
 * waterfall with a Current-Payment-Due math check, the specific fields that
 * scored low-confidence, and a link to DocuPipe's Visual Review overlay.
 *
 * The header chrome (filing name, vendor, status/duplicate pills, amount)
 * stays per-surface; this component owns only the detail beneath it.
 */

import { Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  formatCurrencyPrecise,
  formatDocDate,
  lowConfidenceFields,
  payAppWaterfall,
  validatePayApp,
} from '#/lib/sg-dream'
import type { Document, PayAppCheck } from '#/lib/sg-dream'
import { verificationSnapshotQuery } from '#/lib/queries'
import { generateVisualReview } from '#/server/fns/visualReview'
import type { DreamSnapshot } from '#/server/store'

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

export function ExtractedDetail({
  doc,
  verificationId,
}: {
  doc: Document
  /**
   * When provided, a completed document without a review can mint one on
   * demand (the "Generate review overlay" button). Drives the snapshot cache
   * update for this verification after generation.
   */
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

  const queryClient = useQueryClient()
  const genMut = useMutation({
    mutationFn: () =>
      generateVisualReview({
        data: { verificationId: verificationId as string, documentId: doc.id },
      }),
    onSuccess: (next: DreamSnapshot | null) => {
      if (verificationId) {
        queryClient.setQueryData(
          verificationSnapshotQuery(verificationId).queryKey,
          next,
        )
      }
    },
  })
  const canGenerate =
    Boolean(verificationId) &&
    !doc.docupipeReviewId &&
    doc.status === 'completed'
  // A no-op success (no standardization to base a review on) leaves the row
  // without a review ID — surface that rather than spinning forever.
  const generateUnavailable = genMut.isSuccess && !doc.docupipeReviewId

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

      {doc.docupipeReviewId ? (
        <a
          href={`/api/docupipe/review-url?review=${encodeURIComponent(
            doc.docupipeReviewId,
          )}`}
          target="_blank"
          rel="noreferrer"
          className="qlink"
        >
          View extraction overlay
        </a>
      ) : canGenerate ? (
        <span className="qgen">
          <button
            type="button"
            className="qlink"
            disabled={genMut.isPending}
            onClick={() => genMut.mutate()}
          >
            {genMut.isPending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden />
            ) : null}
            {genMut.isPending
              ? 'Generating overlay…'
              : 'Generate review overlay'}
          </button>
          {generateUnavailable ? (
            <span className="qgen-note">
              No standardization on file — overlay can’t be generated.
            </span>
          ) : genMut.isError ? (
            <span className="qgen-note">Couldn’t generate — try again.</span>
          ) : null}
        </span>
      ) : null}
    </>
  )
}
