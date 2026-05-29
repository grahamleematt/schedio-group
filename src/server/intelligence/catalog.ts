import type { IntelligenceCategory, IntelligenceCategoryId } from './types'

export const INTELLIGENCE_CATEGORIES: ReadonlyArray<IntelligenceCategory> = [
  {
    id: 'contract',
    label: 'Contracts',
    description:
      'Executed agreements, task orders, amendments, and marked-up scope materials.',
    sortOrder: 10,
  },
  {
    id: 'work_authorization',
    label: 'Work authorizations',
    description:
      'Authorizations, proposals, and scopes that can drive downstream invoice PPP treatment.',
    sortOrder: 12,
  },
  {
    id: 'task_order',
    label: 'Task orders',
    description:
      'Task orders and work orders tied to monthly invoices or pay applications.',
    sortOrder: 14,
  },
  {
    id: 'change_order',
    label: 'Change orders',
    description:
      'Approved or pending scope changes that alter authorization value or PPP treatment.',
    sortOrder: 16,
  },
  {
    id: 'plat',
    label: 'Plats',
    description:
      'Land survey plats, preliminary plats, final plats, and plat amendments.',
    sortOrder: 20,
  },
  {
    id: 'pdp',
    label: 'PDPs',
    description: 'Planned development plans and planning exhibits.',
    sortOrder: 30,
  },
  {
    id: 'invoice',
    label: 'Invoices',
    description: 'Invoices, pay applications, and cost support.',
    sortOrder: 40,
  },
  {
    id: 'pay_application',
    label: 'Pay applications',
    description: 'Pay applications and monthly draw packages.',
    sortOrder: 42,
  },
  {
    id: 'proof_of_payment',
    label: 'Proofs of payment',
    description: 'Proofs of payment, lien waivers, and payment confirmations.',
    sortOrder: 44,
  },
  {
    id: 'report',
    label: 'Reports',
    description: 'Engineer reports, cost reports, and narrative support.',
    sortOrder: 50,
  },
  {
    id: 'governance',
    label: 'Governance',
    description: 'Policy, authorization, constitution, and review materials.',
    sortOrder: 60,
  },
  {
    id: 'workbook',
    label: 'Workbooks',
    description: 'Verification workbooks and structured schedule data.',
    sortOrder: 70,
  },
  {
    id: 'construction_drawing',
    label: 'Construction drawings',
    description: 'Drawings and plan sheets used as supporting project context.',
    sortOrder: 80,
  },
  {
    id: 'unknown',
    label: 'Uncategorized',
    description: 'Documents awaiting classification.',
    sortOrder: 999,
  },
]

export const categoryLabels: Record<IntelligenceCategoryId, string> =
  Object.fromEntries(
    INTELLIGENCE_CATEGORIES.map((category) => [category.id, category.label]),
  ) as Record<IntelligenceCategoryId, string>
