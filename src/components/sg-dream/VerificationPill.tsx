type VerificationPillProps = {
  number: number
  period?: string
  tone?: 'accent' | 'neutral'
}

export function VerificationPill({
  number,
  period,
  tone = 'accent',
}: VerificationPillProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.78rem] font-semibold tracking-[-0.01em]"
      style={
        tone === 'accent'
          ? {
              background: 'var(--wf-soft)',
              borderColor: 'var(--wf-border)',
              color: 'var(--wf-strong)',
            }
          : {
              background: 'var(--color-surface-panel)',
              borderColor: 'var(--color-border-base)',
              color: 'var(--color-text-strong)',
            }
      }
    >
      <span className="font-mono text-[0.72rem] uppercase tracking-[0.08em] opacity-70">
        Verification
      </span>
      <span>No. {number}</span>
      {period ? (
        <span className="text-[0.72rem] font-normal opacity-80">
          • {period}
        </span>
      ) : null}
    </span>
  )
}
