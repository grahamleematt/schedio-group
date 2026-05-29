import { createServerFn } from '@tanstack/react-start'

import { isIntelligencePreviewEnabled } from '#/server/env'
import { INTELLIGENCE_PREVIEW_DISABLED_MESSAGE } from '#/server/preview'
import { getIntelligenceStore } from '#/server/intelligence/store'
import type { IntelligenceWorkspace } from '#/server/intelligence/types'

const DISABLED_WORKSPACE: IntelligenceWorkspace = {
  mode: 'local',
  isDatabaseConfigured: false,
  clients: [],
  categories: [],
  imports: [],
  documents: [],
  segments: [],
  findings: [],
  learnings: [],
  relationships: [],
  recommendations: [],
  sourceWarnings: [INTELLIGENCE_PREVIEW_DISABLED_MESSAGE],
}

export const getIntelligenceWorkspace = createServerFn({ method: 'GET' })
  .inputValidator(
    (
      data:
        | { selectedDocumentId?: string; selectedSegmentId?: string }
        | undefined,
    ) => data ?? {},
  )
  .handler(async (): Promise<IntelligenceWorkspace> => {
    if (!isIntelligencePreviewEnabled()) return DISABLED_WORKSPACE
    return getIntelligenceStore().getWorkspace()
  })
