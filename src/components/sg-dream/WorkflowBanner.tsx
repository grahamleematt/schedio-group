import type { ReactNode } from 'react'
import { workflowConfigs } from '#/lib/sg-dream'
import type { Workflow } from '#/lib/sg-dream'

type WorkflowBannerProps = {
  workflow: Workflow
  headline?: string
  children?: ReactNode
}

export function WorkflowBanner({
  workflow,
  headline,
  children,
}: WorkflowBannerProps) {
  const config = workflowConfigs[workflow]
  const title = headline ?? `${config.label} workflow`

  return (
    <div className="workflow-banner">
      <span
        aria-hidden
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[0.72rem] font-semibold"
        style={{
          background: 'var(--wf-base)',
          color: 'var(--color-brand-white)',
        }}
      >
        Σ
      </span>
      <div className="flex-1 min-w-0">
        <p className="workflow-banner-title">{title}</p>
        <p className="workflow-banner-subtitle">
          {children ?? config.bannerCopy}
        </p>
      </div>
    </div>
  )
}
