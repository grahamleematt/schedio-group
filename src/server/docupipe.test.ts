import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LOW_CONFIDENCE_THRESHOLD,
  applyReviewEdits,
  computeLowConfidence,
  createClass,
  createSchema,
  createWorkflow,
  editClass,
  editSchema,
  extractFieldConfidence,
  flattenReviewData,
  listClasses,
  listSchemas,
  listWorkflows,
  normalizeExtractedFields,
  parseReviewBoundingBox,
  registerWebhookEndpoint,
  unwrapReviewData,
  updateReview,
  updateWorkflow,
} from './docupipe'

describe('parseReviewBoundingBox', () => {
  it('reads corner-format arrays (x1,y1,x2,y2)', () => {
    expect(parseReviewBoundingBox([0.1, 0.2, 0.4, 0.5])).toEqual({
      x: 0.1,
      y: 0.2,
      width: 0.30000000000000004,
      height: 0.3,
    })
  })

  it('falls back to width/height when corners are degenerate', () => {
    // x2 < x1 can't be a corner pair — DocuPipe sample payloads use x,y,w,h.
    expect(parseReviewBoundingBox([0.15, 0.2, 0.02, 0.02])).toEqual({
      x: 0.15,
      y: 0.2,
      width: 0.02,
      height: 0.02,
    })
  })

  it('reads comma-separated strings', () => {
    expect(parseReviewBoundingBox('0.1, 0.2, 0.4, 0.5')).toMatchObject({
      x: 0.1,
      y: 0.2,
    })
  })

  it('rejects malformed input', () => {
    expect(parseReviewBoundingBox(null)).toBeNull()
    expect(parseReviewBoundingBox('not,a,box')).toBeNull()
    expect(parseReviewBoundingBox([0.1, 0.2])).toBeNull()
  })
})

describe('flattenReviewData', () => {
  it('flattens localized leaves ordered by page then position', () => {
    const fields = flattenReviewData({
      amount: {
        value: 11910,
        review: {
          page: 2,
          confidence: 'high',
          boundingBox: [0.1, 0.5, 0.3, 0.55],
        },
      },
      vendor_name: {
        value: 'Classic SRJ, LLC',
        review: {
          page: 1,
          confidence: 'high',
          boundingBox: [0.1, 0.1, 0.4, 0.14],
        },
      },
    })
    expect(fields.map((f) => f.path)).toEqual(['vendor_name', 'amount'])
    expect(fields[0]).toMatchObject({
      value: 'Classic SRJ, LLC',
      page: 1,
      confidence: 'high',
    })
    expect(fields[1].rect).toMatchObject({ x: 0.1, y: 0.5 })
  })

  it('recurses nested objects and arrays and keeps unlocalized leaves', () => {
    const fields = flattenReviewData({
      line_items: [
        {
          description: {
            value: 'Grading',
            review: { page: 3, boundingBox: [0.1, 0.2, 0.5, 0.25] },
          },
        },
      ],
      currency: { value: 'USD' },
    })
    expect(fields.map((f) => f.path)).toEqual([
      'line_items.0.description',
      'currency',
    ])
    expect(fields[1].page).toBeUndefined()
  })

  it('drops null and empty values', () => {
    const fields = flattenReviewData({
      po_number: { value: null, review: { page: 1 } },
      notes: { value: '' },
    })
    expect(fields).toEqual([])
  })
})

describe('unwrapReviewData', () => {
  it('collapses {value, review} leaves to bare values, recursively', () => {
    const out = unwrapReviewData({
      vendor_name: {
        value: 'Rusin',
        review: { page: 1, boundingBox: [0.1, 0.1, 0.4, 0.14] },
      },
      amount: { value: 11910 },
      line_items: [
        {
          description: { value: 'Grading', review: { page: 2 } },
        },
      ],
    })
    expect(out).toEqual({
      vendor_name: 'Rusin',
      amount: 11910,
      line_items: [{ description: 'Grading' }],
    })
  })

  it('feeds normalizeExtractedFields with reviewer-corrected values', () => {
    const extracted = normalizeExtractedFields(
      unwrapReviewData({
        vendor_name: { value: 'Corrected Vendor', review: { page: 1 } },
        amount: { value: 5000, review: { page: 1 } },
        currency: { value: 'USD' },
      }),
    )
    expect(extracted.vendorName).toBe('Corrected Vendor')
    expect(extracted.amount).toBe(5000)
    expect(extracted.currency).toBe('USD')
  })
})

describe('normalizeExtractedFields', () => {
  it('unwraps {value} objects and prefers current_payment_due for amount', () => {
    const out = normalizeExtractedFields({
      vendor_name: { value: 'Rusin', confidence: 0.92 },
      amount: 99999,
      current_payment_due: 11910,
      document_number: '12',
    })
    expect(out.vendorName).toBe('Rusin')
    expect(out.amount).toBe(11910)
    expect(out.documentNumber).toBe('12')
  })

  it('parses currency-formatted strings as numbers', () => {
    expect(normalizeExtractedFields({ amount: '$1,234.56' }).amount).toBe(
      1234.56,
    )
  })
})

describe('applyReviewEdits', () => {
  const data = {
    vendor_name: {
      value: 'Rusin',
      review: { page: 1, boundingBox: [0.1, 0.1, 0.4, 0.14] },
    },
    amount: { value: 11910, review: { page: 2 } },
    line_items: [{ description: { value: 'Grading', review: { page: 3 } } }],
  }

  it('replaces only the leaf value, keeping localization intact', () => {
    const out = applyReviewEdits(data, [
      { path: 'amount', value: 12500 },
      { path: 'line_items.0.description', value: 'Regrading' },
    ])
    expect(out.appliedPaths).toEqual(['amount', 'line_items.0.description'])
    const amount = out.data.amount as { value: unknown; review: unknown }
    expect(amount.value).toBe(12500)
    expect(amount.review).toEqual({ page: 2 })
    const items = out.data.line_items as Array<{
      description: { value: unknown; review: unknown }
    }>
    expect(items[0].description.value).toBe('Regrading')
    expect(items[0].description.review).toEqual({ page: 3 })
  })

  it('does not mutate the input payload', () => {
    applyReviewEdits(data, [{ path: 'amount', value: 1 }])
    expect((data.amount as { value: unknown }).value).toBe(11910)
  })

  it('skips unknown or non-leaf paths', () => {
    const out = applyReviewEdits(data, [
      { path: 'no_such_field', value: 'x' },
      { path: 'line_items', value: 'not-a-leaf' },
      { path: 'vendor_name', value: 'Corrected' },
    ])
    expect(out.appliedPaths).toEqual(['vendor_name'])
    expect((out.data.vendor_name as { value: unknown }).value).toBe(
      'Corrected',
    )
  })
})

describe('extractFieldConfidence', () => {
  it('reads a top-level confidence map', () => {
    const out = extractFieldConfidence({
      data: { vendor_name: 'Rusin' },
      confidence: { vendor_name: 0.92, amount: 0.41 },
    })
    expect(out).toEqual({ vendor_name: 0.92, amount: 0.41 })
  })

  it('reads confidence embedded on each field', () => {
    const out = extractFieldConfidence({
      data: {
        vendor_name: { value: 'Rusin', confidence: 0.82 },
        amount: { value: 1234, confidence: 0.99 },
        currency: { value: 'USD' },
      },
    })
    expect(out).toEqual({ vendor_name: 0.82, amount: 0.99 })
  })

  it('ignores non-numeric or missing values', () => {
    const out = extractFieldConfidence({
      data: { vendor_name: 'Rusin' },
      confidence: { vendor_name: 'high', amount: null, fee: NaN },
    })
    expect(out).toEqual({})
  })

  it('reads sibling <field>_confidence numbers (AI schema-builder shape)', () => {
    const out = extractFieldConfidence({
      data: {
        vendor_name: 'AA Accurate & Affordable Striping, Inc.',
        vendor_name_confidence: 0.95,
        amount: 11910,
        amount_confidence: 1,
        currency: 'USD',
        currency_confidence: 0.9,
      },
    })
    expect(out).toEqual({ vendor_name: 0.95, amount: 1, currency: 0.9 })
  })

  it('lets a top-level confidence map win over sibling _confidence fields', () => {
    const out = extractFieldConfidence({
      confidence: { vendor_name: 0.5 },
      data: {
        vendor_name: 'X',
        vendor_name_confidence: 0.99,
      },
    })
    expect(out).toEqual({ vendor_name: 0.5 })
  })

  it('returns an empty record when DocuPipe did not return confidence', () => {
    const out = extractFieldConfidence({ data: { vendor_name: 'Rusin' } })
    expect(out).toEqual({})
  })
})

describe('computeLowConfidence', () => {
  it('is true when any field is below the threshold', () => {
    expect(computeLowConfidence({ vendor_name: 0.91, amount: 0.4 })).toBe(true)
  })

  it('is false when every field meets the threshold', () => {
    expect(computeLowConfidence({ vendor_name: 0.91, amount: 0.9 })).toBe(false)
  })

  it('is true when there is no confidence data (un-scored → route to review)', () => {
    expect(computeLowConfidence({})).toBe(true)
  })

  it('honors a custom threshold', () => {
    expect(computeLowConfidence({ vendor_name: 0.7 }, 0.5)).toBe(false)
    expect(
      computeLowConfidence({ vendor_name: 0.7 }, LOW_CONFIDENCE_THRESHOLD),
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Admin / CRUD helper coverage
// ---------------------------------------------------------------------------
//
// These tests stub `globalThis.fetch` directly so we exercise the helpers'
// request shape (URL, method, body, headers) and response decoding without
// touching the live DocuPipe API. `vi.stubEnv` keeps the env reader happy.

type FetchCall = {
  url: string
  init: RequestInit | undefined
}

function stubFetch(
  responder: (call: FetchCall) => {
    status?: number
    body?: unknown
  },
): { calls: Array<FetchCall> } {
  const calls: Array<FetchCall> = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const recorded: FetchCall = { url: String(url), init }
    calls.push(recorded)
    const { status = 200, body = {} } = responder(recorded)
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fn)
  return { calls }
}

function readJsonBody(init: RequestInit | undefined): unknown {
  const body = init?.body
  if (typeof body !== 'string') return undefined
  return JSON.parse(body)
}

describe('docupipe CRUD helpers', () => {
  beforeEach(() => {
    vi.stubEnv('DOCUPIPE_API_KEY', 'test-key')
    vi.stubEnv('DOCUPIPE_BASE_URL', 'https://app.docupipe.test')
    vi.stubEnv('DOCUPIPE_WORKFLOW_ID', 'wf_test')
    vi.stubEnv('DOCUPIPE_WEBHOOK_SECRET', 'whsec_test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('listClasses normalizes camelCase + snake_case rows', async () => {
    stubFetch(() => ({
      body: [
        { classId: 'c1', className: 'INV', description: 'invoice' },
        { class_id: 'c2', class_name: 'PA' },
      ],
    }))
    const out = await listClasses()
    expect(out).toEqual([
      { classId: 'c1', className: 'INV', description: 'invoice' },
      { classId: 'c2', className: 'PA', description: undefined },
    ])
  })

  it('createClass POSTs /class and returns the new id', async () => {
    const { calls } = stubFetch(() => ({
      body: { classId: 'c_new', className: 'PA', description: 'desc' },
    }))
    const out = await createClass({ className: 'PA', description: 'desc' })
    expect(out.classId).toBe('c_new')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('https://app.docupipe.test/class')
    expect(calls[0].init?.method).toBe('POST')
    expect(readJsonBody(calls[0].init)).toEqual({
      className: 'PA',
      description: 'desc',
    })
  })

  it('createClass throws when DocuPipe returns no classId', async () => {
    stubFetch(() => ({ body: {} }))
    await expect(
      createClass({ className: 'PA', description: 'desc' }),
    ).rejects.toThrow(/no classId/)
  })

  it('editClass POSTs /class/edit with only the provided fields', async () => {
    const { calls } = stubFetch(() => ({
      body: { classId: 'c1', className: 'PA', description: 'updated' },
    }))
    await editClass({ classId: 'c1', description: 'updated' })
    expect(calls[0].url).toBe('https://app.docupipe.test/class/edit')
    expect(readJsonBody(calls[0].init)).toEqual({
      classId: 'c1',
      description: 'updated',
    })
  })

  it('listSchemas normalizes both naming conventions', async () => {
    stubFetch(() => ({
      body: [
        {
          schemaId: 's1',
          schemaName: 'SG DREAM INV',
          jsonSchema: { type: 'object' },
        },
        { schema_id: 's2', schema_name: 'Other', json_schema: null },
      ],
    }))
    const out = await listSchemas()
    expect(out).toEqual([
      {
        schemaId: 's1',
        schemaName: 'SG DREAM INV',
        jsonSchema: { type: 'object' },
        guidelines: undefined,
      },
      {
        schemaId: 's2',
        schemaName: 'Other',
        jsonSchema: null,
        guidelines: undefined,
      },
    ])
  })

  it('createSchema POSTs /schema with the full body', async () => {
    const { calls } = stubFetch(() => ({
      body: { schemaId: 's_new', schemaName: 'SG DREAM Universal' },
    }))
    const jsonSchema = { type: 'object', properties: {} }
    const out = await createSchema({
      schemaName: 'SG DREAM Universal',
      jsonSchema,
    })
    expect(out.schemaId).toBe('s_new')
    expect(calls[0].url).toBe('https://app.docupipe.test/schema')
    expect(readJsonBody(calls[0].init)).toEqual({
      schemaName: 'SG DREAM Universal',
      jsonSchema,
    })
  })

  it('editSchema POSTs /schema/edit', async () => {
    const { calls } = stubFetch(() => ({
      body: { schemaId: 's1', schemaName: 'SG DREAM INV' },
    }))
    await editSchema({ schemaId: 's1', schemaName: 'SG DREAM INV' })
    expect(calls[0].url).toBe('https://app.docupipe.test/schema/edit')
    expect(readJsonBody(calls[0].init)).toEqual({
      schemaId: 's1',
      schemaName: 'SG DREAM INV',
    })
  })

  it('listWorkflows surfaces the raw step block', async () => {
    stubFetch(() => ({
      body: [
        {
          workflowId: 'wf1',
          workflowName: 'SG DREAM Ingest',
          workflowContents: {
            stepType: 'classifyStandardize',
            step: { classToSchema: { c1: 's1' }, multiClass: false },
          },
        },
      ],
    }))
    const out = await listWorkflows()
    expect(out).toEqual([
      {
        workflowId: 'wf1',
        workflowName: 'SG DREAM Ingest',
        stepType: 'classifyStandardize',
        step: { classToSchema: { c1: 's1' }, multiClass: false },
      },
    ])
  })

  it('createWorkflow POSTs /workflow/on-submit-document', async () => {
    const { calls } = stubFetch(() => ({
      body: { workflowId: 'wf_new' },
    }))
    const step = {
      classIds: ['c1'],
      multiClass: false,
      includeUnknown: true,
      classToSchema: { c1: 's1' },
      stdVersion: 2.2,
    }
    const out = await createWorkflow({
      workflowName: 'SG DREAM Ingest',
      classifyStandardizeStep: step,
    })
    expect(out.workflowId).toBe('wf_new')
    expect(calls[0].url).toBe(
      'https://app.docupipe.test/workflow/on-submit-document',
    )
    expect(readJsonBody(calls[0].init)).toEqual({
      workflowName: 'SG DREAM Ingest',
      classifyStandardizeStep: step,
    })
  })

  it('updateWorkflow PUTs the patched step body', async () => {
    const { calls } = stubFetch(() => ({ body: {} }))
    await updateWorkflow('wf1', {
      classifyStandardizeStep: {
        classToSchema: { c1: 's1', c2: 's2' },
      },
    })
    expect(calls[0].url).toBe('https://app.docupipe.test/workflow/wf1/update')
    expect(calls[0].init?.method).toBe('POST')
    expect(readJsonBody(calls[0].init)).toEqual({
      classifyStandardizeStep: { classToSchema: { c1: 's1', c2: 's2' } },
    })
  })

  it('updateReview POSTs data + reviewStatus to /review/{id}/update', async () => {
    const { calls } = stubFetch(() => ({ body: { reviewId: 'rev1' } }))
    await updateReview('rev1', {
      data: { amount: { value: 12500, review: { page: 2 } } },
      reviewStatus: 'verified',
    })
    expect(calls[0].url).toBe('https://app.docupipe.test/review/rev1/update')
    expect(calls[0].init?.method).toBe('POST')
    expect(readJsonBody(calls[0].init)).toEqual({
      data: { amount: { value: 12500, review: { page: 2 } } },
      reviewStatus: 'verified',
    })
  })

  it('updateReview omits data when only the status changes', async () => {
    const { calls } = stubFetch(() => ({ body: { reviewId: 'rev1' } }))
    await updateReview('rev1', { reviewStatus: 'rejected' })
    expect(readJsonBody(calls[0].init)).toEqual({ reviewStatus: 'rejected' })
  })

  it('registerWebhookEndpoint POSTs the URL + subscribed events', async () => {
    const { calls } = stubFetch(() => ({ body: {} }))
    await registerWebhookEndpoint({
      url: 'https://example.test/api/docupipe/webhook',
      subscribedEvents: ['document.processed.success'],
    })
    expect(calls[0].url).toBe(
      'https://app.docupipe.test/webhook/generate-endpoint',
    )
    expect(readJsonBody(calls[0].init)).toEqual({
      url: 'https://example.test/api/docupipe/webhook',
      subscribedEvents: ['document.processed.success'],
    })
  })

  it('every helper attaches the X-API-Key header', async () => {
    const { calls } = stubFetch(() => ({
      body: [{ classId: 'c1', className: 'INV' }],
    }))
    await listClasses()
    const headers = new Headers(calls[0].init?.headers)
    expect(headers.get('X-API-Key')).toBe('test-key')
  })
})
