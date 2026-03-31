import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'

type ReviewPanelProps = {
  title: string
  description?: string
  actions?: ReactNode
  tone?: 'light' | 'dark'
  className?: string
  contentClassName?: string
  children: ReactNode
}

export function ReviewPanel({
  title,
  description,
  actions,
  tone = 'light',
  className,
  contentClassName,
  children,
}: ReviewPanelProps) {
  const isDark = tone === 'dark'

  return (
    <Card
      className={cn(
        'brand-panel min-w-0 rounded-[1.75rem] shadow-none',
        isDark
          ? 'border-border-strong bg-surface-muted'
          : 'border-border-base bg-surface-panel',
        className,
      )}
    >
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle className={cn('font-heading text-2xl text-text-strong')}>
            {title}
          </CardTitle>
          {description ? (
            <p className={cn('mt-2 text-sm leading-6 text-text-muted')}>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
            {actions}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
