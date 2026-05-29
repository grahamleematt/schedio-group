import { Link } from '@tanstack/react-router'
import { FileDown, Mail, UploadCloud } from 'lucide-react'

type DashboardActionsProps = {
  clientId: string
  verificationId: string
}

export function DashboardActions({
  clientId,
  verificationId,
}: DashboardActionsProps) {
  return (
    <section
      className="brand-panel flex flex-col gap-3 rounded-2xl px-5 py-5 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: 'var(--color-border-base)' }}
    >
      <div>
        <p className="ops-label m-0">Actions</p>
        <p className="text-sm text-text-muted">
          Add to this submission or email a summary for your records.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/upload"
          search={{
            client: clientId,
            verification: verificationId,
          }}
          className="wf-button-secondary"
        >
          <UploadCloud className="size-4" />
          Upload more documents
        </Link>
        <span className="wf-button-secondary cursor-default opacity-80">
          <FileDown className="size-4" />
          Draft report awaiting PE stamp
        </span>
        <a
          href={`mailto:?subject=${encodeURIComponent('SG DREAM submission summary')}&body=${encodeURIComponent(`Please send me the latest submission summary for this entity.`)}`}
          className="wf-button-secondary"
        >
          <Mail className="size-4" />
          Email me this summary
        </a>
      </div>
    </section>
  )
}
