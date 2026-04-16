import { AlertTriangle, Eye, ShieldX } from 'lucide-react'
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

type DuplicateFlagDetailProps = {
  flag: Exclude<DuplicateFlagKind, 'none'>
  matchedPreviousName?: string
  matchedVerificationRef?: string
  actions?: ReadonlyArray<'keep' | 'remove' | 'view'>
}

export function DuplicateFlagDetail({
  flag,
  matchedPreviousName,
  matchedVerificationRef,
  actions = ['keep', 'remove', 'view'],
}: DuplicateFlagDetailProps) {
  const isExact = flag === 'exact'

  return (
    <div
      className="mt-2 rounded-xl border p-3 text-xs"
      style={{
        background: isExact
          ? 'var(--color-flag-exact-bg)'
          : 'var(--color-flag-likely-bg)',
        borderColor: isExact
          ? 'var(--color-flag-exact-border)'
          : 'var(--color-flag-likely-border)',
        color: isExact
          ? 'var(--color-flag-exact-text)'
          : 'var(--color-flag-likely-text)',
      }}
    >
      <div className="flex items-start gap-2">
        <Eye aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <div className="min-w-0 space-y-0.5">
          <p className="font-semibold">
            {isExact
              ? 'Byte-for-byte match against a previously filed document.'
              : 'Likely match — same vendor, amount, and filename pattern.'}
          </p>
          {matchedPreviousName ? (
            <p className="truncate font-mono text-[0.72rem] opacity-90">
              Previously filed: {matchedPreviousName}
            </p>
          ) : null}
          {matchedVerificationRef ? (
            <p className="font-mono text-[0.72rem] opacity-80">
              Verification {matchedVerificationRef}
            </p>
          ) : null}
        </div>
      </div>

      {actions.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {actions.includes('keep') ? (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-full border bg-white/80 px-3 text-[0.72rem] font-semibold text-text-strong hover:bg-white"
              style={{ borderColor: 'currentColor' }}
            >
              Keep It
            </button>
          ) : null}
          {actions.includes('remove') ? (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-full border bg-white/80 px-3 text-[0.72rem] font-semibold text-text-strong hover:bg-white"
              style={{ borderColor: 'currentColor' }}
            >
              Remove It
            </button>
          ) : null}
          {actions.includes('view') ? (
            <button
              type="button"
              className="inline-flex h-7 items-center rounded-full border bg-white/80 px-3 text-[0.72rem] font-semibold text-text-strong hover:bg-white"
              style={{ borderColor: 'currentColor' }}
            >
              View Previous
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
