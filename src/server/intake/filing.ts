/**
 * Egnyte filing for the DREAM intake workflow.
 *
 * Filing is split into two phases so the confirmation page can act as an
 * explicit "review, then commit" gate:
 *
 *   1. `planFiling` runs at analysis time (DocuPipe standardization success).
 *      It mints the standardized filing name (sequence counter) and computes
 *      the destination path, but does NOT move the file. The document lands in
 *      the `ready` custody state.
 *   2. `fileDocumentToEgnyte` runs when the entity owner clicks "File to
 *      Egnyte" on the confirmation page. It performs the actual move
 *      (Incoming/ → Classified/<DocType>/<renamed>) and promotes the document
 *      to `classified`.
 *
 * When Egnyte is not configured (e.g. local dev) the move is simulated: the
 * document still gets its planned path and flips to `classified` so the gate
 * is demoable end-to-end without a live Egnyte tenant.
 */

import { clients as configuredClients, renamed } from '#/lib/sg-dream'
import type { Client, DocType, Verification } from '#/lib/sg-dream'
import { isEgnyteConfigured } from '#/server/env'
import { getVerificationConfigById } from '#/server/portalConfig'
import {
  createFolderIfMissing,
  egnyteWebUrl,
  isDestinationExistsError,
  moveFile,
} from '#/server/egnyte'
import { getStore } from '#/server/store'
import type { CustodyState, StoredDocument } from '#/server/store'
import {
  classifiedFolderFromIncomingPath,
  resolveIntakeContext,
} from '#/server/intake/context'

function vendorCodeFrom(name: string | undefined): string {
  if (!name) return 'UNK'
  const letters = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
  return letters.length > 0 ? letters.padEnd(4, 'X') : 'UNK'
}

/**
 * Destination Classified/ folder for a document. Prefers deriving from the
 * real Incoming/ path; falls back to the intake context and finally a static
 * convention so the planned path is always shown, even without Egnyte env.
 */
async function plannedDir(
  stored: StoredDocument,
  docType: DocType,
  client: Client,
): Promise<string> {
  if (stored.egnyteIncomingPath) {
    return classifiedFolderFromIncomingPath({
      incomingPath: stored.egnyteIncomingPath,
      docType,
    })
  }
  try {
    const ctx = await resolveIntakeContext({
      clientId: stored.clientId,
      verificationId: stored.verificationId,
    })
    if (ctx) return `${ctx.verificationFolder}/Classified/${docType}`
  } catch {
    // env not configured for path derivation — fall through to the convention
  }
  return `/Shared/SG-DREAM/${client.code}/Intake/Draft/Classified/${docType}`
}

export type FilingPlan = {
  custodyState: CustodyState
  renamedName?: string
  plannedPath?: string
  errorMessage?: string
}

/**
 * Assign the standardized filing name + destination path without moving the
 * file. Idempotent across webhook redeliveries: once a row has both a
 * `renamedName` and an `egnytePlannedPath` we reuse them rather than minting a
 * fresh sequence number.
 */
export async function planFiling(input: {
  stored: StoredDocument
  docType: DocType
  vendorName?: string
}): Promise<FilingPlan> {
  const { stored, docType, vendorName } = input

  if (stored.renamedName && stored.egnytePlannedPath) {
    return {
      custodyState: 'ready',
      renamedName: stored.renamedName,
      plannedPath: stored.egnytePlannedPath,
    }
  }

  const client = configuredClients.find((c) => c.id === stored.clientId)
  const verification: Verification | null = await getVerificationConfigById(
    stored.verificationId,
  )
  if (!client || !verification) {
    return {
      custodyState: 'processing',
      errorMessage: 'unknown client or verification for filing',
    }
  }

  const store = getStore()
  const seq = await store.nextDocSeqForVerification(
    stored.verificationId,
    docType,
  )
  const renamedName = renamed(
    client.code,
    verification.number,
    docType,
    vendorCodeFrom(vendorName),
    seq,
    verification.year,
  )
  const plannedPath = `${await plannedDir(stored, docType, client)}/${renamedName}`

  return { custodyState: 'ready', renamedName, plannedPath }
}

export type FileResult = {
  custodyState: CustodyState
  classifiedPath?: string
  webUrl?: string
  renamedName?: string
  errorMessage?: string
  /** True when Egnyte wasn't configured and the move was simulated. */
  simulated?: boolean
}

/**
 * Commit a single planned document to Egnyte. Performs the real move when
 * Egnyte is configured and the file is in Incoming/; otherwise simulates the
 * promotion so the gate works in local dev.
 */
export async function fileDocumentToEgnyte(
  stored: StoredDocument,
): Promise<FileResult> {
  const client = configuredClients.find((c) => c.id === stored.clientId)
  if (!client) {
    return { custodyState: 'ready', errorMessage: 'unknown client for filing' }
  }

  const renamedName = stored.renamedName
  const dest =
    stored.egnytePlannedPath ??
    (renamedName
      ? `${await plannedDir(stored, stored.docType, client)}/${renamedName}`
      : undefined)
  if (!renamedName || !dest) {
    return { custodyState: 'ready', errorMessage: 'document not yet named' }
  }

  // Already filed (e.g. a re-click) — return the existing classified path.
  if (stored.custodyState === 'classified' && stored.egnyteClassifiedPath) {
    return {
      custodyState: 'classified',
      classifiedPath: stored.egnyteClassifiedPath,
      renamedName,
      webUrl: stored.egnyteWebUrl,
    }
  }

  const canFileForReal =
    isEgnyteConfigured() && Boolean(stored.egnyteIncomingPath)
  if (!canFileForReal) {
    return {
      custodyState: 'classified',
      classifiedPath: dest,
      renamedName,
      simulated: true,
    }
  }

  try {
    const dir = dest.split('/').slice(0, -1).join('/')
    await createFolderIfMissing(dir)
    try {
      await moveFile({ from: stored.egnyteIncomingPath as string, to: dest })
    } catch (err) {
      // Benign only when this same row already owns the destination.
      if (
        !(isDestinationExistsError(err) && stored.egnyteClassifiedPath === dest)
      ) {
        throw err
      }
    }
    return {
      custodyState: 'classified',
      classifiedPath: dest,
      renamedName,
      webUrl: egnyteWebUrl(dest),
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'egnyte filing failed'
    console.error('[egnyte] filing failed', err)
    return { custodyState: 'ready', errorMessage: message }
  }
}
