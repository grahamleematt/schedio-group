import type { DocumentRecord } from '#/lib/mock-data'
import { StatusBadge } from '#/components/status-badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import {
  getBatchById,
  getClientFacingRecordStatus,
  getDocumentClassLabel,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

type InventorySectionProps = {
  docs: DocumentRecord[]
  submittedAmount: string
  classCounts: Array<{ key: string; label: string; count: number }>
  duplicateCount: number
  supportPendingCount: number
  verificationLabel: string
  formatCurrency: (v: number) => string
  getExceptionLabel: (flag: string) => string
}

export function InventorySection({
  docs,
  submittedAmount,
  classCounts,
  duplicateCount,
  supportPendingCount,
  verificationLabel,
  formatCurrency,
  getExceptionLabel,
}: InventorySectionProps) {
  return (
    <section className="min-w-0 space-y-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="font-ops text-[2rem] font-semibold tracking-[-0.05em] text-text-strong">
          Uploaded inventory
        </h2>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-text-accent">
            {docs.length} uploaded files
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-text-strong">
            Submitted amount {submittedAmount}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {classCounts.map((item) => (
          <span
            key={item.key}
            className="rounded-full border border-border-base bg-surface-muted px-3 py-1 text-xs font-semibold text-text-strong"
          >
            {item.label} {item.count}
          </span>
        ))}
        {duplicateCount > 0 ? (
          <span className="rounded-full border border-status-error-text bg-status-error-bg px-3 py-1 text-xs font-semibold text-status-error-text">
            {duplicateCount} duplicate watch
          </span>
        ) : null}
        {supportPendingCount > 0 ? (
          <span className="rounded-full border border-status-warning-text bg-status-warning-bg px-3 py-1 text-xs font-semibold text-status-warning-text">
            {supportPendingCount} support pending
          </span>
        ) : null}
      </div>

      <div className="data-table-frame overflow-x-auto overflow-y-hidden rounded-2xl border border-border-strong bg-surface-panel">
        <Table className="data-table-min font-ops">
          <TableHeader>
            <TableRow className="bg-surface-muted">
              <TableHead>Original filename</TableHead>
              <TableHead>Renamed inventory</TableHead>
              <TableHead>Proposed class</TableHead>
              <TableHead>Pages</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((document) => (
              <InventoryRow
                key={document.id}
                document={document}
                verificationLabel={verificationLabel}
                formatCurrency={formatCurrency}
                getExceptionLabel={getExceptionLabel}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function InventoryRow({
  document,
  verificationLabel,
  formatCurrency,
  getExceptionLabel,
}: {
  document: DocumentRecord
  verificationLabel: string
  formatCurrency: (v: number) => string
  getExceptionLabel: (flag: string) => string
}) {
  const batch = getBatchById(document.batchId)
  const status = getClientFacingRecordStatus(document)
  const hasDuplicate = document.exceptionFlags.includes('duplicate_file')
  const hasSupportGap = document.exceptionFlags.includes('missing_support')
  const showsAmount =
    document.documentClass === 'invoice' ||
    document.documentClass === 'pay_application'

  return (
    <TableRow
      className={cn(
        hasDuplicate
          ? 'bg-status-error-bg/60'
          : hasSupportGap
            ? 'bg-status-warning-bg/50'
            : undefined,
      )}
    >
      <TableCell>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text-strong">
              {document.originalName}
            </p>
            {hasDuplicate ? (
              <span className="rounded-full bg-status-error-bg px-2.5 py-1 text-[0.68rem] font-semibold text-status-error-text">
                Duplicate match
              </span>
            ) : null}
          </div>
          <p className="font-mono text-[0.72rem] text-text-muted">
            {batch?.channel} • original retained
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-strong">
            {document.organizedName}
          </p>
          <p className="text-xs text-text-muted">
            {document.linkedRecords.length > 0
              ? `${document.linkedRecords.length} linked record${document.linkedRecords.length > 1 ? 's' : ''} visible in the chain`
              : 'No linked records yet'}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-2">
          <span className="inline-flex rounded-full bg-surface-active px-3 py-1 text-xs font-semibold text-text-accent">
            {getDocumentClassLabel(document.documentClass)}
          </span>
          <p className="font-mono text-[0.7rem] text-text-muted">
            Proposed class
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-strong">
            {document.pageCount}
          </p>
          {showsAmount && document.submittedAmount ? (
            <p className="font-mono text-[0.72rem] text-text-muted">
              {formatCurrency(document.submittedAmount)}
            </p>
          ) : (
            <p className="font-mono text-[0.72rem] text-text-muted">
              {showsAmount ? 'No amount parsed yet' : 'Reference record'}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-strong">
            {batch?.submittedAt ?? document.updatedAt}
          </p>
          <p className="font-mono text-[0.72rem] text-text-muted">
            {verificationLabel}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={status} />
          {document.exceptionFlags.length > 0
            ? document.exceptionFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full border border-border-base bg-surface-muted px-3 py-1 text-[0.72rem] font-semibold text-text-strong"
                >
                  {getExceptionLabel(flag)}
                </span>
              ))
            : null}
        </div>
      </TableCell>
    </TableRow>
  )
}
