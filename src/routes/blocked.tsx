import { Link, createFileRoute } from '@tanstack/react-router'
import { Lock, Mail } from 'lucide-react'

type BlockedSearch = {
  entity?: string
  conflict?: string
  request?: string
}

export const Route = createFileRoute('/blocked')({
  validateSearch: (s: Record<string, unknown>): BlockedSearch => ({
    entity:
      typeof s.entity === 'string' && s.entity.length > 0 ? s.entity : undefined,
    conflict:
      typeof s.conflict === 'string' && s.conflict.length > 0
        ? s.conflict
        : undefined,
    request:
      typeof s.request === 'string' && s.request.length > 0
        ? s.request
        : undefined,
  }),
  head: () => ({ meta: [{ title: 'Access blocked | SG DREAM' }] }),
  component: BlockedPage,
})

function BlockedPage() {
  const search = Route.useSearch()
  const conflictingEntity = search.entity ?? 'Highlands Creek Authority'
  const conflictingParty = search.conflict ?? 'Apex Construction (vendor)'
  const requestRef = search.request ?? 'REQ-2026-0114'

  return (
    <main className="blocked-wrap" data-workflow="district_dp">
      <div className="blocked-card">
        <div className="lock-ill" aria-hidden>
          <Lock className="size-7" />
        </div>
        <p className="ops-label m-0" style={{ color: 'var(--color-red-base)' }}>
          Access blocked
        </p>
        <h1 className="font-ops mt-1.5 mb-1.5 text-[22px] font-medium tracking-[-0.02em] text-ink">
          This workspace conflicts with another assignment
        </h1>
        <p className="text-muted-1 mx-auto mb-4 max-w-[440px] text-[13px] leading-[1.55]">
          Your account is associated with{' '}
          <strong className="text-ink">Apex Construction</strong>, which has
          active work in this entity. To preserve impartiality, Schedio cannot
          grant access here. If you believe this is an error, your Entity
          Owner must request an exception.
        </p>

        <section className="v2-card mb-4 text-left">
          <div className="v2-card-body">
            <div className="kv">
              <span className="k">Conflicting entity</span>
              <span className="v">{conflictingEntity}</span>
            </div>
            <div className="kv">
              <span className="k">Conflicting party</span>
              <span className="v">{conflictingParty}</span>
            </div>
            <div className="kv">
              <span className="k">Policy reference</span>
              <span className="v mono">SG-ISOL-2024-01</span>
            </div>
            <div className="kv">
              <span className="k">Request reference</span>
              <span className="v mono">{requestRef}</span>
            </div>
          </div>
        </section>

        <div className="flex justify-center gap-2">
          <Link
            to="/login"
            search={{ error: undefined }}
            className="v2-btn"
          >
            Sign out
          </Link>
          <a
            href={`mailto:?subject=${encodeURIComponent('SG DREAM access exception request')}&body=${encodeURIComponent(`Please review access request ${requestRef}.`)}`}
            className="v2-btn primary"
          >
            <Mail className="size-4" aria-hidden />
            Email Schedio Admin
          </a>
        </div>
      </div>
    </main>
  )
}
