import {
  ClipboardList,
  FileBadge,
  FileSignature,
  FileText,
  Files,
  Inbox,
  Landmark,
  Layers,
  Receipt,
} from 'lucide-react'
import type { DocType, DocTypeSummary } from '#/lib/sg-dream'
import { cn } from '#/lib/utils'

const icons: Record<DocType, typeof FileText> = {
  CTR: FileSignature,
  TO: ClipboardList,
  CO: Layers,
  PA: FileBadge,
  INV: Receipt,
  POP: FileText,
  LSP: Landmark,
  CD: Files,
  UNK: Files,
}

type DocumentInventoryTilesProps = {
  summaries: ReadonlyArray<DocTypeSummary>
}

export function DocumentInventoryTiles({
  summaries,
}: DocumentInventoryTilesProps) {
  const totalDocs = summaries.reduce((sum, s) => sum + s.count, 0)

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="ops-label m-0">Document inventory</h2>
        <p className="text-xs text-text-muted">Counts by document category.</p>
      </header>
      {totalDocs === 0 ? (
        <div
          className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center"
          style={{
            borderColor: 'var(--color-border-strong)',
            background: 'var(--color-surface-subtle)',
          }}
        >
          <span
            aria-hidden
            className="inline-flex size-10 items-center justify-center rounded-xl"
            style={{ background: 'var(--wf-soft)', color: 'var(--wf-strong)' }}
          >
            <Inbox className="size-5" />
          </span>
          <p className="m-0 font-ops text-sm font-semibold text-text-strong">
            No documents yet
          </p>
          <p className="m-0 max-w-sm text-xs text-text-muted">
            Upload pay apps, invoices, and supporting files to build this
            submission’s inventory. Each category fills in as DocuPipe
            classifies your files.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaries.map((s) => {
            const Icon = icons[s.docType]
            const isActive = s.count > 0
            const hasFlag = s.flaggedCount > 0
            return (
              <div
                key={s.docType}
                className={cn(
                  'relative flex flex-col gap-2 rounded-2xl border px-4 py-4 transition-colors',
                  isActive
                    ? 'bg-white'
                    : 'bg-[color:var(--color-surface-muted)] text-text-muted',
                )}
                style={{
                  borderColor: isActive
                    ? 'var(--wf-border)'
                    : 'var(--color-border-base)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex size-9 items-center justify-center rounded-xl"
                    style={{
                      background: isActive
                        ? 'var(--wf-soft)'
                        : 'var(--color-surface-panel)',
                      color: isActive
                        ? 'var(--wf-strong)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    <Icon className="size-4" />
                  </span>
                  {hasFlag ? (
                    <span className="flag-pill-likely">
                      {s.flaggedCount} flagged
                    </span>
                  ) : null}
                </div>
                <div>
                  <p
                    className="font-ops text-xl font-semibold"
                    style={{
                      color: isActive
                        ? 'var(--wf-strong)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {s.count}
                  </p>
                  <p className="text-xs font-semibold text-text-strong">
                    {s.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
