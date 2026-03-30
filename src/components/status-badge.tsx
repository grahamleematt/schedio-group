import { Badge } from '#/components/ui/badge'
import { cn } from '#/lib/utils'

const statusStyles: Record<string, string> = {
  Incoming:
    'border-slate-200 bg-slate-100 text-slate-700',
  Processing:
    'border-blue-200 bg-blue-50 text-blue-800',
  Classified:
    'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Engineering review':
    'border-amber-200 bg-amber-50 text-amber-800',
  'Available in Egnyte':
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  Draft:
    'border-slate-200 bg-slate-100 text-slate-700',
  Reviewed:
    'border-violet-200 bg-violet-50 text-violet-800',
  Approved:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  Superseded:
    'border-zinc-200 bg-zinc-100 text-zinc-700',
  Relied:
    'border-cyan-200 bg-cyan-50 text-cyan-800',
  Locked:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Drafting capability':
    'border-blue-200 bg-blue-50 text-blue-800',
  'Approval capability':
    'border-violet-200 bg-violet-50 text-violet-800',
  PLAT_GEOMETRY:
    'border-cyan-200 bg-cyan-50 text-cyan-800',
  SCOPE_INTERPRETATION:
    'border-sky-200 bg-sky-50 text-sky-800',
  ENGINEER_ESTIMATE:
    'border-slate-200 bg-slate-100 text-slate-700',
  PLANNING_DOCUMENT:
    'border-sky-200 bg-sky-50 text-sky-800',
  PRELIMINARY_PLAT:
    'border-violet-200 bg-violet-50 text-violet-800',
  FINAL_PLAT:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  PLAT_AMENDMENT:
    'border-amber-200 bg-amber-50 text-amber-800',
  'Governance checked':
    'border-violet-200 bg-violet-50 text-violet-800',
  'Category recognized':
    'border-sky-200 bg-sky-50 text-sky-800',
  'Relationship identified':
    'border-indigo-200 bg-indigo-50 text-indigo-800',
  'Needs review':
    'border-rose-200 bg-rose-50 text-rose-800',
  'Naming check':
    'border-amber-200 bg-amber-50 text-amber-800',
  'Needs review / blocked':
    'border-rose-200 bg-rose-50 text-rose-800',
  Published:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  'Ready to publish':
    'border-cyan-200 bg-cyan-50 text-cyan-800',
  Ready:
    'border-emerald-200 bg-emerald-50 text-emerald-800',
  Blocked:
    'border-rose-200 bg-rose-50 text-rose-800',
  'Needs review / publish':
    'border-amber-200 bg-amber-50 text-amber-800',
  Mapped:
    'border-cyan-200 bg-cyan-50 text-cyan-800',
  Internal:
    'border-slate-200 bg-slate-100 text-slate-700',
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
