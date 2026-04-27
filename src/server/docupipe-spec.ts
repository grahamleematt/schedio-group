/**
 * Single source of truth for SG DREAM's DocuPipe configuration.
 *
 * Every property on `SG_DREAM_DOCUPIPE_SPEC` describes the *intended* state
 * of the DocuPipe workspace. Two consumers:
 *
 *   1. `scripts/docupipe/align.ts` — `check` reports drift between this spec
 *      and the live workspace; `sync` writes missing classes / schemas /
 *      workflow mappings to make the live workspace match.
 *   2. `src/routes/api/docupipe/webhook.ts` — derives the runtime
 *      `DOC_TYPES` enum from `classes` so the handler's known class list
 *      can never drift from the spec.
 *
 * The runtime webhook never trusts this file as ground truth for *what
 * DocuPipe actually returns* — that always comes from cached fetches
 * (`getClassMap()`, `getWorkflow()`). The spec describes intent; the API
 * describes reality. This separation means a stale spec can never poison
 * runtime decisions; it can only cause the alignment script to report
 * drift on the next run.
 *
 * ## Schema strategy (decided from corpus data)
 *
 * The SG DREAM examples folder contains 281 documents in the green flow:
 *   - INV: 233 (83%)
 *   - TO: 33 (12%)
 *   - PA: 6, CTR: 3, CO: 3, POP: 2, LSP: 0, CD: 0
 *
 * We ship two schemas:
 *   - `SG DREAM INV` — tailored for invoices (the dominant 83% of volume).
 *     Includes invoice-specific fields like `po_number` and
 *     `line_item_count` even though the app doesn't currently render them.
 *   - `SG DREAM Universal` — the 9 fields the app actually reads from
 *     `ExtractedFields` in src/server/store/types.ts, with per-class hints
 *     baked into each field's `description`. The AI honors descriptions
 *     during extraction, which is the only mechanism for per-class
 *     guidance under a shared schema (workflow-level `guidelines` is one
 *     string per step, not per class).
 *
 * LSP and CD have no examples in the corpus but are still mapped to the
 * universal schema so any edge-case classification still terminates
 * cleanly with extracted fields populated.
 */

import type { DocType } from '#/lib/sg-dream'

type ClassSpec = {
  className: DocType
  description: string
}

type SchemaSpec = {
  schemaName: string
  /** JSON Schema (Draft-07) body, passed directly to `POST /schema`. */
  jsonSchema: Record<string, unknown>
  /** Class names this schema should be mapped to in the workflow. */
  mappedTo: ReadonlyArray<DocType>
}

type WorkflowSpec = {
  workflowName: string
  /** Step type — only `classifyStandardize` is supported by this codebase. */
  stepType: 'classifyStandardize'
  /** DocuPipe standardization engine version. 2.2 is current stable. */
  stdVersion: 2.2
  /** Single-class classification (vs multi-label). */
  multiClass: false
  /** Whether DocuPipe should reserve an `unknown` bucket. */
  includeUnknown: boolean
}

/**
 * Common confidence-field block. The AI schema generator emits scores as
 * sibling `<field>_confidence` numbers, which our `extractFieldConfidence`
 * helper in src/server/docupipe.ts already understands.
 */
function withConfidence(
  fields: Record<string, Record<string, unknown>>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {}
  for (const [name, def] of Object.entries(fields)) {
    out[name] = def
    out[`${name}_confidence`] = {
      type: 'number',
      description: `Confidence score for ${name} extraction, between 0 and 1.`,
    }
  }
  return out
}

const INV_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description:
    'Schema for extracting key invoice data with confidence scores for each field.',
  properties: withConfidence({
    vendor_name: {
      type: 'string',
      description:
        'Vendor or counterparty name as printed on the invoice header.',
    },
    vendor_id_guess: {
      type: 'string',
      description:
        'Vendor tax ID, EIN, or internal vendor number if visible on the invoice.',
    },
    document_number: {
      type: 'string',
      description: 'Invoice number or document identifier.',
    },
    amount: {
      type: 'number',
      description:
        'Total amount due in USD. Strip currency symbols and return as a numeric value.',
    },
    currency: {
      type: 'string',
      description:
        'ISO 4217 currency code. Default to USD if not explicitly stated.',
      examples: ['USD', 'EUR', 'CAD'],
    },
    document_date: {
      type: 'string',
      format: 'date',
      description: 'Invoice issue date in YYYY-MM-DD format.',
    },
    contract_reference: {
      type: 'string',
      description:
        'Parent contract number or reference if mentioned on the invoice, separate from PO number.',
    },
    po_number: {
      type: 'string',
      description: 'Purchase order number referenced on the invoice.',
    },
    line_item_count: {
      type: 'integer',
      description: 'Number of distinct line items listed on the invoice.',
    },
  }),
} as const

/**
 * Universal schema covering the 7 non-INV doc types. Field descriptions
 * include per-class instructions because DocuPipe's AI uses descriptions
 * during extraction; this is the only way to encode per-class meaning
 * under a shared schema.
 */
const UNIVERSAL_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  description:
    'Universal SG DREAM extraction schema. Covers Pay Applications, Contracts, Task Orders, Change Orders, Proofs of Payment, Land Survey Plats, and Construction Drawings. Field descriptions include per-class guidance — read them carefully before extracting.',
  properties: withConfidence({
    vendor_name: {
      type: 'string',
      description:
        'Counterparty / vendor name as printed on the document. For CTR this is the contractor party; for TO/CO/PA/POP this is the vendor being paid; for LSP/CD this is the surveying or design firm. If multiple parties appear, prefer the one that would be paid.',
    },
    vendor_id_guess: {
      type: 'string',
      description:
        'Tax ID, EIN, vendor number, license number, or other unique vendor identifier if visible on the document. Leave blank if not present.',
    },
    document_number: {
      type: 'string',
      description:
        'Primary document identifier as printed. CTR: contract number; TO: work order or PO number; CO: change order number (e.g. CO-001); PA: pay app / draw number; POP: check number, wire confirmation number, or waiver reference; LSP: plat or survey number; CD: drawing set or sheet number.',
    },
    amount: {
      type: 'number',
      description:
        'Headline dollar amount in USD, numeric (strip currency symbols and commas). CTR: total contract value; TO: work order value; CO: change amount (positive for additive, negative for deductive); PA: amount due this billing period (NOT the contract total); POP: amount actually paid; LSP/CD: leave null. If no monetary amount is on the document face, return null.',
    },
    currency: {
      type: 'string',
      description:
        'ISO 4217 currency code. Default to USD if not explicitly stated. Leave blank when amount is null.',
      examples: ['USD', 'EUR', 'CAD'],
    },
    document_date: {
      type: 'string',
      format: 'date',
      description:
        'Issue / effective date on the document face in YYYY-MM-DD format. CTR: execution date; TO/CO/PA/INV: issue date; POP: payment date; LSP: recording date; CD: stamp / issue date.',
    },
    period_start: {
      type: 'string',
      format: 'date',
      description:
        'Billing or coverage period start in YYYY-MM-DD. Required for PA (the start of the billing period). Optional for POP (date range a wire / waiver covers). Leave blank for CTR/TO/CO/LSP/CD.',
    },
    period_end: {
      type: 'string',
      format: 'date',
      description:
        'Billing or coverage period end in YYYY-MM-DD. Required for PA. Same rules as period_start.',
    },
    contract_reference: {
      type: 'string',
      description:
        'Parent contract or master agreement number. CRITICAL for TO (the parent MSA that authorizes this work order) and CO (the contract being amended). Recommended for PA and POP (the contract being billed against). Leave blank for CTR (which IS the contract) and LSP/CD.',
    },
  }),
} as const

export const SG_DREAM_DOCUPIPE_SPEC = {
  classes: [
    {
      className: 'INV',
      description: 'Vendor invoice requesting payment for goods or services.',
    },
    {
      className: 'PA',
      description:
        'AIA G702/G703 or vendor pay application covering a billing period.',
    },
    {
      className: 'CTR',
      description:
        'Master service agreement or executed contract between an entity and a vendor.',
    },
    {
      className: 'TO',
      description:
        'Work order or purchase order issued under a parent contract.',
    },
    {
      className: 'CO',
      description:
        'Amendment that modifies scope, price, or schedule of an existing contract.',
    },
    {
      className: 'POP',
      description:
        'Wire confirmation, canceled check, ACH receipt, or lien waiver evidencing payment.',
    },
    {
      className: 'LSP',
      description: 'Recorded land survey plat or boundary survey.',
    },
    {
      className: 'CD',
      description: 'Stamped construction drawings or design set.',
    },
  ] as const satisfies ReadonlyArray<ClassSpec>,
  schemas: [
    {
      schemaName: 'SG DREAM INV',
      jsonSchema: INV_SCHEMA,
      mappedTo: ['INV'],
    },
    {
      schemaName: 'SG DREAM Universal',
      jsonSchema: UNIVERSAL_SCHEMA,
      mappedTo: ['CTR', 'TO', 'CO', 'PA', 'POP', 'LSP', 'CD'],
    },
  ] as const satisfies ReadonlyArray<SchemaSpec>,
  workflow: {
    workflowName: 'SG DREAM Ingest',
    stepType: 'classifyStandardize',
    stdVersion: 2.2,
    multiClass: false,
    includeUnknown: true,
  } as const satisfies WorkflowSpec,
  /**
   * Webhook events the handler in src/routes/api/docupipe/webhook.ts knows
   * how to act on. Used by the align script when registering an endpoint
   * via `--register-webhook`. Other DocuPipe events (review.*, schema.*,
   * split.*, merge.*) are intentionally not subscribed because the handler
   * has no logic for them and they'd just generate noise.
   */
  webhookEvents: [
    'document.processed.success',
    'document.processed.error',
    'classification.processed.success',
    'classification.processed.error',
    'standardization.processed.success',
    'standardization.processed.error',
  ] as const,
} as const

/**
 * Convenience: every class name in the spec, in the order documented above.
 * The webhook handler imports this to derive its `DOC_TYPES` array so the
 * two lists can never drift.
 */
export const SPEC_CLASS_NAMES: ReadonlyArray<DocType> =
  SG_DREAM_DOCUPIPE_SPEC.classes.map((c) => c.className)

export type DocupipeSpec = typeof SG_DREAM_DOCUPIPE_SPEC
