export type SourceDocumentKind =
  | 'marked_contract'
  | 'marked_plat'
  | 'verification_workbook'
  | 'governance'

export type DeterminationMethod = 'SCOPE_INTERPRETATION' | 'PLAT_GEOMETRY'

export type EvidenceStage =
  | 'ENGINEER_ESTIMATE'
  | 'PLANNING_DOCUMENT'
  | 'PRELIMINARY_PLAT'
  | 'FINAL_PLAT'
  | 'PLAT_AMENDMENT'

export type TrainingScope =
  | 'client_filing'
  | 'client_project'
  | 'client_global'
  | 'firm_global'

export type SourceDocument = {
  id: string
  entryPath: string
  fileName: string
  kind: SourceDocumentKind
  groupLabel: string
  vendorName?: string
  filingLabel?: string
  pppPercent?: number
  docCode?: string
  sourceModifiedLabel?: string
  mimeType: string
}

export type PlatPppRecord = {
  id: string
  label: string
  totalAreaAcres: number
  privateAreaAcres: number
  publicAreaAcres: number
  ppp: number
}

export type DeterminationAssertion = {
  id: string
  sourceDocumentId: string
  sourceEntryPath: string
  sourceFileName: string
  projectName: string
  districtName: string
  vendorName?: string
  filingLabel?: string
  platContextId?: string
  scopeLabel: string
  pppValue: number
  method: DeterminationMethod
  evidenceStage: EvidenceStage
  trainingScope: TrainingScope
  rationale: string
  reasonTags: ReadonlyArray<string>
  authorInitials: string
  createdAt: string
  supersedesId?: string
}

export type DeterminationStoreState = {
  assertions: Array<DeterminationAssertion>
  revision: number
}

export type DeterminationWorkspace = {
  sourceZipPath: string
  sourceExists: boolean
  sourceWarnings: ReadonlyArray<string>
  documents: ReadonlyArray<SourceDocument>
  platPpps: ReadonlyArray<PlatPppRecord>
  assertions: ReadonlyArray<DeterminationAssertion>
}
