import { Upload, WandSparkles } from 'lucide-react'
import { Button } from '#/components/ui/button'

type UploadDropzoneProps = {
  title: string
  subtitle: string
  points: string[]
}

export function UploadDropzone({
  title,
  subtitle,
  points,
}: UploadDropzoneProps) {
  return (
    <section className="brand-panel-muted rounded-[1.75rem] p-5 sm:p-6">
      <div className="rounded-[1.5rem] border border-dashed border-[rgba(0,61,166,0.28)] bg-white/80 p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(0,61,166,0.09)] px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase text-[var(--brand-blue)]">
              <Upload className="size-3.5" />
              Upload Intake
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold text-[var(--brand-slate)]">
                {title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--brand-muted)]">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button className="rounded-full bg-[var(--brand-blue)] px-5 text-white hover:bg-[color-mix(in_oklab,var(--brand-blue)_85%,black_15%)]">
              Start Upload
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-[var(--brand-border)] bg-white px-5 text-[var(--brand-slate)]"
            >
              <WandSparkles className="size-4" />
              Preview Filing Rules
            </Button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {points.map((point) => (
            <div
              key={point}
              className="rounded-2xl border border-[var(--brand-border)] bg-white px-4 py-4 text-sm leading-6 text-[var(--brand-text)]"
            >
              {point}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
