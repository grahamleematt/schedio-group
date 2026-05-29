import {
  clients as configuredClients,
  formatRef,
  verifications as configuredVerifications,
} from '#/lib/sg-dream'
import type { Client, Verification } from '#/lib/sg-dream'
import { getEgnyteEnv } from '#/server/env'

export type IntakeContext = {
  client: Client
  verification: Verification
  verificationRef: string
  clientRootPath: string
  verificationFolder: string
  incomingFolder: string
}

export function resolveIntakeContext(input: {
  clientId?: string
  verificationId: string
}): IntakeContext | null {
  const verification = configuredVerifications.find(
    (v) => v.id === input.verificationId,
  )
  if (!verification) return null
  const client = configuredClients.find(
    (c) => c.id === (input.clientId || verification.clientId),
  )
  if (!client || client.id !== verification.clientId) return null

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
