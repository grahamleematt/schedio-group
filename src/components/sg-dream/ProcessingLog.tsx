import { Check, AlertTriangle, Loader2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { cn } from '#/lib/utils'
import type { StoredDocument } from '#/server/store'

type StepId = 'receive' | 'rename' | 'classify' | 'extract' | 'dupes' | 'package'
type StepState = 'pending' | 'active' | 'complete' | 'alert' | 'error'

type ProcessingStep = {
  id: StepId
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

function deriveStepState(
  stepId: StepId,
  docs: ReadonlyArray<StoredDocument>,
): StepState {
  if (docs.length === 0) return 'pending'
  const anyError = docs.some((d) => d.status === 'error')
  const allCompleted = docs.every((d) => d.status === 'completed')
  const anyAtLeast = (phases: ReadonlyArray<StoredDocument['status']>) =>
    docs.some((d) => phases.includes(d.status))
  const allAtLeast = (phases: ReadonlyArray<StoredDocument['status']>) =>
    docs.every((d) => phases.includes(d.status))

  switch (stepId) {
    case 'receive':
      return allAtLeast(['queued', 'classifying', 'standardizing', 'completed', 'error'])
        ? 'complete'
        : 'active'
    case 'rename':
      return allCompleted ? 'complete' : 'active'
    case 'classify':
      if (allAtLeast(['standardizing', 'completed'])) return 'complete'
      if (anyAtLeast(['classifying', 'standardizing', 'completed'])) return 'active'
      return 'pending'
    case 'extract':
      if (allCompleted) return 'complete'
      if (anyAtLeast(['standardizing', 'completed'])) return 'active'
      return 'pending'
    case 'dupes': {
      if (!allCompleted) {
        return anyAtLeast(['standardizing', 'completed']) ? 'active' : 'pending'
      }
      const flagged = docs.filter((d) => d.duplicateFlag !== 'none').length
      return flagged > 0 ? 'alert' : 'complete'
    }
    case 'package':
      if (anyError) return 'error'
      if (allCompleted) return 'complete'
      return 'pending'
  }
}

type ProcessingLogProps = {
  docs: ReadonlyArray<StoredDocument>
}

export function ProcessingLog({ docs }: ProcessingLogProps) {
  const duplicateCount = docs.filter(
    (d) => d.duplicateFlag !== 'none' && d.status === 'completed',
  ).length

  return (
    <ol
      className="divide-y overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      {steps.map((step, idx) => {
        const state = deriveStepState(step.id, docs)
        const isAlert = state === 'alert'
        const isError = state === 'error'
        const isActive = state === 'active'
        const isComplete = state === 'complete'
        const background = isError
          ? 'var(--color-flag-exact-bg, var(--color-flag-summary-bg))'
          : isAlert
            ? 'var(--color-flag-summary-bg)'
            : isActive
              ? 'var(--wf-soft)'
              : isComplete
                ? 'var(--wf-base)'
                : 'var(--color-border-base)'
        const textColor = isError
          ? 'var(--color-flag-exact-text, var(--color-flag-likely-text))'
          : isAlert
            ? 'var(--color-flag-likely-text)'
            : isActive
              ? 'var(--wf-strong)'
              : isComplete
                ? 'var(--wf-strong)'
                : 'var(--color-text-muted)'
        const statusLabel =
          step.id === 'dupes' && isAlert
            ? `${duplicateCount} flagged`
            : isError
              ? 'Error'
              : isComplete
                ? 'Complete'
                : isActive
                  ? 'In progress'
                  : 'Waiting'

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
              style={{ background }}
            >
              {isError ? (
                <AlertTriangle className="size-4" />
              ) : isAlert ? (
                <AlertTriangle className="size-4" />
              ) : isActive ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isComplete ? (
                <Check className="size-4" />
              ) : null}
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
              style={{ color: textColor }}
            >
              {statusLabel}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
