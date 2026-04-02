type CustodyItem = { label: string; count: number }

export function CustodyPipeline({ items }: { items: readonly CustodyItem[] }) {
  return (
    <section className="grid grid-cols-2 divide-x divide-y overflow-hidden rounded-2xl border border-border-strong bg-surface-panel sm:grid-cols-5 sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 p-4">
          <p className="ops-label mb-2 truncate text-text-muted">{item.label}</p>
          <p className="font-ops text-[1.8rem] font-semibold leading-none text-text-strong">
            {item.count}
          </p>
        </div>
      ))}
    </section>
  )
}
