import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, Workflow, Wrench } from 'lucide-react'
import { buttonVariants } from '#/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { cn } from '#/lib/utils'

const mockups = [
  {
    title: 'Portal Trust',
    to: '/portal-trust',
    icon: ShieldCheck,
    summary:
      'A calm client-facing intake experience centered on confidence, clarity, and easy district routing.',
    angle: 'Best for showing the reassuring, “dummy proof” front door Tim described.',
  },
  {
    title: 'Portal Operations',
    to: '/portal-operations',
    icon: Workflow,
    summary:
      'A denser dashboard flavor that keeps the same client flow but makes processing state and recent activity more visible.',
    angle: 'Best for showing status transparency without jumping all the way to admin tooling.',
  },
  {
    title: 'Review Console',
    to: '/review-console',
    icon: Wrench,
    summary:
      'An internal review surface focused on original-file traceability, rename suggestions, and audit-friendly oversight.',
    angle: 'Best for showing the human-in-the-loop side that protects Tim’s PE responsibility.',
  },
]

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Schedio Group AI Mockups' }],
  }),
  component: App,
})

function App() {
  return (
    <main className="page-wrap page-frame">
      <section className="brand-panel surface-trust rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
        <div className="route-grid items-start">
          <div className="space-y-5">
            <div className="eyebrow">
              <span className="size-2 rounded-full bg-[var(--brand-blue)]" />
              Schedio Group AI Mockup Set
            </div>
            <div className="space-y-4">
              <h1 className="font-heading max-w-4xl text-4xl font-extrabold tracking-[-0.04em] text-[var(--brand-slate)] sm:text-6xl">
                Three distinct product directions for Tim’s March 30 follow-up.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-[var(--brand-muted)] sm:text-lg">
                This repo is intentionally mockup-first: two client-facing portal
                concepts plus one internal review console, all built around the
                March 12 meeting notes and a portal-first intake workflow.
              </p>
            </div>
          </div>

          <aside className="brand-panel-muted rounded-[1.5rem] p-5">
            <p className="eyebrow">Confirmed from the meeting</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--brand-text)]">
              <li>Drag-and-drop intake should standardize scattered submission paths.</li>
              <li>Users may upload for multiple districts under one login context.</li>
              <li>Clients need status visibility and document access without replacing Ignite.</li>
              <li>The experience must feel trustworthy, reviewable, and operational.</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        {mockups.map((mockup) => {
          const Icon = mockup.icon

          return (
            <Card
              key={mockup.to}
              className="brand-panel rounded-[1.75rem] border-[var(--brand-border)] shadow-none"
            >
              <CardHeader className="space-y-4 pb-4">
                <div className="inline-flex size-11 items-center justify-center rounded-2xl bg-[rgba(0,61,166,0.08)] text-[var(--brand-blue)]">
                  <Icon className="size-5" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="font-heading text-2xl text-[var(--brand-slate)]">
                    {mockup.title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6 text-[var(--brand-muted)]">
                    {mockup.summary}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="rounded-2xl bg-[rgba(0,61,166,0.04)] px-4 py-4 text-sm leading-6 text-[var(--brand-text)]">
                  {mockup.angle}
                </p>
                <LinkButton label="Open mockup" to={mockup.to} />
              </CardContent>
            </Card>
          )
        })}
      </section>
    </main>
  )
}

function LinkButton({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className={cn(
        buttonVariants({ variant: 'default', size: 'lg' }),
        'w-full justify-between rounded-full bg-[var(--brand-blue)] px-5 text-white no-underline hover:bg-[color-mix(in_oklab,var(--brand-blue)_86%,black_14%)]'
      )}
    >
      {label}
      <ArrowRight className="size-4" />
    </Link>
  )
}
