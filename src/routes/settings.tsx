import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query'
import {
  CheckCircle2,
  CloudOff,
  Loader2,
  Lock,
  PlugZap,
  ShieldCheck,
} from 'lucide-react'

import { AppShell } from '#/components/sg-dream/AppShell'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { clients, getOpenVerification, pendingUsers } from '#/lib/sg-dream'
import {
  egnyteConnectionQuery,
  portalConfigQuery,
  verificationSnapshotQuery,
} from '#/lib/queries'
import { connectEgnyte } from '#/server/fns/connectEgnyte'
import { disconnectEgnyte } from '#/server/fns/disconnectEgnyte'

type SettingsSearch = {
  client: string
}

const DEFAULT_CLIENT = 'dawson-trails-md1'

export const Route = createFileRoute('/settings')({
  validateSearch: (s: Record<string, unknown>): SettingsSearch => ({
    client: typeof s.client === 'string' ? s.client : DEFAULT_CLIENT,
  }),
  loader: async ({ context, location }) => {
    const search = location.search as SettingsSearch
    const requested =
      typeof search.client === 'string' ? search.client : DEFAULT_CLIENT
    const known = clients.find((c) => c.id === requested)
    if (!known) {
      throw redirect({ to: '/settings', search: { client: DEFAULT_CLIENT } })
    }
    const { verifications } =
      await context.queryClient.ensureQueryData(portalConfigQuery())
    const open = getOpenVerification(verifications, known.id)
    return Promise.all([
      context.queryClient.ensureQueryData(verificationSnapshotQuery(open.id)),
      context.queryClient.ensureQueryData(egnyteConnectionQuery()),
    ])
  },
  head: () => ({ meta: [{ title: 'Settings & integrations | SG DREAM' }] }),
  component: SettingsPage,
})

function formatWhen(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function SettingsPage() {
  const rail = (
    <section className="v2-card">
      <header className="v2-card-head">
        <h3>About connections</h3>
      </header>
      <div className="v2-card-body grid gap-2.5 text-[13px] leading-normal text-muted-1">
        <p className="m-0">
          Connections are <strong>per person</strong>. Tim links his own Egnyte
          account; you link yours. Documents you submit are staged in Egnyte as
          you.
        </p>
        <p className="m-0">
          We store only an encrypted refresh token — never your Egnyte password.
          Disconnect any time to revoke this app&rsquo;s access.
        </p>
      </div>
    </section>
  )

  return (
    <AppShell
      active="settings"
      crumbs={[{ label: 'Settings & integrations' }]}
      rail={rail}
      pendingUsers={pendingUsers.length}
      recentAuditEvents={0}
    >
      <header className="mb-3">
        <p className="v2-eyebrow">Account</p>
        <h1 className="v2-h1">Settings &amp; integrations</h1>
        <p className="v2-lede">
          Link the external systems SG DREAM acts on with your own credentials.
        </p>
      </header>

      <EgnyteIntegrationCard />
    </AppShell>
  )
}

function EgnyteIntegrationCard() {
  const status = useSuspenseQuery(egnyteConnectionQuery()).data
  const queryClient = useQueryClient()

  const disconnect = useMutation({
    mutationFn: () => disconnectEgnyte(),
    onSuccess: (next) => {
      queryClient.setQueryData(egnyteConnectionQuery().queryKey, next)
    },
  })

  if (!status.appConfigured) {
    return (
      <section className="v2-card">
        <header className="v2-card-head flex items-center justify-between">
          <h3>Egnyte</h3>
          <span className="chip">Not available</span>
        </header>
        <div className="v2-card-body flex items-start gap-3 text-[13px] text-muted-1">
          <CloudOff
            className="mt-0.5 size-5 shrink-0 text-muted-2"
            aria-hidden
          />
          <p className="m-0">
            Egnyte isn&rsquo;t configured for this environment. Once the Egnyte
            application credentials are set, you&rsquo;ll be able to link your
            account here.
          </p>
        </div>
      </section>
    )
  }

  return (
    <section className="v2-card">
      <header className="v2-card-head flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3>Egnyte</h3>
          <span className="text-[12px] text-muted-2">File custody</span>
        </div>
        {status.connected ? (
          <span className="pill pill-green">
            <CheckCircle2 className="size-3.5" aria-hidden />
            Connected
          </span>
        ) : (
          <span className="pill pill-amber">
            <span className="dot" />
            Not connected
          </span>
        )}
      </header>

      <div className="v2-card-body">
        {status.connected ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1">
              <div className="kv">
                <span className="k">Egnyte user</span>
                <span className="v mono">{status.egnyteUsername ?? '—'}</span>
              </div>
              <div className="kv">
                <span className="k">Connected</span>
                <span className="v mono">{formatWhen(status.connectedAt)}</span>
              </div>
              <div className="kv">
                <span className="k">Last verified</span>
                <span className="v mono">
                  {formatWhen(status.lastVerifiedAt)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <ConnectEgnyteDialog
                triggerLabel="Reconnect"
                triggerVariant="outline"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => disconnect.mutate()}
                disabled={disconnect.isPending}
                className="text-destructive hover:text-destructive"
              >
                {disconnect.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 max-w-[460px] text-[13px] leading-normal text-muted-1">
              Link your Egnyte account so documents you submit are filed in
              Egnyte under your name. You&rsquo;ll sign in with your Egnyte
              username and password once.
            </p>
            <ConnectEgnyteDialog
              triggerLabel="Connect Egnyte"
              triggerVariant="default"
            />
          </div>
        )}
      </div>
    </section>
  )
}

function ConnectEgnyteDialog({
  triggerLabel,
  triggerVariant,
}: {
  triggerLabel: string
  triggerVariant: 'default' | 'outline'
}) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const connect = useMutation({
    mutationFn: (vars: { username: string; password: string }) =>
      connectEgnyte({ data: vars }),
    onSuccess: (result) => {
      if (result.ok) {
        queryClient.setQueryData(
          egnyteConnectionQuery().queryKey,
          result.status,
        )
        setOpen(false)
        setUsername('')
        setPassword('')
      }
    },
  })

  const resultError =
    connect.data && !connect.data.ok ? connect.data.error : undefined
  const unexpectedError = connect.isError
    ? 'Something went wrong reaching Egnyte. Try again.'
    : undefined
  const errorText = resultError ?? unexpectedError

  const canSubmit =
    username.trim().length > 0 && password.length > 0 && !connect.isPending

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          connect.reset()
          setPassword('')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size="sm">
          <PlugZap className="size-4" aria-hidden />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Egnyte</DialogTitle>
          <DialogDescription>
            Sign in with your Egnyte credentials. We exchange them for a token
            once and store only the encrypted token — never your password.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSubmit) return
            connect.mutate({ username: username.trim(), password })
          }}
        >
          <label className="grid gap-1.5">
            <span className="ops-label text-muted-1">Egnyte username</span>
            <Input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="you@schedio.com"
              autoFocus
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="ops-label text-muted-1">Egnyte password</span>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {errorText ? (
            <p
              className="m-0 flex items-start gap-1.5 text-[13px] text-destructive"
              role="alert"
            >
              <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {errorText}
            </p>
          ) : (
            <p className="m-0 flex items-center gap-1.5 text-[12px] text-muted-2">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
              Connection is scoped to your account only.
            </p>
          )}

          <DialogFooter className="mt-1">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={!canSubmit}>
              {connect.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              Connect
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
