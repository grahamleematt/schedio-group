import { describe, expect, it } from 'vitest'

import {
  compareSpecToLive,
  diffSchemaFields,
  mergeWorkflowMappings,
} from './align'
import type { CompareInput } from './align'

import { SG_DREAM_DOCUPIPE_SPEC } from '../../src/server/docupipe-spec'
import type {
  DocupipeClass,
  DocupipeSchema,
  DocupipeWorkflowSummary,
} from '../../src/server/docupipe'

const ALL_CLASSES: ReadonlyArray<DocupipeClass> =
  SG_DREAM_DOCUPIPE_SPEC.classes.map((c, i) => ({
    classId: `cid_${c.className.toLowerCase()}_${i}`,
    className: c.className,
    description: c.description,
  }))

const INV_SCHEMA = SG_DREAM_DOCUPIPE_SPEC.schemas.find(
  (s) => s.schemaName === 'SG DREAM INV',
)!
const PA_SCHEMA = SG_DREAM_DOCUPIPE_SPEC.schemas.find(
  (s) => s.schemaName === 'SG DREAM PA',
)!
const UNIVERSAL_SCHEMA = SG_DREAM_DOCUPIPE_SPEC.schemas.find(
  (s) => s.schemaName === 'SG DREAM Universal',
)!

const ALL_SCHEMAS: ReadonlyArray<DocupipeSchema> = [
  {
    schemaId: 'sid_inv',
    schemaName: INV_SCHEMA.schemaName,
    jsonSchema: INV_SCHEMA.jsonSchema,
  },
  {
    schemaId: 'sid_pa',
    schemaName: PA_SCHEMA.schemaName,
    jsonSchema: PA_SCHEMA.jsonSchema,
  },
  {
    schemaId: 'sid_universal',
    schemaName: UNIVERSAL_SCHEMA.schemaName,
    jsonSchema: UNIVERSAL_SCHEMA.jsonSchema,
  },
]

function classId(name: string): string {
  return ALL_CLASSES.find((c) => c.className === name)!.classId
}

function fullyMappedWorkflow(): DocupipeWorkflowSummary {
  const classToSchema: Record<string, string> = {}
  for (const schema of SG_DREAM_DOCUPIPE_SPEC.schemas) {
    const live = ALL_SCHEMAS.find((s) => s.schemaName === schema.schemaName)!
    for (const className of schema.mappedTo) {
      classToSchema[classId(className)] = live.schemaId
    }
  }
  return {
    workflowId: 'wf_test',
    workflowName: 'SG DREAM Ingest',
    stepType: 'classifyStandardize',
    step: {
      classIds: ALL_CLASSES.map((c) => c.classId),
      classToSchema,
      multiClass: false,
      includeUnknown: true,
      stdVersion: SG_DREAM_DOCUPIPE_SPEC.workflow.stdVersion,
    },
  }
}

function baseInput(overrides: Partial<CompareInput> = {}): CompareInput {
  return {
    spec: SG_DREAM_DOCUPIPE_SPEC,
    liveClasses: ALL_CLASSES,
    liveSchemas: ALL_SCHEMAS,
    liveWorkflow: fullyMappedWorkflow(),
    workflowId: 'wf_test',
    ...overrides,
  }
}

describe('diffSchemaFields', () => {
  it('treats _confidence siblings as paired with their base field', () => {
    const result = diffSchemaFields(
      {
        properties: {
          vendor_name: {},
          vendor_name_confidence: {},
        },
      },
      {
        properties: {
          vendor_name: {},
          vendor_name_confidence: {},
        },
      },
    )
    expect(result).toEqual({
      specFieldCount: 1,
      extraOnLive: [],
      missingOnLive: [],
    })
  })

  it('reports extra live fields and missing spec fields', () => {
    const result = diffSchemaFields(
      {
        properties: {
          vendor_name: {},
          po_number: {},
          line_item_count: {},
        },
      },
      { properties: { vendor_name: {}, document_number: {} } },
    )
    expect(result.extraOnLive).toEqual(['po_number', 'line_item_count'])
    expect(result.missingOnLive).toEqual(['document_number'])
  })

  it('handles a missing live schema body', () => {
    const result = diffSchemaFields(null, {
      properties: { vendor_name: {} },
    })
    expect(result.missingOnLive).toEqual(['vendor_name'])
  })
})

describe('compareSpecToLive', () => {
  it('reports PASS for a fully-aligned workspace', () => {
    const result = compareSpecToLive(baseInput())
    expect(result.failCount).toBe(0)
    expect(result.warnCount).toBe(0)
    const messages = result.issues.map((i) => `${i.severity}:${i.message}`)
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^pass:8\/8 classes/),
        expect.stringMatching(/^pass:schema 'SG DREAM INV' matches/),
        expect.stringMatching(/^pass:schema 'SG DREAM Universal' matches/),
        expect.stringMatching(/^pass:workflow classToSchema covers 8\/8/),
      ]),
    )
  })

  it('reports PA + universal schemas missing + 7 unmapped classes when only INV exists', () => {
    // Drift scenario: only SG DREAM INV exists, only INV is mapped.
    const liveSchemas: ReadonlyArray<DocupipeSchema> = [
      {
        schemaId: 'sid_inv',
        schemaName: INV_SCHEMA.schemaName,
        jsonSchema: INV_SCHEMA.jsonSchema,
      },
    ]
    const liveWorkflow: DocupipeWorkflowSummary = {
      workflowId: 'wf_test',
      stepType: 'classifyStandardize',
      step: {
        classIds: ALL_CLASSES.map((c) => c.classId),
        classToSchema: { [classId('INV')]: 'sid_inv' },
        multiClass: false,
        includeUnknown: true,
        stdVersion: SG_DREAM_DOCUPIPE_SPEC.workflow.stdVersion,
      },
    }
    const result = compareSpecToLive(baseInput({ liveSchemas, liveWorkflow }))

    // Two structural FAILs: the missing PA and universal schemas (in spec
    // order). Workflow mappings can't be added until the schemas exist, so
    // they surface as a deferred INFO note (sync's two-phase apply re-derives
    // them after the schemas are created).
    const fails = result.issues.filter((i) => i.severity === 'fail')
    expect(fails.map((i) => i.message)).toEqual([
      expect.stringContaining("'SG DREAM PA' missing"),
      expect.stringContaining("'SG DREAM Universal' missing"),
    ])
    const deferred = result.issues.find(
      (i) =>
        i.severity === 'info' &&
        i.message.includes('workflow mappings deferred'),
    )
    expect(deferred).toBeDefined()
    // Names of all 7 non-INV classes appear in the deferred info.
    for (const cls of ['CTR', 'TO', 'CO', 'PA', 'POP', 'LSP', 'CD']) {
      expect(deferred!.message).toContain(cls)
    }
  })

  it('emits createSchema actions including the right mappedTo list', () => {
    const result = compareSpecToLive(
      baseInput({
        liveSchemas: [
          {
            schemaId: 'sid_inv',
            schemaName: INV_SCHEMA.schemaName,
            jsonSchema: INV_SCHEMA.jsonSchema,
          },
        ],
      }),
    )
    const action = result.issues
      .map((i) => i.action)
      .find(
        (a) =>
          a?.kind === 'createSchema' && a.schemaName === 'SG DREAM Universal',
      )
    if (!action || action.kind !== 'createSchema') {
      throw new Error('expected a createSchema action for SG DREAM Universal')
    }
    expect(action.mappedTo).toEqual(['CTR', 'TO', 'CO', 'POP', 'LSP', 'CD'])
  })

  it('flags WARN with editSchema action when a known schema has extra fields', () => {
    // Drop one field, add an extra — simulates a schema that drifted.
    const driftedInv = {
      ...INV_SCHEMA.jsonSchema,
      properties: {
        ...(INV_SCHEMA.jsonSchema as { properties: Record<string, unknown> })
          .properties,
        rogue_field: { type: 'string' },
      },
    }
    const result = compareSpecToLive(
      baseInput({
        liveSchemas: [
          {
            schemaId: 'sid_inv',
            schemaName: INV_SCHEMA.schemaName,
            jsonSchema: driftedInv,
          },
          ALL_SCHEMAS[1],
        ],
      }),
    )
    const warn = result.issues.find(
      (i) =>
        i.severity === 'warn' && i.message.includes("'SG DREAM INV' drift"),
    )
    expect(warn).toBeDefined()
    expect(warn!.action?.kind).toBe('editSchema')
    expect(warn!.message).toContain('rogue_field')
  })

  it('flags stdVersion drift with an updateWorkflowSettings action', () => {
    // Live workflow is fully mapped but still on the old V2 engine.
    const liveWorkflow = fullyMappedWorkflow()
    liveWorkflow.step = { ...liveWorkflow.step, stdVersion: 2.2 }
    const result = compareSpecToLive(baseInput({ liveWorkflow }))
    const drift = result.issues.find(
      (i) => i.severity === 'fail' && i.message.includes('stdVersion'),
    )
    expect(drift).toBeDefined()
    expect(drift!.action?.kind).toBe('updateWorkflowSettings')
    if (drift!.action?.kind !== 'updateWorkflowSettings') return
    expect(drift!.action.stepWithMerge.stdVersion).toBe(
      SG_DREAM_DOCUPIPE_SPEC.workflow.stdVersion,
    )
    // Mappings were already complete, so the settings write is the only
    // workflow action.
    expect(drift!.action.changes[0]).toContain('2.2')
  })

  it('defers the stdVersion write to the mappings action when both drift', () => {
    // Live workflow on 2.2 AND missing a mapping: the mappings action's step
    // body already carries the spec stdVersion, so no second action fires.
    const liveWorkflow = fullyMappedWorkflow()
    const partialMap = {
      ...(liveWorkflow.step.classToSchema as Record<string, string>),
    }
    delete partialMap[classId('POP')]
    liveWorkflow.step = {
      ...liveWorkflow.step,
      classToSchema: partialMap,
      stdVersion: 2.2,
    }
    const result = compareSpecToLive(baseInput({ liveWorkflow }))
    const drift = result.issues.find(
      (i) => i.severity === 'fail' && i.message.includes('stdVersion'),
    )
    expect(drift).toBeDefined()
    expect(drift!.action).toBeUndefined()
    const mappings = result.issues.find(
      (i) => i.action?.kind === 'updateWorkflowMappings',
    )
    expect(mappings).toBeDefined()
    if (mappings!.action?.kind !== 'updateWorkflowMappings') return
    expect(mappings!.action.stepWithMerge.stdVersion).toBe(
      SG_DREAM_DOCUPIPE_SPEC.workflow.stdVersion,
    )
  })

  it('flags FAIL when the workflow is missing entirely', () => {
    const result = compareSpecToLive(baseInput({ liveWorkflow: null }))
    const wf = result.issues.find(
      (i) => i.severity === 'fail' && i.message.includes('not found'),
    )
    expect(wf).toBeDefined()
    expect(wf!.action?.kind).toBe('createWorkflow')
  })

  it('always appends a single info note about webhook endpoints', () => {
    const result = compareSpecToLive(baseInput())
    const infos = result.issues.filter(
      (i) => i.severity === 'info' && i.message.includes('webhook'),
    )
    expect(infos).toHaveLength(1)
  })
})

describe('mergeWorkflowMappings', () => {
  it('only adds missing entries; never deletes existing ones', () => {
    const customMapping: Record<string, string> = {
      [classId('INV')]: 'sid_inv',
      // A stale mapping for a removed-from-spec classId; should remain.
      cid_legacy: 'sid_legacy',
    }
    const live: DocupipeWorkflowSummary = {
      workflowId: 'wf_test',
      step: {
        classToSchema: customMapping,
        multiClass: false,
        includeUnknown: true,
        stdVersion: 2.2,
      },
    }
    const merge = mergeWorkflowMappings({
      spec: SG_DREAM_DOCUPIPE_SPEC,
      liveClasses: ALL_CLASSES,
      liveSchemas: ALL_SCHEMAS,
      liveWorkflow: live,
    })
    expect(merge.stepWithMerge.classToSchema['cid_legacy']).toBe('sid_legacy')
    expect(merge.additions.length).toBe(7)
    // coveredCount reflects the *live* state before the merge so the
    // operator-facing message is a snapshot of reality, not the plan.
    expect(merge.coveredCount).toBe(1)
  })
})
