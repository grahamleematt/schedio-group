/**
 * The three-step intake story — Upload → Review → File — rendered as one
 * continuous progress arc. Replaces the orphaned "STEP 3 / STEP 4"
 * micro-labels and the scattered "View processing →" / "View confirmation →"
 * jump links: navigation between intake surfaces happens here.
 */

import { Link } from '@tanstack/react-router'
import { Check } from 'lucide-react'

type ArcStepId = 'upload' | 'review' | 'file'

type ArcStep = {
  id: ArcStepId
  label: string
  to: '/upload' | '/processing' | '/confirmation'
}

const STEPS: ReadonlyArray<ArcStep> = [
  { id: 'upload', label: 'Upload', to: '/upload' },
  { id: 'review', label: 'Review', to: '/processing' },
  { id: 'file', label: 'File', to: '/confirmation' },
]

export function IntakeProgressArc({
  current,
  clientId,
  verificationId,
  /** Steps the user can navigate to right now (current is always shown). */
  enabled,
}: {
  current: ArcStepId
  clientId: string
  verificationId: string
  enabled: ReadonlyArray<ArcStepId>
}) {
  const currentIndex = STEPS.findIndex((s) => s.id === current)
  return (
    <nav className="intake-arc" aria-label="Submission progress">
      {STEPS.map((step, index) => {
        const isCurrent = step.id === current
        const isDone = index < currentIndex
        const isEnabled = enabled.includes(step.id) && !isCurrent
        const cls = `intake-arc-step${isCurrent ? ' current' : ''}${isDone ? ' done' : ''}${!isEnabled && !isCurrent ? ' locked' : ''}`
        const inner = (
          <>
            <span className="intake-arc-dot" aria-hidden>
              {isDone ? <Check className="size-3" /> : index + 1}
            </span>
            {step.label}
          </>
        )
        return (
          <span key={step.id} className="intake-arc-item">
            {isEnabled ? (
              <Link
                to={step.to}
                search={{ client: clientId, verification: verificationId }}
                className={`${cls} unstyled-link`}
              >
                {inner}
              </Link>
            ) : (
              <span className={cls} aria-current={isCurrent ? 'step' : undefined}>
                {inner}
              </span>
            )}
            {index < STEPS.length - 1 ? (
              <span className="intake-arc-sep" aria-hidden>
                ›
              </span>
            ) : null}
          </span>
        )
      })}
    </nav>
  )
}
