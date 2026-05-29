/**
 * Single seam for siloing the unfinished Intelligence + Determinations
 * surfaces behind `INTELLIGENCE_PREVIEW_ENABLED`. Every non-intake entry point
 * (page-route `beforeLoad`, server fns, and API route handlers) funnels through
 * one of these helpers so the surfaces stay completely inert in the demo build:
 * unreachable, unable to read the local source zip, and unable to 500 on
 * Vercel.
 */

import { isIntelligencePreviewEnabled } from '#/server/env'

export const INTELLIGENCE_PREVIEW_DISABLED_MESSAGE =
  'Intelligence preview is disabled in this environment.'

export function isIntelligencePreviewOff(): boolean {
  return !isIntelligencePreviewEnabled()
}

/** 503 JSON response for API route handlers when the preview is disabled. */
export function intelligencePreviewDisabledResponse(): Response {
  return new Response(
    JSON.stringify({ error: INTELLIGENCE_PREVIEW_DISABLED_MESSAGE }),
    { status: 503, headers: { 'content-type': 'application/json' } },
  )
}
