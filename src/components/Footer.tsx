export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-[var(--brand-border)] px-4 py-8 text-[var(--brand-muted)]">
      <div className="page-wrap flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0">&copy; {year} Schedio Group</p>
        <p className="m-0">SG DREAM governed evidence operating system</p>
      </div>
    </footer>
  )
}
