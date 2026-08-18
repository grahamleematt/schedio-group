/**
 * Finalize / reopen surface for a submission.
 *
 * `variant="full"` (dashboard, confirmation) renders the "Happy with this
 * submission?" finalize call-to-action while the submission is open, and the
 * locked banner with the reopen control once finalized. `variant="banner"`
 * (submissions, library) renders only the locked banner — nothing while the
 * submission is still open.
 *
 * Reopen visibility follows `canReopenSubmission`: clients until the cutoff,
 * internal roles until Schedio approves the cycle. The server re-checks both.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Lock, LockOpen } from 'lucide-react'
import {
  canReopenSubmission,
  isInternalUser,
  isSubmissionLocked,
} from '#/lib/sg-dream'
import type { Document, Verification } from '#/lib/sg-dream'
import { portalConfigQuery, verificationSnapshotQuery } from '#/lib/queries'
import { usePortalConfig, useSessionUser } from '#/lib/session'
import {
  finalizeSubmission,
  reopenSubmission,
} from '#/server/fns/finalizeSubmission'
import type { FinalizeSubmissionResult } from '#/server/fns/finalizeSubmission'

type FinalizeSubmissionPanelProps = {
  verification: Verification
  docs: ReadonlyArray<Document>
  variant?: 'full' | 'banner'
}

export function FinalizeSubmissionPanel({
  verification,
  docs,
  variant = 'full',
}: FinalizeSubmissionPanelProps) {
  const config = usePortalConfig()
  const user = useSessionUser()
  const internal = isInternalUser(user)
  const queryClient = useQueryClient()
  const snapshotKey = verificationSnapshotQuery(verification.id).queryKey

  const applyResult = (result: FinalizeSubmissionResult) => {
    if (!result.ok) return
    queryClient.setQueryData(snapshotKey, result.snapshot)
    // Verification status changed server-side; refresh the schedule so pills
    // and the open-cycle resolution stay in sync.
    void queryClient.invalidateQueries({
      queryKey: portalConfigQuery().queryKey,
    })
  }

  const finalizeMut = useMutation({
    mutationFn: () =>
      finalizeSubmission({ data: { verificationId: verification.id } }),
    onSuccess: applyResult,
  })
  const reopenMut = useMutation({
    mutationFn: () =>
      reopenSubmission({ data: { verificationId: verification.id } }),
    onSuccess: applyResult,
  })

  const locked = isSubmissionLocked(verification, docs)
  const cycleLabel = `Verification No. ${String(verification.number).padStart(2, '0')}`

  if (locked) {
    const reopenAllowed = canReopenSubmission({
      verification,
      todayISO: config.todayISO,
      internal,
    })
    const approved = verification.status === 'approved'
    const errorMessage =
      reopenMut.data && !reopenMut.data.ok
        ? reopenMut.data.error
        : reopenMut.isError
          ? 'Reopening didn’t complete — try again.'
          : null
    return (
      <section
        className="v2-card"
        aria-label="Submission finalized"
        style={{ borderColor: 'var(--color-green-base, var(--color-line-2))' }}
      >
        <div className="v2-card-body">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="m-0 flex items-center gap-2 font-ops text-sm font-semibold text-ink">
                <Lock className="size-4" aria-hidden />
                {approved
                  ? `${cycleLabel} approved by Schedio`
                  : `${cycleLabel} finalized — locked for Schedio review`}
              </p>
              <p className="text-muted-1 m-0 mt-1 text-[12.5px]">
                {approved
                  ? 'This cycle has been verified and approved. Its documents are permanent records.'
                  : reopenAllowed
                    ? `Documents can’t be added or removed while locked. Reopen to make changes${internal ? '' : ` before the ${verification.cutoffDate} cutoff`}.`
                    : `The ${verification.cutoffDate} cutoff has passed — contact Schedio if this submission needs changes.`}
              </p>
              {errorMessage ? (
                <p
                  className="m-0 mt-2 text-[12.5px] text-destructive"
                  role="alert"
                >
                  {errorMessage}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="pill pill-green">
                <span className="dot" />
                {approved ? 'Approved' : 'Finalized'}
              </span>
              {!approved && reopenAllowed ? (
                <button
                  type="button"
                  className="v2-btn"
                  disabled={reopenMut.isPending}
                  onClick={() => reopenMut.mutate()}
                >
                  {reopenMut.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <LockOpen className="size-4" aria-hidden />
                  )}
                  {reopenMut.isPending ? 'Reopening…' : 'Reopen submission'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (variant === 'banner' || docs.length === 0) return null

  const inFlight = docs.filter(
    (d) => d.status !== 'completed' && d.status !== 'error',
  ).length
  const errorMessage =
    finalizeMut.data && !finalizeMut.data.ok
      ? finalizeMut.data.error
      : finalizeMut.isError
        ? 'Finalizing didn’t complete — try again.'
        : null

  return (
    <section className="v2-card" aria-label="Finalize submission">
      <div className="v2-card-body">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 flex items-center gap-2 font-ops text-sm font-semibold text-ink">
              <CheckCircle2 className="size-4" aria-hidden />
              Happy with this submission?
            </p>
            <p className="text-muted-1 m-0 mt-1 text-[12.5px]">
              {inFlight > 0
                ? `${inFlight} document${inFlight === 1 ? ' is' : 's are'} still processing — you can finalize once processing completes.`
                : `Finalizing locks the ${docs.length} document${docs.length === 1 ? '' : 's'} for Schedio review. You can reopen to make changes until the ${verification.cutoffDate} cutoff.`}
            </p>
            {errorMessage ? (
              <p
                className="m-0 mt-2 text-[12.5px] text-destructive"
                role="alert"
              >
                {errorMessage}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="v2-btn primary shrink-0"
            disabled={finalizeMut.isPending || inFlight > 0}
            onClick={() => finalizeMut.mutate()}
          >
            {finalizeMut.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Lock className="size-4" aria-hidden />
            )}
            {finalizeMut.isPending ? 'Finalizing…' : `Finalize ${cycleLabel}`}
          </button>
        </div>
      </div>
    </section>
  )
}
