import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

const statusStyles: Record<string, string> = {
  Received:
    'border-slate-200 bg-slate-100 text-slate-700',
  Classifying:
    'border-amber-200 bg-amber-50 text-amber-800',
  Organizing:
    'border-blue-200 bg-blue-50 text-blue-800',
  'Ready for review':
    'border-violet-200 bg-violet-50 text-violet-800',
  'Published to Ignite':
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Needs review':
    'border-rose-200 bg-rose-50 text-rose-800',
  Indexed:
    'border-sky-200 bg-sky-50 text-sky-800',
  Published:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Rename suggested':
    'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Ready to publish':
    'border-cyan-200 bg-cyan-50 text-cyan-800',
}

export function StatusBadge({ label }: { label: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold tracking-[0.02em]',
        statusStyles[label] ?? 'border-[var(--brand-border)] bg-white text-[var(--brand-slate)]'
      )}
    >
      {label}
    </Badge>
  )
}
