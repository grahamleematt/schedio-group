export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--brand-border)] px-4 py-8 text-[var(--brand-muted)]">
      <div className="page-wrap flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0">
          &copy; {year} Schedio Group AI mockup workspace. Static concepts for
          portal, operations, and review flows.
        </p>
        <p className="m-0">
          Built with TanStack Start, Tailwind CSS v4, and shadcn/ui.
        </p>
      </div>
    </footer>
  )
}
