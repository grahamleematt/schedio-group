import { Check, AlertTriangle } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '#/lib/utils'

type ProcessingStep = {
  id: string
  label: string
  detail?: string
}

const steps: ReadonlyArray<ProcessingStep> = [
  {
    id: 'receive',
    label: 'Receiving files',
    detail: 'Secure upload handoff, content-type check.',
  },
  {
    id: 'rename',
    label: 'Applying naming convention',
    detail: 'SG-[CLIENT]-V###-[DOCTYPE]-[VENDOR]-[YEAR]-[SEQ].',
  },
  {
    id: 'classify',
    label: 'Classifying document types',
    detail: 'Contracts, pay apps, invoices, proofs, drawings.',
  },
  {
    id: 'extract',
    label: 'Extracting vendor and cost details',
    detail: 'Amount, vendor code, reference links.',
  },
  {
    id: 'dupes',
    label: 'Checking against previously submitted documents',
    detail: 'Byte match, then near-match heuristic.',
  },
  {
    id: 'package',
    label: 'Assembling submission package',
    detail: 'Generating reference number and notifying Schedio.',
  },
]

type ProcessingLogProps = {
  duplicateCount: number
}

export function ProcessingLog({ duplicateCount }: ProcessingLogProps) {
  return (
    <ol
      className="divide-y overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      {steps.map((step, idx) => {
        const isDupeStep = step.id === 'dupes'
        const isAmber = isDupeStep && duplicateCount > 0

        return (
          <li
            key={step.id}
            className="processing-step flex items-start gap-4 px-5 py-4"
            style={{ ['--step' as string]: String(idx) } as CSSProperties}
          >
            <span
              aria-hidden
              className={cn(
                'processing-step-check inline-flex size-8 items-center justify-center rounded-full text-white',
              )}
              style={{
                background: isAmber
                  ? 'var(--color-flag-summary-bg)'
                  : 'var(--wf-base)',
              }}
            >
              {isAmber ? (
                <AlertTriangle className="size-4" />
              ) : (
                <Check className="size-4" />
              )}
            </span>

            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="font-ops text-sm font-semibold text-text-strong">
                {step.label}
              </p>
              {step.detail ? (
                <p className="text-xs text-text-muted">{step.detail}</p>
              ) : null}
            </div>

            <span
              className={cn(
                'processing-step-status font-mono text-[0.72rem] font-semibold uppercase tracking-[0.08em]',
              )}
              style={{
                color: isAmber
                  ? 'var(--color-flag-likely-text)'
                  : 'var(--wf-strong)',
              }}
            >
              {isAmber ? `${duplicateCount} flagged` : 'Complete'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
