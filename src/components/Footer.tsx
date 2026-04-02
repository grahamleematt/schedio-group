export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border-strong bg-surface-panel/60 px-4 py-8 text-text-muted">
      <div className="page-wrap flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 font-ops font-semibold text-text-strong">
          &copy; {year} Schedio Group
        </p>
        <p className="m-0 font-ops text-xs tracking-wide text-text-muted">
          SG DREAM &middot; operations &amp; review workspace
        </p>
      </div>
    </footer>
  )
}
