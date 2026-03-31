import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  archiveFacts,
  clientDocumentClassOrder,
  getDocumentClassLabel,
} from '#/lib/mock-data'
import { cn } from '#/lib/utils'

const conceptGroups = [
  {
    title: 'Client-facing concepts',
    description:
      'Two directions for the same external SG DREAM experience: custody-first intake and higher-transparency operations visibility.',
    cards: [
      {
        title: 'Client Intake',
        to: '/portal-trust',
        audience: 'Client-facing',
        style: 'trust',
        summary: 'Guided custody and intake.',
        angle:
          'The calmest front door for clients who need to submit evidence, preserve original files, and watch packages move from incoming custody to classified records.',
        ctaLabel: 'Open client intake',
      },
      {
        title: 'Client Operations',
        to: '/portal-operations',
        audience: 'Client-facing',
        style: 'operations',
        summary: 'Operational transparency view.',
        angle:
          'A denser client workspace for package completeness, manifest progress, linked evidence visibility, and engineering review in progress without exposing internal approval authority.',
        ctaLabel: 'Open client operations',
      },
    ],
  },
  {
    title: 'Internal governance workflow',
    description:
      'These are not alternate concepts. They are the two internal SG DREAM roles: drafting prepares the governed package, then approval moves authority state.',
    cards: [
      {
        title: 'Drafting Workbench',
        to: '/review-workbench',
        audience: 'Internal drafting',
        style: 'workbench',
        summary: 'Analyst drafting workspace.',
        angle:
          'The file-first workspace for assembling document and run manifests, drafting rationale, selecting determination method, and preparing the engineering position for approval.',
        ctaLabel: 'Open drafting workbench',
      },
      {
        title: 'Approval Console',
        to: '/review-console',
        audience: 'Internal approval',
        style: 'review',
        summary: 'Governance and approval console.',
        angle:
          'The governance surface for verifying capability separation, reviewing draft rationale, approving authority transitions, and moving governed records into relied or locked state.',
        ctaLabel: 'Open approval console',
      },
    ],
  },
]

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [{ title: 'Schedio Group | SG DREAM Views' }],
  }),
  component: App,
})

function App() {
  const classSummary = clientDocumentClassOrder
    .map((documentClass) => getDocumentClassLabel(documentClass))
    .join(' • ')

  return (
    <main className="page-wrap page-frame">
      <section className="brand-panel surface-trust rounded-[2rem] px-6 py-8 sm:px-8 sm:py-10">
        <div className="space-y-6">
          <img
            src="/schedio-logo.svg"
            alt="Schedio Group"
            className="h-12 w-auto sm:h-14"
          />
          <div className="space-y-3">
            <h1 className="font-heading max-w-4xl text-4xl font-bold tracking-[-0.045em] text-text-strong sm:text-5xl">
              SG DREAM shown through four views.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-text-muted sm:text-base">
              The first two screens show client-facing intake concepts. The last
              two show the internal governance workflow: drafting prepares the
              governed package, then approval changes authority state.
            </p>
            <p className="max-w-3xl text-sm leading-6 text-text-base">
              Records stay preserved as immutable evidence in Egnyte, then move
              into manifests, linked evidence chains, and governed determination
              packages across {archiveFacts.fileCount} files in a{' '}
              {archiveFacts.totalEntries}
              -entry archive. Core classes: {classSummary}.
            </p>
          </div>
        </div>
      </section>

      <div className="section-stack">
        {conceptGroups.map((group) => (
          <section key={group.title} className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.14em] uppercase text-text-accent">
                {group.title}
              </p>
              <p className="max-w-3xl text-sm leading-6 text-text-muted">
                {group.description}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {group.cards.map((mockup) => (
                <Card
                  key={mockup.to}
                  className={cn(
                    'rounded-[1.75rem] shadow-none overflow-hidden transition-colors flex flex-col h-full',
                    mockup.style === 'workbench' || mockup.style === 'review'
                      ? 'border-border-strong bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(239,244,251,0.96))] text-text-strong'
                      : 'brand-panel border-border-base',
                  )}
                >
                  <CardHeader className="space-y-4 pb-4">
                    <div className="space-y-2">
                      <p
                        className={cn(
                          'text-xs font-semibold tracking-[0.14em] uppercase',
                          mockup.style === 'operations' ||
                            mockup.style === 'workbench' ||
                            mockup.style === 'review'
                            ? 'font-mono text-text-accent'
                            : 'text-text-accent',
                        )}
                      >
                        {mockup.audience}
                      </p>
                      <CardTitle
                        className={cn(
                          mockup.style === 'operations' ||
                            mockup.style === 'workbench' ||
                            mockup.style === 'review'
                            ? 'font-ops text-[2rem] font-semibold tracking-[-0.055em]'
                            : 'font-heading text-2xl font-bold tracking-[-0.04em]',
                          'text-text-strong',
                        )}
                      >
                        {mockup.title}
                      </CardTitle>
                      <CardDescription className="text-sm leading-6 text-text-muted">
                        {mockup.summary}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col flex-1 space-y-5">
                    <p
                      className={cn(
                        'rounded-2xl px-4 py-4 text-sm leading-6 border',
                        mockup.style === 'workbench' ||
                          mockup.style === 'review'
                          ? 'border-border-base bg-[rgba(255,255,255,0.82)] text-text-base'
                          : 'border-transparent bg-surface-muted text-text-base',
                      )}
                    >
                      {mockup.angle}
                    </p>
                    <div className="mt-auto pt-2">
                      <LinkButton label={mockup.ctaLabel} to={mockup.to} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}

function LinkButton({ label, to }: { label: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-11 w-full items-center justify-between rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground no-underline shadow-sm transition-colors hover:bg-primary-hover"
    >
      <span className="text-primary-foreground">{label}</span>
      <ArrowRight className="size-4 text-primary-foreground" />
    </Link>
  )
}
