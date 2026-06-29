/**
 * WorkflowBanner — the always-on workflow announcement the brand system calls
 * for on the ceremonial intake screens (verifications, upload, processing,
 * confirmation). It reads the per-workflow copy from `workflowConfigs` and
 * renders with the generic `--wf-*` tokens, so the same markup themes green
 * (District Direct Pay) or blue (Developer Reimbursement) automatically.
 *
 * Purely presentational.
 */

import { workflowConfigs } from '#/lib/sg-dream'
import type { Workflow } from '#/lib/sg-dream'

export function WorkflowBanner({ workflow }: { workflow: Workflow }) {
  const config = workflowConfigs[workflow]
  return (
    <div className="workflow-banner mb-4">
      <span className="workflow-pill">{config.shortLabel}</span>
      <div className="min-w-0">
        <p className="workflow-banner-title m-0">{config.label}</p>
        <p className="workflow-banner-subtitle m-0">{config.bannerCopy}</p>
      </div>
    </div>
  )
}
