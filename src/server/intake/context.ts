import {
  clients as configuredClients,
  formatRef,
  isPastCutoff,
} from '#/lib/sg-dream'
import type { Client, Verification } from '#/lib/sg-dream'
import { getEgnyteEnv } from '#/server/env'
import {
  ensureNextVerification,
  getVerificationConfigById,
  todayISOInDenver,
} from '#/server/portalConfig'

export type IntakeContext = {
  client: Client
  verification: Verification
  verificationRef: string
  clientRootPath: string
  verificationFolder: string
  incomingFolder: string
  /** Set when a late submission was retargeted from a past-cutoff cycle. */
  rolledFrom?: { id: string; period: string; cutoffDate: string }
}

export async function resolveIntakeContext(input: {
  clientId?: string
  verificationId: string
  /**
   * Late-submission rollover — set only on paths that CREATE documents
   * (uploads, Egnyte imports). When the target cycle's cutoff has passed,
   * retarget to the next cycle, creating it if needed. Never set for
   * operations on existing documents (filing, deletion, review), which must
   * keep addressing the cycle their documents already live in.
   */
  rollPastCutoff?: boolean
}): Promise<IntakeContext | null> {
  let verification = await getVerificationConfigById(input.verificationId)
  if (!verification) return null
  const requestedClientId = input.clientId || verification.clientId
  const client = configuredClients.find((c) => c.id === requestedClientId)
  if (!client || client.id !== verification.clientId) return null

  let rolledFrom: IntakeContext['rolledFrom']
  if (input.rollPastCutoff) {
    const todayISO = todayISOInDenver()
    // A submission can be more than one cycle late (e.g. a stale link two
    // months on) — walk forward until we land in a cycle that's still open.
    // Bounded so a misconfigured cutoff can't loop forever.
    for (let hops = 0; hops < 24; hops += 1) {
      if (!isPastCutoff(verification.cutoffDateISO, todayISO)) break
      const next = await ensureNextVerification(verification)
      if (!next) break // no database — cutoff stays advisory
      rolledFrom = rolledFrom ?? {
        id: verification.id,
        period: verification.period,
        cutoffDate: verification.cutoffDate,
      }
      verification = next
    }
  }

  const verificationRef = formatRef({
    workflow: client.workflow,
    number: verification.number,
    year: verification.year,
    seq: verification.seq,
  })
  const clientRootPath = client.egnyteRootPath
    ? client.egnyteRootPath.replace(/\/$/, '')
    : `${getEgnyteEnv().EGNYTE_ROOT_PATH.replace(/\/$/, '')}/${client.code}`
  const verificationFolder = `${clientRootPath}/Intake/Draft`
  return {
    client,
    verification,
    verificationRef,
    clientRootPath,
    verificationFolder,
    incomingFolder: `${verificationFolder}/Incoming`,
    ...(rolledFrom ? { rolledFrom } : {}),
  }
}

export function classifiedFolderFromIncomingPath(input: {
  incomingPath: string
  docType: string
}): string {
  const parts = input.incomingPath.split('/').filter(Boolean)
  const incomingIndex = parts.lastIndexOf('Incoming')
  if (incomingIndex > 0) {
    const base = `/${parts.slice(0, incomingIndex).join('/')}`
    return `${base}/Classified/${input.docType}`
  }
  const withoutFilename = input.incomingPath.split('/').slice(0, -1).join('/')
  return `${withoutFilename}/Classified/${input.docType}`
}
