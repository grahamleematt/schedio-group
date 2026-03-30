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
        'min-w-0 rounded-[1.75rem] shadow-none',
        isDark
          ? 'border-[rgba(35,31,32,0.18)] bg-[linear-gradient(180deg,rgba(49,54,61,0.98),rgba(33,38,45,0.98))] text-white shadow-[0_18px_42px_rgba(15,23,42,0.16)]'
          : 'border-[rgba(0,61,166,0.12)] bg-[rgba(255,255,255,0.97)] shadow-[0_14px_34px_rgba(12,33,77,0.08)]',
        className
      )}
    >
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <CardTitle
            className={cn(
              'font-heading text-2xl',
              isDark ? 'text-white' : 'text-[var(--brand-slate)]'
            )}
          >
            {title}
          </CardTitle>
          {description ? (
            <p
              className={cn(
                'mt-2 text-sm leading-6',
                isDark ? 'text-white/72' : 'text-[var(--brand-muted)]'
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">{actions}</div> : null}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  )
}
