/**
 * Help & feedback dialog, reachable from the sidebar on every authed route.
 * Submissions go through `submitFeedback`: persisted to Postgres, posted to
 * the Schedio Slack channel when configured, and always audit-logged. The
 * current page and active entity travel with the message automatically so
 * nobody has to describe where they were.
 *
 * Screenshots/files can be attached (picked or pasted straight into the
 * message box). They upload directly to Vercel Blob via `/api/blob-token`
 * (`kind: 'feedback'`) right before the submit, and their URLs ride along
 * into Postgres + Slack.
 */

import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import {
  CheckCircle2,
  LifeBuoy,
  Loader2,
  Paperclip,
  Send,
  X,
} from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import type { Client } from '#/lib/sg-dream'
import type {
  FeedbackAttachment,
  FeedbackContext,
  FeedbackStatus,
} from '#/server/feedback'
import { listMyFeedback, submitFeedback } from '#/server/fns/submitFeedback'
import type { SubmitFeedbackResult } from '#/server/fns/submitFeedback'

type FeedbackCategory = 'bug' | 'idea' | 'question'

const CATEGORY_OPTIONS: ReadonlyArray<{
  id: FeedbackCategory
  label: string
}> = [
  { id: 'bug', label: 'Bug' },
  { id: 'idea', label: 'Idea' },
  { id: 'question', label: 'Question' },
]

const MAX_FILES = 3
const MAX_FILE_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
]

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Mirrors `feedbackStatusLabels` server-side (kept local: no server import). */
const STATUS_META: Record<FeedbackStatus, { label: string; pill: string }> = {
  new: { label: 'Received', pill: 'pill pill-wf' },
  in_review: { label: 'In review', pill: 'pill pill-amber' },
  resolved: { label: 'Resolved', pill: 'pill pill-green' },
}

const historyDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

/** Silent diagnostics so bug reports skip the "what browser?" follow-up. */
function captureContext(): FeedbackContext | undefined {
  if (typeof window === 'undefined') return undefined
  return {
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    screen: `${window.screen.width}x${window.screen.height}`,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }
}

async function uploadAttachments(
  files: File[],
): Promise<FeedbackAttachment[]> {
  if (files.length === 0) return []
  const { upload } = await import('@vercel/blob/client')
  const uploaded: FeedbackAttachment[] = []
  for (const file of files) {
    const result = await upload(`feedback/${file.name}`, file, {
      access: 'public',
      handleUploadUrl: '/api/blob-token',
      contentType: file.type || undefined,
      clientPayload: JSON.stringify({ kind: 'feedback' }),
    })
    uploaded.push({
      url: result.url,
      name: file.name,
      contentType: file.type || undefined,
      sizeBytes: file.size,
    })
  }
  return uploaded
}

export function FeedbackDialog({ client }: { client: Client }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<FeedbackCategory>('idea')
  const [message, setMessage] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const history = useQuery({
    queryKey: ['my-feedback'],
    queryFn: () => listMyFeedback(),
    enabled: open,
    staleTime: 30_000,
  })

  const mut = useMutation({
    mutationFn: async () => {
      const attachments = await uploadAttachments(files)
      return submitFeedback({
        data: {
          category,
          message,
          clientId: client.id,
          route: pathname,
          attachments: attachments.length > 0 ? attachments : undefined,
          context: captureContext(),
        },
      })
    },
    onSuccess: (result: SubmitFeedbackResult) => {
      if (result.ok) {
        setMessage('')
        setFiles([])
        void queryClient.invalidateQueries({ queryKey: ['my-feedback'] })
      }
    },
  })

  const sent = mut.isSuccess && mut.data.ok
  const error = mut.isError
    ? 'Could not send your feedback — try again.'
    : mut.data && !mut.data.ok
      ? mut.data.error
      : null
  const canSubmit = message.trim().length > 0 && !mut.isPending

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      mut.reset()
      setFiles([])
      setFileError(null)
    }
  }

  const addFiles = (incoming: Iterable<File>) => {
    setFileError(null)
    setFiles((current) => {
      const next = [...current]
      for (const file of incoming) {
        if (next.length >= MAX_FILES) {
          setFileError(`Up to ${MAX_FILES} attachments.`)
          break
        }
        if (!ACCEPTED_TYPES.includes(file.type)) {
          setFileError('Only images and PDFs can be attached.')
          continue
        }
        if (file.size > MAX_FILE_BYTES) {
          setFileError(`${file.name} is over 10 MB.`)
          continue
        }
        next.push(file)
      }
      return next
    })
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = Array.from(e.clipboardData.files).filter((f) =>
      f.type.startsWith('image/'),
    )
    if (pasted.length === 0) return
    e.preventDefault()
    addFiles(
      pasted.map(
        (f, i) =>
          new File([f], f.name || `screenshot-${Date.now()}-${i + 1}.png`, {
            type: f.type,
          }),
      ),
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="nav-link w-full bg-transparent text-left">
        <LifeBuoy aria-hidden />
        <span className="truncate">Help &amp; feedback</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Help &amp; feedback</DialogTitle>
          <DialogDescription>
            Spotted a bug or have an idea? It goes straight to the Schedio
            team, along with the page you&rsquo;re on.
          </DialogDescription>
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-start gap-3">
            <p className="m-0 flex items-center gap-2 text-sm font-semibold text-ink">
              <CheckCircle2
                className="size-4 shrink-0"
                style={{ color: 'var(--color-green-base)' }}
                aria-hidden
              />
              Sent — thank you. The Schedio team will take a look.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className="v2-btn"
                onClick={() => mut.reset()}
              >
                Send another
              </button>
              <button
                type="button"
                className="v2-btn primary"
                onClick={() => handleOpenChange(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) mut.mutate()
            }}
          >
            <div className="invite-field">
              <span className="field-label" id="feedback-category-label">
                What kind of feedback?
              </span>
              <div
                className="flex gap-2"
                role="radiogroup"
                aria-labelledby="feedback-category-label"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={category === option.id}
                    className={`v2-btn${category === option.id ? ' primary' : ''}`}
                    onClick={() => setCategory(option.id)}
                    disabled={mut.isPending}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="invite-field">
              <span className="field-label">Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onPaste={handlePaste}
                rows={5}
                maxLength={4000}
                placeholder="What happened, or what would make this better? Paste a screenshot to attach it."
                disabled={mut.isPending}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              />
            </label>

            <div className="invite-field">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES.join(',')}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files)
                    e.target.value = ''
                  }}
                />
                <button
                  type="button"
                  className="v2-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mut.isPending || files.length >= MAX_FILES}
                >
                  <Paperclip className="size-4" aria-hidden />
                  Attach screenshot or file
                </button>
                {files.map((file, index) => (
                  <span
                    key={`${file.name}-${index}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-input px-2 py-1 text-[12px] text-muted-1"
                  >
                    <span className="max-w-40 truncate">{file.name}</span>
                    <span className="shrink-0">{formatSize(file.size)}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 rounded-sm p-0.5 hover:text-ink"
                      onClick={() =>
                        setFiles((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                      disabled={mut.isPending}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
              {fileError ? (
                <span
                  className="text-[12px]"
                  style={{ color: 'var(--color-red-base)' }}
                  role="alert"
                >
                  {fileError}
                </span>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted-1" role="status">
                {error ? (
                  <span style={{ color: 'var(--color-red-base)' }}>
                    {error}
                  </span>
                ) : (
                  <>
                    Sends from {client.code} · {pathname}
                  </>
                )}
              </span>
              <button
                type="submit"
                className="v2-btn primary"
                disabled={!canSubmit}
              >
                {mut.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <Send className="size-4" aria-hidden />
                )}
                {mut.isPending ? 'Sending…' : 'Send feedback'}
              </button>
            </div>
          </form>
        )}

        {history.data && history.data.length > 0 ? (
          <div className="border-t pt-3">
            <span className="field-label">Your recent feedback</span>
            <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
              {history.data.map((item) => {
                const meta = STATUS_META[item.status]
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 text-[12px] text-muted-1"
                  >
                    <span className={`${meta.pill} shrink-0`}>
                      {meta.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate" title={item.message}>
                      {item.message}
                    </span>
                    <span className="shrink-0">
                      {historyDate.format(new Date(item.createdAtISO))}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
