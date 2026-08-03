/**
 * Compact per-document row shared by the processing list and the upload
 * page's live section. One line per document — standardized filing name
 * (original kept beneath for audit), type · vendor, duplicate/confidence
 * flags, custody state, amount, and lifecycle status. The whole row links
 * to the document detail route, which owns the deep extraction record and
 * the review actions.
 */

import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { docTypeLabels, formatCurrencyPrecise } from '#/lib/sg-dream'
import type { Document } from '#/lib/sg-dream'

function statusPill(status: Document['status']) {
  switch (status) {
    case 'completed':
      return { label: 'Completed', cls: 'pill pill-green' }
    case 'standardizing':
      return { label: 'Extracting', cls: 'pill pill-brand' }
    case 'classifying':
      return { label: 'Classifying', cls: 'pill pill-brand' }
    case 'error':
      return { label: 'Needs review', cls: 'pill pill-red' }
    default:
      return { label: 'Queued', cls: 'pill pill-gray' }
  }
}

function filedStatusPill(custody: Document['custodyState']) {
  switch (custody) {
    case 'classified':
    case 'relied':
    case 'locked':
      return { label: 'Filed', cls: 'pill pill-green' }
    case 'ready':
      return { label: 'Ready to file', cls: 'pill pill-brand' }
    case 'processing':
      return { label: 'Filing', cls: 'pill pill-amber' }
    case 'incoming':
      return { label: 'Received', cls: 'pill pill-brand' }
    default:
      return { label: 'Pending', cls: 'pill pill-gray' }
  }
}

export function DocumentRow({
  doc,
  clientId,
  verificationId,
}: {
  doc: Document
  clientId: string
  verificationId: string
}) {
  const status = statusPill(doc.status)
  const filed = filedStatusPill(doc.custodyState)
  const dupClass =
    doc.duplicateFlag === 'exact'
      ? 'pill-red'
      : doc.duplicateFlag === 'likely'
        ? 'pill-amber'
        : null
  const hasStandardizedName = doc.renamedName !== doc.originalName
  const displayName = hasStandardizedName ? doc.renamedName : doc.originalName
  const typeAndVendor = [docTypeLabels[doc.docType], doc.vendorName]
    .filter(Boolean)
    .join(' · ')
  const sourceLabel =
    doc.sourceKind === 'egnyte_import' ? 'Imported from Egnyte' : 'Uploaded'

  return (
    <Link
      to="/document"
      search={{ client: clientId, verification: verificationId, doc: doc.id }}
      className="queue-row queue-row-link unstyled-link"
      aria-label={`Review ${displayName}`}
    >
      <span className="doc-ico" aria-hidden />
      <div className="qmeta min-w-0">
        <p className="qtitle truncate">{displayName}</p>
        <div className="qdetail">
          {hasStandardizedName ? (
            <span className="truncate">Uploaded as {doc.originalName}</span>
          ) : (
            <span>{sourceLabel}</span>
          )}
          {typeAndVendor ? <span>{typeAndVendor}</span> : null}
          {dupClass ? (
            <span className={`pill ${dupClass}`}>
              {doc.duplicateFlag === 'exact' ? 'Exact match' : 'Likely match'}
            </span>
          ) : null}
          {doc.lowConfidence ? (
            <span className="pill pill-amber">Low confidence</span>
          ) : null}
          <span className={filed.cls}>
            <span className="dot" />
            {filed.label}
          </span>
        </div>
        {doc.errorMessage ? (
          <p className="qerror truncate">{doc.errorMessage}</p>
        ) : null}
      </div>
      <span className="queue-amount mono">
        {doc.amount > 0 ? formatCurrencyPrecise(doc.amount) : '—'}
      </span>
      <span className={status.cls}>
        <span className="dot" />
        {status.label}
      </span>
      <ChevronRight className="qchev size-4" aria-hidden />
    </Link>
  )
}
