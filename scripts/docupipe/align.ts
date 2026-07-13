#!/usr/bin/env tsx
/**
 * DocuPipe alignment script.
 *
 *   yarn check:docupipe                # readonly drift report; exits non-zero on FAIL
 *   yarn sync:docupipe                 # additive-only: create missing items
 *   yarn sync:docupipe --dry-run       # show planned writes without applying
 *   yarn sync:docupipe --allow-update  # also overwrite existing items to match spec
 *   yarn sync:docupipe --register-webhook=https://abc.ngrok-free.dev/api/docupipe/webhook
 *
 * The diff/decision logic lives in `compareSpecToLive()` so it can be
 * unit-tested without touching the live DocuPipe API. The runner wraps
 * it with the actual list/create/update calls from src/server/docupipe.ts
 * and pretty-prints the report.
 *
 * Design notes:
 *
 * - **Additive-only by default.** Schema field *additions* (missing on live,
 *   no extras, no body rewrites) are applied by `sync` without a flag — that
 *   is how `line_items` and similar growth lands. DocuPipe cannot mutate a
 *   schema's `jsonSchema` in place (`POST /schema/edit` only renames /
 *   updates guidelines), so additive growth archives the old schema and
 *   creates a replacement with the same display name, then remaps the
 *   workflow. Overwrites that remove live-only fields or rewrite an existing
 *   property body are reported as WARN and skipped unless you pass
 *   `--allow-update`. Class description edits still require `--allow-update`.
 *
 * - **Workflow-class mapping is patched, not replaced.** The script reads
 *   the current `classToSchema` map and merges in any missing entries —
 *   it never deletes an existing mapping, even if the corresponding class
 *   has disappeared from the spec.
 *
 * - **Webhook registration is opt-in.** ngrok URLs change every session;
 *   re-registering the same URL+events is a no-op (Svix dedupes), but we
 *   still require an explicit `--register-webhook=<url>` flag so the
 *   typical `sync` run never hits Svix.
 */

import {
  createClass,
  createSchema,
  createWorkflow,
  editClass,
  editSchema,
  getSchema,
  listClasses,
  listSchemas,
  listWorkflows,
  registerWebhookEndpoint,
  updateWorkflow,
} from '#/server/docupipe'
import { SG_DREAM_DOCUPIPE_SPEC } from '#/server/docupipe-spec'

import type {
  ClassifyStandardizeStep,
  DocupipeClass,
  DocupipeSchema,
  DocupipeWorkflowSummary,
} from '#/server/docupipe'
import type { DocType } from '#/lib/sg-dream'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = 'pass' | 'info' | 'warn' | 'fail'

export type SyncAction =
  | { kind: 'createClass'; className: DocType; description: string }
  | {
      kind: 'editClass'
      classId: string
      className: DocType
      description: string
    }
  | {
      kind: 'createSchema'
      schemaName: string
      jsonSchema: Record<string, unknown>
      mappedTo: ReadonlyArray<DocType>
    }
  | {
      /**
       * DocuPipe's `POST /schema/edit` cannot change `jsonSchema` (only name /
       * description / guidelines). Body drift is fixed by archiving the old
       * schema, creating a replacement with the same display name, then
       * remapping the workflow onto the new schemaId.
       */
      kind: 'replaceSchema'
      oldSchemaId: string
      schemaName: string
      jsonSchema: Record<string, unknown>
      /** See editSchema.additive — additive replaces run under default sync. */
      additive: boolean
    }
  | {
      kind: 'createWorkflow'
      workflowName: string
      step: ClassifyStandardizeStep
    }
  | {
      kind: 'updateWorkflowMappings'
      workflowId: string
      additions: ReadonlyArray<{ classId: string; schemaId: string }>
      // The full step body to PUT back, with `classToSchema` already merged.
      stepWithMerge: ClassifyStandardizeStep
    }
  | {
      kind: 'updateWorkflowSettings'
      workflowId: string
      // Full step body with the spec-driven settings (stdVersion) applied and
      // the live mappings preserved.
      stepWithMerge: ClassifyStandardizeStep
      changes: ReadonlyArray<string>
    }

export type Issue = {
  severity: Severity
  message: string
  action?: SyncAction
}

export type CompareInput = {
  spec: typeof SG_DREAM_DOCUPIPE_SPEC
  liveClasses: ReadonlyArray<DocupipeClass>
  /** Each entry must have `jsonSchema` populated (use getSchema if list omits it). */
  liveSchemas: ReadonlyArray<DocupipeSchema>
  liveWorkflow: DocupipeWorkflowSummary | null
  workflowId: string
}

export type CompareResult = {
  issues: ReadonlyArray<Issue>
  failCount: number
  warnCount: number
}

// ---------------------------------------------------------------------------
// Pure diff
// ---------------------------------------------------------------------------

/**
 * Compare the spec to the current live workspace and return a structured
 * list of issues + the actions that would fix each one. Pure function:
 * everything it needs is in the input, no env reads, no fetches. The
 * runner below is responsible for fetching `liveClasses`, `liveSchemas`,
 * and `liveWorkflow` and for actually performing the actions.
 */
export function compareSpecToLive(input: CompareInput): CompareResult {
  const { spec, liveClasses, liveSchemas, liveWorkflow, workflowId } = input
  const issues: Array<Issue> = []

  // -- Classes ----------------------------------------------------------------
  const liveByName = new Map<string, DocupipeClass>()
  for (const c of liveClasses) liveByName.set(c.className, c)

  const presentNames: Array<DocType> = []
  const missingClasses: Array<{ className: DocType; description: string }> = []
  for (const want of spec.classes) {
    const live = liveByName.get(want.className)
    if (!live) {
      missingClasses.push({
        className: want.className,
        description: want.description,
      })
    } else {
      presentNames.push(want.className)
      if ((live.description ?? '').trim() !== want.description.trim()) {
        issues.push({
          severity: 'warn',
          message: `class '${want.className}' description differs from spec (live: ${truncate(
            live.description ?? '',
          )})`,
          action: {
            kind: 'editClass',
            classId: live.classId,
            className: want.className,
            description: want.description,
          },
        })
      }
    }
  }

  if (missingClasses.length === 0) {
    issues.push({
      severity: 'pass',
      message: `${spec.classes.length}/${spec.classes.length} classes present (${presentNames.join(' ')})`,
    })
  } else {
    for (const c of missingClasses) {
      issues.push({
        severity: 'fail',
        message: `class '${c.className}' missing on DocuPipe`,
        action: {
          kind: 'createClass',
          className: c.className,
          description: c.description,
        },
      })
    }
  }

  // -- Schemas ----------------------------------------------------------------
  // Prefer the live schema whose body is closest to the spec when duplicates
  // share a display name (can happen mid-replace before the old row is renamed).
  const liveSchemaByName = new Map<string, DocupipeSchema>()
  for (const wantSchema of spec.schemas) {
    const candidates = liveSchemas.filter(
      (s) => s.schemaName === wantSchema.schemaName,
    )
    const best = pickBestLiveSchema(candidates, wantSchema.jsonSchema)
    if (best) liveSchemaByName.set(wantSchema.schemaName, best)
  }
  // Also index any live schemas not in the spec (ignored for compare, but
  // keeps the map complete if callers inspect it).
  for (const s of liveSchemas) {
    if (!liveSchemaByName.has(s.schemaName)) liveSchemaByName.set(s.schemaName, s)
  }

  for (const wantSchema of spec.schemas) {
    const live = liveSchemaByName.get(wantSchema.schemaName)
    if (!live) {
      issues.push({
        severity: 'fail',
        message: `schema '${wantSchema.schemaName}' missing - needed for ${wantSchema.mappedTo.join(' ')}`,
        action: {
          kind: 'createSchema',
          schemaName: wantSchema.schemaName,
          jsonSchema: wantSchema.jsonSchema,
          mappedTo: wantSchema.mappedTo,
        },
      })
      continue
    }
    const drift = diffSchemaFields(live.jsonSchema, wantSchema.jsonSchema)
    if (
      drift.extraOnLive.length === 0 &&
      drift.missingOnLive.length === 0 &&
      drift.bodyChanged.length === 0
    ) {
      issues.push({
        severity: 'pass',
        message: `schema '${wantSchema.schemaName}' matches spec (${drift.specFieldCount} fields)`,
      })
    } else {
      const parts: Array<string> = []
      if (drift.extraOnLive.length > 0) {
        parts.push(
          `${drift.extraOnLive.length} extra (${drift.extraOnLive.join(', ')})`,
        )
      }
      if (drift.missingOnLive.length > 0) {
        parts.push(
          `${drift.missingOnLive.length} missing (${drift.missingOnLive.join(', ')})`,
        )
      }
      if (drift.bodyChanged.length > 0) {
        parts.push(
          `${drift.bodyChanged.length} body-changed (${drift.bodyChanged.join(', ')})`,
        )
      }
      // Additive = only new fields to push; no removals and no rewrites of
      // existing property definitions. Default sync applies these without
      // --allow-update so schema growth (e.g. adding line_items) lands safely.
      const additive =
        drift.missingOnLive.length > 0 &&
        drift.extraOnLive.length === 0 &&
        drift.bodyChanged.length === 0
      issues.push({
        severity: 'warn',
        message: `schema '${wantSchema.schemaName}' drift: ${parts.join('; ')}`,
        action: {
          kind: 'replaceSchema',
          oldSchemaId: live.schemaId,
          schemaName: wantSchema.schemaName,
          jsonSchema: wantSchema.jsonSchema,
          additive,
        },
      })
    }
  }

  // -- Workflow ---------------------------------------------------------------
  if (!liveWorkflow) {
    // Need a built step body so create can be one call.
    const proposedStep = buildClassifyStandardizeStep({
      spec,
      liveClasses,
      liveSchemas,
    })
    issues.push({
      severity: 'fail',
      message: `workflow '${workflowId || '<unset>'}' not found - run sync to create it (then update DOCUPIPE_WORKFLOW_ID in .env.local)`,
      action: {
        kind: 'createWorkflow',
        workflowName: spec.workflow.workflowName,
        step: proposedStep,
      },
    })
  } else {
    const merge = mergeWorkflowMappings({
      spec,
      liveClasses,
      liveSchemas,
      liveWorkflow,
    })

    // Engine-version drift. The spec's stdVersion is intent (e.g. the V3
    // extraction engine); a live workflow still on an older version gets a
    // FAIL with a settings update. When a mappings action is also firing, its
    // stepWithMerge already carries the spec stdVersion, so we skip the
    // second write and just report.
    const liveStd = (liveWorkflow.step as Partial<ClassifyStandardizeStep>)
      .stdVersion
    if (liveStd !== spec.workflow.stdVersion) {
      issues.push({
        severity: 'fail',
        message: `workflow stdVersion is ${liveStd ?? '<unset>'}; spec wants ${spec.workflow.stdVersion}`,
        action:
          merge.additions.length > 0
            ? undefined
            : {
                kind: 'updateWorkflowSettings',
                workflowId: liveWorkflow.workflowId,
                stepWithMerge: merge.stepWithMerge,
                changes: [
                  `stdVersion ${liveStd ?? '<unset>'} → ${spec.workflow.stdVersion}`,
                ],
              },
      })
    }

    if (merge.additions.length === 0 && merge.unmappableClasses.length === 0) {
      issues.push({
        severity: 'pass',
        message: `workflow classToSchema covers ${merge.coveredCount}/${spec.classes.length} classes`,
      })
    } else {
      if (merge.additions.length > 0) {
        const names = merge.additions.map((a) => a.className).join(' ')
        issues.push({
          severity: 'fail',
          message: `workflow classToSchema covers ${merge.coveredCount}/${spec.classes.length} classes; missing ${names}`,
          action: {
            kind: 'updateWorkflowMappings',
            workflowId: liveWorkflow.workflowId,
            additions: merge.additions.map((a) => ({
              classId: a.classId,
              schemaId: a.schemaId,
            })),
            stepWithMerge: merge.stepWithMerge,
          },
        })
      }
      if (merge.unmappableClasses.length > 0) {
        // These are classes the spec wants mapped but we can't compute the
        // mapping for yet — usually because the class or schema is missing
        // on the live workspace. They'll resolve on the next sync run after
        // the createClass / createSchema actions execute.
        issues.push({
          severity: 'info',
          message: `workflow mappings deferred until classes/schemas exist: ${merge.unmappableClasses.join(' ')}`,
        })
      }
    }
  }

  // -- Webhook (informational) -----------------------------------------------
  issues.push({
    severity: 'info',
    message: `webhook endpoints: cannot enumerate via API; use --register-webhook=<url> to (re)register, or verify in DocuPipe Svix portal`,
  })

  const failCount = issues.filter((i) => i.severity === 'fail').length
  const warnCount = issues.filter((i) => i.severity === 'warn').length
  return { issues, failCount, warnCount }
}

// ---------------------------------------------------------------------------
// Diff helpers (pure, exported for tests)
// ---------------------------------------------------------------------------

/**
 * When multiple live schemas share a display name (mid-replace), pick the
 * body closest to the wanted spec. Falls back to the first row when no want
 * schema is supplied.
 */
export function pickBestLiveSchema(
  candidates: ReadonlyArray<DocupipeSchema>,
  wantJsonSchema?: Record<string, unknown>,
): DocupipeSchema | undefined {
  if (candidates.length === 0) return undefined
  const first = candidates[0]
  if (!wantJsonSchema) return first
  let best = first
  let bestScore = Number.POSITIVE_INFINITY
  for (const live of candidates) {
    const d = diffSchemaFields(live.jsonSchema, wantJsonSchema)
    const score =
      d.missingOnLive.length + d.bodyChanged.length + d.extraOnLive.length
    if (score < bestScore) {
      best = live
      bestScore = score
    }
  }
  return best
}

export function diffSchemaFields(
  live: Record<string, unknown> | null | undefined,
  want: Record<string, unknown>,
): {
  specFieldCount: number
  extraOnLive: ReadonlyArray<string>
  missingOnLive: ReadonlyArray<string>
  /** Spec fields present on live whose property definition body differs. */
  bodyChanged: ReadonlyArray<string>
} {
  const wantProps =
    (want.properties as Record<string, unknown> | undefined) ?? {}
  const liveProps =
    (live?.properties as Record<string, unknown> | undefined) ?? {}
  const wantFields = Object.keys(wantProps).filter(
    (k) => !k.endsWith('_confidence'),
  )
  const liveFields = Object.keys(liveProps).filter(
    (k) => !k.endsWith('_confidence'),
  )
  const wantSet = new Set(wantFields)
  const liveSet = new Set(liveFields)
  const bodyChanged: Array<string> = []
  for (const name of wantFields) {
    if (!liveSet.has(name)) continue
    if (!stableJsonEqual(liveProps[name], wantProps[name])) {
      bodyChanged.push(name)
    }
  }
  return {
    specFieldCount: wantFields.length,
    extraOnLive: liveFields.filter((f) => !wantSet.has(f)),
    missingOnLive: wantFields.filter((f) => !liveSet.has(f)),
    bodyChanged,
  }
}

/** Canonical JSON equality for schema property bodies (key-order insensitive). */
function stableJsonEqual(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(structuralSchemaFingerprint(a)) ===
    JSON.stringify(structuralSchemaFingerprint(b))
  )
}

/**
 * Fingerprint a JSON-Schema property for drift detection. Ignores prose
 * (`description`, `examples`) so live DocuPipe copy-edits don't force
 * `--allow-update`; still catches type / items / nested-shape changes
 * (e.g. `line_items` row columns).
 */
function structuralSchemaFingerprint(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(structuralSchemaFingerprint)
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      if (key === 'description' || key === 'examples') continue
      out[key] = structuralSchemaFingerprint(obj[key])
    }
    return out
  }
  return value
}

/**
 * Compute the patched `classToSchema` map and a buildable step body so the
 * align script can issue a single `updateWorkflow` call. Never deletes
 * existing entries from the live mapping — only adds missing ones the
 * spec calls for.
 */
export function mergeWorkflowMappings(input: {
  spec: typeof SG_DREAM_DOCUPIPE_SPEC
  liveClasses: ReadonlyArray<DocupipeClass>
  liveSchemas: ReadonlyArray<DocupipeSchema>
  liveWorkflow: DocupipeWorkflowSummary
}): {
  additions: ReadonlyArray<{
    className: DocType
    classId: string
    schemaId: string
  }>
  unmappableClasses: ReadonlyArray<DocType>
  coveredCount: number
  stepWithMerge: ClassifyStandardizeStep
} {
  const { spec, liveClasses, liveSchemas, liveWorkflow } = input
  const classByName = new Map(liveClasses.map((c) => [c.className, c.classId]))
  const schemaByName = new Map<string, string>()
  for (const want of spec.schemas) {
    const candidates = liveSchemas.filter((s) => s.schemaName === want.schemaName)
    const best = pickBestLiveSchema(candidates, want.jsonSchema)
    if (best) schemaByName.set(want.schemaName, best.schemaId)
  }
  for (const s of liveSchemas) {
    if (!schemaByName.has(s.schemaName)) schemaByName.set(s.schemaName, s.schemaId)
  }
  const existingStep = liveWorkflow.step as Partial<ClassifyStandardizeStep>
  const liveMap: Record<string, string> = {
    ...(existingStep.classToSchema ?? {}),
  }
  // Coverage of the *live* state before any merge; surfaced in messages so
  // "covers N/8" reflects what DocuPipe currently has, not what we'd write.
  const coveredCountBefore = countCoveredClasses({
    spec,
    classByName,
    classToSchema: liveMap,
  })
  const mergedMap: Record<string, string> = { ...liveMap }

  const desired = new Map<DocType, string>()
  for (const schema of spec.schemas) {
    const schemaId = schemaByName.get(schema.schemaName)
    if (!schemaId) continue
    for (const className of schema.mappedTo) {
      desired.set(className, schemaId)
    }
  }

  const additions: Array<{
    className: DocType
    classId: string
    schemaId: string
  }> = []
  const unmappable: Array<DocType> = []
  for (const [className, schemaId] of desired) {
    const classId = classByName.get(className)
    if (!classId) {
      unmappable.push(className)
      continue
    }
    if (mergedMap[classId] !== schemaId) {
      additions.push({ className, classId, schemaId })
      mergedMap[classId] = schemaId
    }
  }

  // Schemas that exist in spec but don't yet have a row in the live workspace
  // also block mapping for any class the spec wants pointed at them.
  for (const schema of spec.schemas) {
    if (!schemaByName.has(schema.schemaName)) {
      for (const className of schema.mappedTo) {
        if (!unmappable.includes(className)) unmappable.push(className)
      }
    }
  }

  // `coveredCountBefore` reflects what DocuPipe currently has, so the
  // "covers N/8" message is a snapshot of reality. The merged map drives
  // the actual write.
  const classIds = spec.classes
    .map((c) => classByName.get(c.className))
    .filter((id): id is string => Boolean(id))

  const stepWithMerge: ClassifyStandardizeStep = {
    ...existingStep,
    classIds,
    classToSchema: mergedMap,
    multiClass: existingStep.multiClass ?? spec.workflow.multiClass,
    includeUnknown: existingStep.includeUnknown ?? spec.workflow.includeUnknown,
    // stdVersion is spec-driven (unlike the merges above, which preserve live
    // state): the extraction engine version is deliberate configuration, so
    // any workflow write carries the spec's value.
    stdVersion: spec.workflow.stdVersion,
  }

  return {
    additions,
    unmappableClasses: unmappable,
    coveredCount: coveredCountBefore,
    stepWithMerge,
  }
}

function countCoveredClasses(input: {
  spec: typeof SG_DREAM_DOCUPIPE_SPEC
  classByName: Map<string, string>
  classToSchema: Record<string, string>
}): number {
  let n = 0
  for (const c of input.spec.classes) {
    const classId = input.classByName.get(c.className)
    if (classId && input.classToSchema[classId]) n += 1
  }
  return n
}

function buildClassifyStandardizeStep(input: {
  spec: typeof SG_DREAM_DOCUPIPE_SPEC
  liveClasses: ReadonlyArray<DocupipeClass>
  liveSchemas: ReadonlyArray<DocupipeSchema>
}): ClassifyStandardizeStep {
  const classByName = new Map(
    input.liveClasses.map((c) => [c.className, c.classId]),
  )
  const schemaByName = new Map<string, string>()
  for (const schema of input.spec.schemas) {
    const candidates = input.liveSchemas.filter(
      (s) => s.schemaName === schema.schemaName,
    )
    const best = pickBestLiveSchema(candidates, schema.jsonSchema)
    if (best) schemaByName.set(schema.schemaName, best.schemaId)
  }
  const classToSchema: Record<string, string> = {}
  for (const schema of input.spec.schemas) {
    const schemaId = schemaByName.get(schema.schemaName)
    if (!schemaId) continue
    for (const className of schema.mappedTo) {
      const classId = classByName.get(className)
      if (classId) classToSchema[classId] = schemaId
    }
  }
  const classIds = input.spec.classes
    .map((c) => classByName.get(c.className))
    .filter((id): id is string => Boolean(id))
  return {
    classIds,
    classToSchema,
    multiClass: input.spec.workflow.multiClass,
    includeUnknown: input.spec.workflow.includeUnknown,
    stdVersion: input.spec.workflow.stdVersion,
  }
}

function truncate(s: string, max = 60): string {
  if (s.length <= max) return s
  return `${s.slice(0, max - 1)}…`
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

type Args = {
  command: 'check' | 'sync'
  dryRun: boolean
  allowUpdate: boolean
  registerWebhook?: string
}

function parseArgs(argv: ReadonlyArray<string>): Args {
  const [first, ...rest] = argv
  if (first !== 'check' && first !== 'sync') {
    throw new Error(
      `Usage: align.ts <check|sync> [--dry-run] [--allow-update] [--register-webhook=<url>]`,
    )
  }
  let dryRun = false
  let allowUpdate = false
  let registerWebhook: string | undefined
  for (const arg of rest) {
    if (arg === '--dry-run') dryRun = true
    else if (arg === '--allow-update') allowUpdate = true
    else if (arg.startsWith('--register-webhook=')) {
      registerWebhook = arg.slice('--register-webhook='.length)
    } else {
      throw new Error(`Unknown flag: ${arg}`)
    }
  }
  return { command: first, dryRun, allowUpdate, registerWebhook }
}

const COLOR = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
}

function tag(severity: Severity): string {
  switch (severity) {
    case 'pass':
      return `${COLOR.green}[PASS]${COLOR.reset}`
    case 'fail':
      return `${COLOR.red}[FAIL]${COLOR.reset}`
    case 'warn':
      return `${COLOR.yellow}[WARN]${COLOR.reset}`
    case 'info':
      return `${COLOR.cyan}[INFO]${COLOR.reset}`
  }
}

async function loadLive(workflowId: string): Promise<{
  liveClasses: ReadonlyArray<DocupipeClass>
  liveSchemas: ReadonlyArray<DocupipeSchema>
  liveWorkflow: DocupipeWorkflowSummary | null
}> {
  const [liveClasses, schemaList, workflows] = await Promise.all([
    listClasses(),
    listSchemas(),
    listWorkflows(),
  ])
  // Some DocuPipe deployments omit `jsonSchema` from the list endpoint to
  // keep the response small. Backfill via /schema/{id} so the diff has
  // real fields to compare. Only fetched once per schema, on demand.
  const liveSchemas = await Promise.all(
    schemaList.map(async (s) => {
      if (s.jsonSchema && Object.keys(s.jsonSchema).length > 0) return s
      try {
        const full = await getSchema(s.schemaId)
        return { ...s, jsonSchema: full.jsonSchema }
      } catch {
        return s
      }
    }),
  )
  const liveWorkflow =
    workflows.find((w) => w.workflowId === workflowId) ?? null
  return { liveClasses, liveSchemas, liveWorkflow }
}

function describeAction(a: SyncAction): string {
  switch (a.kind) {
    case 'createClass':
      return `create class ${a.className}`
    case 'editClass':
      return `edit class ${a.className} (${a.classId})`
    case 'createSchema':
      return `create schema '${a.schemaName}' (mapped to ${a.mappedTo.join(' ')})`
    case 'replaceSchema':
      return `replace schema '${a.schemaName}' (${a.oldSchemaId} → new)`
    case 'createWorkflow':
      return `create workflow '${a.workflowName}'`
    case 'updateWorkflowMappings': {
      const pairs = a.additions
        .map((p) => `${p.classId}→${p.schemaId}`)
        .join(', ')
      return `add workflow mappings: ${pairs}`
    }
    case 'updateWorkflowSettings':
      return `update workflow settings: ${a.changes.join(', ')}`
  }
}

async function applyAction(a: SyncAction): Promise<string> {
  switch (a.kind) {
    case 'createClass': {
      const r = await createClass({
        className: a.className,
        description: a.description,
      })
      return `created class ${r.className} (${r.classId})`
    }
    case 'editClass': {
      await editClass({
        classId: a.classId,
        className: a.className,
        description: a.description,
      })
      return `edited class ${a.className}`
    }
    case 'createSchema': {
      const r = await createSchema({
        schemaName: a.schemaName,
        jsonSchema: a.jsonSchema,
      })
      return `created schema '${r.schemaName}' (${r.schemaId})`
    }
    case 'replaceSchema': {
      // Archive the old row so the display name is free, then create the
      // replacement. Workflow remapping runs in the post-structural refresh.
      await editSchema({
        schemaId: a.oldSchemaId,
        schemaName: `${a.schemaName} (superseded ${a.oldSchemaId})`,
      })
      const r = await createSchema({
        schemaName: a.schemaName,
        jsonSchema: a.jsonSchema,
      })
      return `replaced schema '${a.schemaName}' (${a.oldSchemaId} → ${r.schemaId})`
    }
    case 'createWorkflow': {
      const r = await createWorkflow({
        workflowName: a.workflowName,
        classifyStandardizeStep: a.step,
      })
      return `created workflow '${a.workflowName}' (${r.workflowId}) — set DOCUPIPE_WORKFLOW_ID=${r.workflowId} in .env.local`
    }
    case 'updateWorkflowMappings': {
      await updateWorkflow(a.workflowId, {
        classifyStandardizeStep: a.stepWithMerge,
      })
      return `updated workflow ${a.workflowId} mappings (+${a.additions.length})`
    }
    case 'updateWorkflowSettings': {
      await updateWorkflow(a.workflowId, {
        classifyStandardizeStep: a.stepWithMerge,
      })
      return `updated workflow ${a.workflowId} settings (${a.changes.join(', ')})`
    }
  }
}

function shouldSkipAction(a: SyncAction, allowUpdate: boolean): boolean {
  if (allowUpdate) return false
  if (a.kind === 'editClass') return true
  // Additive schema growth (new fields only) is safe under the default
  // additive-only sync policy; body rewrites / removals still need opt-in.
  if (a.kind === 'replaceSchema') return !a.additive
  return false
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))
  const env = process.env
  if (!env.DOCUPIPE_API_KEY) {
    console.error('DOCUPIPE_API_KEY is not set. Add it to .env.local.')
    return 1
  }
  const workflowId = env.DOCUPIPE_WORKFLOW_ID ?? ''

  console.log(
    `${COLOR.bold}Checking DocuPipe (workflow: ${workflowId || '<unset>'}) against SG DREAM spec...${COLOR.reset}`,
  )
  console.log(`  ${tag('pass')} api key valid (loaded from env)`)

  const live = await loadLive(workflowId)
  const result = compareSpecToLive({
    spec: SG_DREAM_DOCUPIPE_SPEC,
    workflowId,
    ...live,
  })

  for (const issue of result.issues) {
    console.log(`  ${tag(issue.severity)} ${issue.message}`)
  }

  if (args.command === 'check') {
    console.log('')
    if (result.failCount === 0 && result.warnCount === 0) {
      console.log(`${COLOR.green}aligned. no drift detected.${COLOR.reset}`)
      return 0
    }
    const summary = `${result.failCount} fail, ${result.warnCount} warn`
    if (result.failCount > 0) {
      console.log(
        `${COLOR.red}${summary}.${COLOR.reset} Run \`yarn sync:docupipe\` to fix.`,
      )
      return 1
    }
    console.log(
      `${COLOR.yellow}${summary}.${COLOR.reset} Pass --allow-update to overwrite drifted items.`,
    )
    return 0
  }

  // sync
  console.log('')
  console.log(
    `${COLOR.bold}Sync plan:${COLOR.reset}` +
      (args.dryRun ? ` ${COLOR.cyan}(dry-run)${COLOR.reset}` : '') +
      (args.allowUpdate ? ` ${COLOR.cyan}(--allow-update)${COLOR.reset}` : ''),
  )

  const planned: Array<SyncAction> = []
  for (const issue of result.issues) {
    if (!issue.action) continue
    if (shouldSkipAction(issue.action, args.allowUpdate)) {
      console.log(
        `  ${tag('info')} skipped (additive-only): ${describeAction(issue.action)}`,
      )
      continue
    }
    planned.push(issue.action)
  }

  if (planned.length === 0 && !args.registerWebhook) {
    console.log(`  ${tag('pass')} nothing to do`)
    return 0
  }

  for (const action of planned) {
    console.log(`  • ${describeAction(action)}`)
  }
  if (args.registerWebhook) {
    console.log(`  • register webhook ${args.registerWebhook}`)
  }

  if (args.dryRun) {
    console.log('')
    console.log(`${COLOR.cyan}dry-run: no writes performed.${COLOR.reset}`)
    return 0
  }

  console.log('')
  console.log(`${COLOR.bold}Applying...${COLOR.reset}`)

  // Order matters: classes -> schemas -> workflow mappings -> webhook.
  // Within sync, workflow mappings actions emitted by compareSpecToLive
  // were computed from the *current* live state; once we create new
  // classes/schemas, those mappings won't include the freshly created
  // pairings. We refetch + recompute after structural changes complete.
  const structuralActions = planned.filter(
    (a) =>
      a.kind === 'createClass' ||
      a.kind === 'createSchema' ||
      a.kind === 'editClass' ||
      a.kind === 'replaceSchema',
  )
  const workflowActions = planned.filter(
    (a) =>
      a.kind === 'createWorkflow' ||
      a.kind === 'updateWorkflowMappings' ||
      a.kind === 'updateWorkflowSettings',
  )

  for (const action of structuralActions) {
    try {
      const msg = await applyAction(action)
      console.log(`  ${tag('pass')} ${msg}`)
    } catch (err) {
      console.error(
        `  ${tag('fail')} ${describeAction(action)} — ${formatError(err)}`,
      )
      return 1
    }
  }

  // After any structural change, refetch and recompute the workflow plan.
  // Mappings that were "deferred" during the first compare (because the
  // target schema/class didn't exist yet) become real actions now. Always
  // refresh — even if the first round had no workflow actions — so newly
  // possible mappings get picked up.
  if (structuralActions.length > 0) {
    const refreshed = await loadLive(workflowId)
    const recomputed = compareSpecToLive({
      spec: SG_DREAM_DOCUPIPE_SPEC,
      workflowId,
      ...refreshed,
    })
    workflowActions.length = 0
    for (const issue of recomputed.issues) {
      if (
        issue.action &&
        (issue.action.kind === 'createWorkflow' ||
          issue.action.kind === 'updateWorkflowMappings' ||
          issue.action.kind === 'updateWorkflowSettings')
      ) {
        workflowActions.push(issue.action)
      }
    }
    if (workflowActions.length > 0) {
      console.log('')
      console.log(
        `${COLOR.bold}Recomputed workflow plan after structural changes:${COLOR.reset}`,
      )
      for (const action of workflowActions) {
        console.log(`  • ${describeAction(action)}`)
      }
    }
  }

  for (const action of workflowActions) {
    try {
      const msg = await applyAction(action)
      console.log(`  ${tag('pass')} ${msg}`)
    } catch (err) {
      console.error(
        `  ${tag('fail')} ${describeAction(action)} — ${formatError(err)}`,
      )
      return 1
    }
  }

  if (args.registerWebhook) {
    try {
      await registerWebhookEndpoint({
        url: args.registerWebhook,
        subscribedEvents: SG_DREAM_DOCUPIPE_SPEC.webhookEvents,
      })
      console.log(`  ${tag('pass')} registered webhook ${args.registerWebhook}`)
    } catch (err) {
      console.error(`  ${tag('fail')} register webhook — ${formatError(err)}`)
      return 1
    }
  }

  console.log('')
  console.log(
    `${COLOR.green}sync complete.${COLOR.reset} Re-run \`yarn check:docupipe\` to verify.`,
  )
  return 0
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// ---------------------------------------------------------------------------
// Entry point — only run when invoked as a script, not when imported by tests.
// ---------------------------------------------------------------------------

const invokedDirectly =
  typeof process.argv[1] === 'string' && /align\.ts$/.test(process.argv[1])

if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      console.error(err)
      process.exit(1)
    },
  )
}
