import { AlarmClock, CalendarClock, TimerReset } from 'lucide-react'
import { computeCutoffUrgency } from '#/lib/sg-dream'
import type { CutoffUrgency } from '#/lib/sg-dream'

type CutoffCountdownProps = {
  cutoffDateISO: string
  /** Tighter tag shown alongside pills. Defaults to 'Cutoff'. */
  label?: string
}

/**
 * Derived-only countdown pill. No useEffect, no local state — reads today's
 * date at render time via `new Date()` inside `computeCutoffUrgency`.
 * Colour tokens switch between workflow accent (healthy), monitor amber
 * (warning), and amend red (critical / passed).
 */
export function CutoffCountdown({
  cutoffDateISO,
  label = 'Cutoff',
}: CutoffCountdownProps) {
  const { daysLeft, urgency } = computeCutoffUrgency(cutoffDateISO)
  const { background, color, border, icon, text } = styleForUrgency(
    urgency,
    daysLeft,
  )

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.72rem] font-semibold uppercase tracking-[0.08em]"
      style={{ background, color, borderColor: border }}
      data-urgency={urgency}
    >
      {icon}
      <span>{label ? `${label} · ${text}` : text}</span>
    </span>
  )
}

function styleForUrgency(urgency: CutoffUrgency, daysLeft: number): {
  background: string
  color: string
  border: string
  icon: React.ReactNode
  text: string
} {
  if (urgency === 'passed') {
    return {
      background: 'var(--color-util-amend-soft)',
      color: 'var(--color-util-amend)',
      border:
        'color-mix(in oklab, var(--color-util-amend) 40%, transparent)',
      icon: <AlarmClock aria-hidden className="size-3.5" />,
      text: 'Cutoff passed — contact Schedio',
    }
  }
  if (urgency === 'critical') {
    return {
      background: 'var(--color-util-amend-soft)',
      color: 'var(--color-util-amend)',
      border:
        'color-mix(in oklab, var(--color-util-amend) 40%, transparent)',
      icon: <AlarmClock aria-hidden className="size-3.5" />,
      text:
        daysLeft <= 0
          ? 'Closes today'
          : `Closes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
    }
  }
  if (urgency === 'warning') {
    return {
      background: 'var(--color-util-monitor-soft)',
      color: 'var(--color-util-monitor)',
      border:
        'color-mix(in oklab, var(--color-util-monitor) 40%, transparent)',
      icon: <TimerReset aria-hidden className="size-3.5" />,
      text: `Closes in ${daysLeft} days`,
    }
  }
  return {
    background: 'var(--wf-soft)',
    color: 'var(--wf-strong)',
    border: 'var(--wf-border)',
    icon: <CalendarClock aria-hidden className="size-3.5" />,
    text: `Closes in ${daysLeft} days`,
  }
}
