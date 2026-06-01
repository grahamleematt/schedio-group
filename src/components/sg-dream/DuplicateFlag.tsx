import { AlertTriangle, ShieldX } from 'lucide-react'
import type { DuplicateFlag as DuplicateFlagKind } from '#/lib/sg-dream'

type DuplicateFlagPillProps = {
  flag: Exclude<DuplicateFlagKind, 'none'>
}

export function DuplicateFlagPill({ flag }: DuplicateFlagPillProps) {
  if (flag === 'exact') {
    return (
      <span className="flag-pill-exact">
        <ShieldX className="size-3" />
        Exact Duplicate
      </span>
    )
  }
  return (
    <span className="flag-pill-likely">
      <AlertTriangle className="size-3" />
      Likely Duplicate
    </span>
  )
}
