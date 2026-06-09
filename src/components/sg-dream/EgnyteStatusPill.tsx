/**
 * Topbar pill showing the signed-in user's Egnyte connection state and linking
 * to the Integrations settings. Hidden entirely when the Egnyte OAuth app is
 * not configured for the environment (nothing to connect to). Uses a
 * non-suspense query so it never blocks the topbar from rendering.
 */

import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, PlugZap } from 'lucide-react'

import { egnyteConnectionQuery } from '#/lib/queries'
import { useActiveEntity } from '#/lib/session'

export function EgnyteStatusPill() {
  const { client } = useActiveEntity()
  const { data } = useQuery(egnyteConnectionQuery())

  if (!data || !data.appConfigured) return null

  const connected = data.connected
  const label = connected ? 'Egnyte' : 'Connect Egnyte'
  const title = connected
    ? `Egnyte connected${data.egnyteUsername ? ` as ${data.egnyteUsername}` : ''}`
    : 'Link your Egnyte account'

  return (
    <Link
      to="/settings"
      search={{ client: client.id }}
      className={`topbar-pill ${connected ? 'ok' : 'warn'}`}
      title={title}
      aria-label={title}
    >
      {connected ? (
        <CheckCircle2 className="size-3.5" aria-hidden />
      ) : (
        <PlugZap className="size-3.5" aria-hidden />
      )}
      {label}
    </Link>
  )
}
