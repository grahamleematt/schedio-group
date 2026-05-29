import {
  ClipboardList,
  FileBadge,
  FileSignature,
  FileText,
  Files,
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
  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="ops-label m-0">Document inventory</h2>
        <p className="text-xs text-text-muted">Counts by document category.</p>
      </header>
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
    </section>
  )
}
