import type { ClientPackageDetail } from './scenario-data'

export type WorkflowPhase =
  | 'upload'
  | 'processing'
  | 'drafting'
  | 'approval'
  | 'available'

export type WorkflowStage = 'drafting' | 'approval'

export type WorkflowStageConfig = {
  stage: WorkflowStage
  label: string
  intent: string
  activePhase: WorkflowPhase
  previousPhase: WorkflowPhase
  nextPhase: WorkflowPhase
}

export type PackageStageSummary = {
  currentLabel: string
  note: string
  nextLabel?: string
}

export const workflowPhases: Array<{
  id: WorkflowPhase
  label: string
}> = [
  { id: 'upload', label: 'Upload' },
  { id: 'processing', label: 'Processing' },
  { id: 'drafting', label: 'Drafting' },
  { id: 'approval', label: 'Approval' },
  { id: 'available', label: 'Available' },
]

export const workflowStageConfigs: Record<WorkflowStage, WorkflowStageConfig> = {
  drafting: {
    stage: 'drafting',
    label: 'Drafting stage active',
    intent: 'Build the draft packet from the source record, linked evidence, and field confirmation.',
    activePhase: 'drafting',
    previousPhase: 'processing',
    nextPhase: 'approval',
  },
  approval: {
    stage: 'approval',
    label: 'Approval stage active',
    intent: 'Review the prepared packet, confirm governance checks, and decide the authority transition.',
    activePhase: 'approval',
    previousPhase: 'drafting',
    nextPhase: 'available',
  },
}

export function getWorkflowStageConfig(stage: WorkflowStage) {
  return workflowStageConfigs[stage]
}

export function getPackageStageSummary(
  packageDetail: ClientPackageDetail,
): PackageStageSummary {
  if (packageDetail.readOnly || packageDetail.status === 'Available') {
    return {
      currentLabel: 'Available',
      note: 'Organized records are visible in the package inventory.',
    }
  }

  if (packageDetail.status === 'Processing') {
    return {
      currentLabel: 'Still processing',
      nextLabel: 'Next: review',
      note: 'Files are still being renamed, linked, and prepared before they become available.',
    }
  }

  return {
    currentLabel: 'Ready for review',
    nextLabel: 'Next: final review',
    note: 'Records are organized and moving through review before they become available.',
  }
}
