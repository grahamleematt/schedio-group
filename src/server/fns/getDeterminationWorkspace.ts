import { createServerFn } from '@tanstack/react-start'

import { isIntelligencePreviewEnabled } from '#/server/env'
import { INTELLIGENCE_PREVIEW_DISABLED_MESSAGE } from '#/server/preview'
import { getWorkspaceBase } from '#/server/determinations/source'
import { getDeterminationStore } from '#/server/determinations/store'
import type { DeterminationWorkspace } from '#/server/determinations/types'

const DISABLED_WORKSPACE: DeterminationWorkspace = {
  sourceZipPath: '',
  sourceExists: false,
  sourceWarnings: [INTELLIGENCE_PREVIEW_DISABLED_MESSAGE],
  documents: [],
  platPpps: [],
  assertions: [],
}

export const getDeterminationWorkspace = createServerFn({ method: 'GET' })
  .inputValidator(
    (data: { selectedSourceId?: string } | undefined) => data ?? {},
  )
  .handler(async (): Promise<DeterminationWorkspace> => {
    if (!isIntelligencePreviewEnabled()) return DISABLED_WORKSPACE
    const [base, assertions] = await Promise.all([
      getWorkspaceBase(),
      getDeterminationStore().listAssertions(),
    ])
    return {
      ...base,
      assertions,
    }
  })
