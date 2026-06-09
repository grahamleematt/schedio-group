/**
 * On-demand DocuPipe Visual Review viewer redirect.
 *
 * The processing view links here with `?review=<docupipeReviewId>`. DocuPipe's
 * review viewer is reached through a short-lived *presigned* URL that carries
 * its own signature + expiry, so we never store that URL — we mint a fresh one
 * per click (server-side, with our API key) and 302-redirect the browser to
 * it. This keeps the link scoped to a single review object and lets it expire.
 *
 * Minting requires the DocuPipe API key, so the call is authenticated: the
 * caller must be a signed-in portal user. The review ID itself is an opaque
 * DocuPipe identifier and is useless without our key.
 */

import { createFileRoute } from '@tanstack/react-router'

import { resolvePortalUser, authzJsonError } from '#/server/authz'
import { getReviewPresignedUrl } from '#/server/docupipe'
import { isIntakePipelineEnabled } from '#/server/env'

function htmlResponse(message: string, status: number): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Extraction overlay</title>` +
      `<body style="font-family:system-ui;margin:2rem;color:#1b2436">` +
      `<p>${message}</p></body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}

export const Route = createFileRoute('/api/docupipe/review-url')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isIntakePipelineEnabled()) {
          return htmlResponse('Document pipeline is disabled.', 503)
        }

        try {
          // Gate on a valid portal session before spending the API key.
          await resolvePortalUser()
        } catch (err) {
          const authError = authzJsonError(err)
          if (authError) return authError
          throw err
        }

        const reviewId = new URL(request.url).searchParams.get('review')
        if (!reviewId) {
          return htmlResponse('Missing review reference.', 400)
        }

        let url: string | null
        try {
          url = await getReviewPresignedUrl(reviewId)
        } catch {
          return htmlResponse(
            'The extraction overlay is temporarily unavailable. Please try again shortly.',
            502,
          )
        }

        if (!url) {
          return htmlResponse(
            'The extraction overlay is still being generated. Please try again in a moment.',
            404,
          )
        }

        return new Response(null, { status: 302, headers: { Location: url } })
      },
    },
  },
})
