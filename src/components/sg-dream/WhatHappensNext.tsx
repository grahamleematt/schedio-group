import { Check, Hourglass, Sparkles } from 'lucide-react'
import type { Workflow } from '#/lib/sg-dream'

type WhatHappensNextProps = {
  workflow: Workflow
  hasSubmission?: boolean
}

type Step = {
  label: string
  eta: string
  detail: string
  tone: 'complete' | 'current' | 'upcoming'
}

const byWorkflow: Record<Workflow, ReadonlyArray<Step>> = {
  district_dp: [
    {
      label: 'Submission received',
      eta: 'Just now',
      detail:
        'Schedio Group confirms receipt and records the reference number in the audit trail.',
      tone: 'complete',
    },
    {
      label: 'Pay app & invoice review',
      eta: '1–3 business days',
      detail:
        'A Schedio Project Manager reviews each pay app and invoice, verifies the amount, and clears any duplicate flags.',
      tone: 'current',
    },
    {
      label: 'Direct payment released',
      eta: '5–7 business days after approval',
      detail:
        'Once all items clear, Schedio Group releases payment directly to vendors and marks the submission closed.',
      tone: 'upcoming',
    },
  ],
  developer_reimb: [
    {
      label: 'Submission received',
      eta: 'Just now',
      detail:
        'Schedio Group confirms receipt and records the reference number in the audit trail.',
      tone: 'complete',
    },
    {
      label: 'Public cost review',
      eta: '3–7 business days',
      detail:
        'Schedio Group verifies costs against contracts and task orders and issues an Engineer\u2019s Report.',
      tone: 'current',
    },
    {
      label: 'District reimbursement request',
      eta: 'After Engineer\u2019s Report',
      detail:
        'Schedio Group forwards the approved amount to the district for reimbursement processing.',
      tone: 'upcoming',
    },
  ],
}

const starterSteps: ReadonlyArray<Step> = [
  {
    label: 'Start submission',
    eta: 'Next step',
    detail:
      'Upload files or import from Egnyte to create the draft submission package.',
    tone: 'current',
  },
  {
    label: 'Document checks',
    eta: 'After upload',
    detail:
      'DocuPipe classifies documents, extracts cost fields, and checks for duplicate filings.',
    tone: 'upcoming',
  },
  {
    label: 'Schedio review',
    eta: 'After acceptance',
    detail:
      'Schedio assigns the public reference, reviews the package, and posts verified amounts.',
    tone: 'upcoming',
  },
]

export function WhatHappensNext({
  workflow,
  hasSubmission = true,
}: WhatHappensNextProps) {
  const steps = hasSubmission ? byWorkflow[workflow] : starterSteps

  return (
    <section
      className="brand-panel overflow-hidden rounded-2xl px-5 py-5"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <header>
        <p className="ops-label m-0">What happens next</p>
        <h2 className="font-ops text-base font-semibold text-text-strong">
          Three-step review timeline
        </h2>
      </header>

      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {steps.map((s) => {
          const isComplete = s.tone === 'complete'
          const isCurrent = s.tone === 'current'
          return (
            <li
              key={s.label}
              className="flex flex-col gap-2 rounded-2xl border px-4 py-4"
              style={{
                borderColor: isCurrent
                  ? 'var(--wf-border)'
                  : 'var(--color-border-base)',
                background: isCurrent
                  ? 'var(--wf-softer)'
                  : 'var(--color-surface-panel)',
              }}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-flex size-7 items-center justify-center rounded-full"
                  style={{
                    background: isComplete
                      ? 'var(--wf-base)'
                      : isCurrent
                        ? 'var(--wf-soft)'
                        : 'var(--color-surface-muted)',
                    color: isComplete
                      ? 'var(--color-brand-white)'
                      : 'var(--wf-strong)',
                  }}
                >
                  {isComplete ? (
                    <Check className="size-3.5" />
                  ) : isCurrent ? (
                    <Hourglass className="size-3.5" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                </span>
                <p className="font-ops text-sm font-semibold text-text-strong">
                  {s.label}
                </p>
              </div>
              <p className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-text-muted">
                {s.eta}
              </p>
              <p className="text-sm leading-5 text-text-base">{s.detail}</p>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
