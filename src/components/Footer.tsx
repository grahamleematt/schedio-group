export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border-base px-4 py-8 text-text-muted">
      <div className="page-wrap flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0">&copy; {year} Schedio Group</p>
        <p className="m-0">Client operations and review workspace</p>
      </div>
    </footer>
  )
}
