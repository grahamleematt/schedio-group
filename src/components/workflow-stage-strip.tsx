import { ArrowRight } from 'lucide-react'
import {
  getWorkflowStageConfig,
  workflowPhases,
} from '#/lib/workflow-stage'
import type { WorkflowPhase, WorkflowStage } from '#/lib/workflow-stage'
import { cn } from '#/lib/utils'

const workflowPhaseLabels = Object.fromEntries(
  workflowPhases.map((phase) => [phase.id, phase.label]),
) as Record<WorkflowPhase, string>

function getPhaseState(
  phase: WorkflowPhase,
  activePhase: WorkflowPhase,
): 'complete' | 'active' | 'upcoming' {
  const phaseIndex = workflowPhases.findIndex((entry) => entry.id === phase)
  const activeIndex = workflowPhases.findIndex(
    (entry) => entry.id === activePhase,
  )

  if (phaseIndex < activeIndex) {
    return 'complete'
  }

  if (phaseIndex === activeIndex) {
    return 'active'
  }

  return 'upcoming'
}

export function WorkflowStageStrip({ stage }: { stage: WorkflowStage }) {
  const config = getWorkflowStageConfig(stage)
  const previousLabel = workflowPhaseLabels[config.previousPhase]
  const activeLabel = workflowPhaseLabels[config.activePhase]
  const nextLabel = workflowPhaseLabels[config.nextPhase]

  return (
    <section
      className={cn(
        'workflow-stage-strip',
        stage === 'drafting'
          ? 'workflow-stage-strip-drafting'
          : 'workflow-stage-strip-approval',
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] xl:items-center">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="ops-label">
              {stage === 'drafting' ? 'Drafting workflow' : 'Approval workflow'}
            </p>
            <div className="space-y-2">
              <h2 className="font-ops text-xl font-semibold tracking-[-0.03em] text-text-strong">
                {config.label}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-text-base">
                {config.intent}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span
              className={cn(
                'workflow-stage-chip',
                stage === 'drafting'
                  ? 'workflow-stage-chip-drafting'
                  : 'workflow-stage-chip-approval',
              )}
            >
              From {previousLabel}
            </span>
            <ArrowRight className="size-3.5 text-text-muted" />
            <span
              className={cn(
                'workflow-stage-chip workflow-stage-chip-current',
                stage === 'drafting'
                  ? 'workflow-stage-chip-drafting'
                  : 'workflow-stage-chip-approval',
              )}
            >
              {activeLabel}
            </span>
            <ArrowRight className="size-3.5 text-text-muted" />
            <span className="workflow-stage-chip">Next {nextLabel}</span>
          </div>
        </div>

        <div className="workflow-phase-strip">
          {workflowPhases.map((phase, index) => {
            const state = getPhaseState(phase.id, config.activePhase)
            const hasNextPhase = index < workflowPhases.length - 1
            const connectorState = hasNextPhase
              ? getPhaseState(workflowPhases[index + 1].id, config.activePhase)
              : 'upcoming'

            return (
              <div key={phase.id} className="workflow-phase-item">
                <div className="workflow-phase-row">
                  <div
                    className="workflow-step-node"
                    data-stage={stage}
                    data-phase-state={state}
                  >
                    {index + 1}
                  </div>
                  {hasNextPhase ? (
                    <div
                      className="workflow-step-line"
                      data-stage={stage}
                      data-phase-state={
                        connectorState === 'upcoming' ? state : connectorState
                      }
                    />
                  ) : null}
                </div>
                <p
                  className="workflow-step-label"
                  data-phase-state={state}
                >
                  {phase.label}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
