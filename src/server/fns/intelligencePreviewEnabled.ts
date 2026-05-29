import { createServerFn } from '@tanstack/react-start'

import { isIntelligencePreviewEnabled } from '#/server/env'

/**
 * Server-authoritative check used by the Intelligence/Determinations route
 * `beforeLoad` guards. The env flag is server-only, so the route reads it
 * through this fn and redirects away when the preview is disabled.
 */
export const getIntelligencePreviewEnabled = createServerFn({
  method: 'GET',
}).handler(async () => {
  return { enabled: isIntelligencePreviewEnabled() }
})
