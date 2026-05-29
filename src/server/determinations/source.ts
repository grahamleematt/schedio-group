import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import type {
  DeterminationWorkspace,
  PlatPppRecord,
  SourceDocument,
  SourceDocumentKind,
} from './types'

const DEFAULT_SOURCE_ZIP = '/Users/matthewgraham/Downloads/____SG DREAM (1).zip'
const SOURCE_ZIP = process.env.SG_DREAM_SOURCE_ZIP ?? DEFAULT_SOURCE_ZIP
const MAX_BUFFER = 128 * 1024 * 1024

const MARKED_CONTRACTS_PREFIX =
  '____SG DREAM/CT_Dawson Trails MD1_Marked Up Contracts/'
const MARKED_PLATS_PREFIX = '____SG DREAM/Dawson Trails MD1_Marked Up Plats/'
const WORKBOOK_PREFIX =
  '____SG DREAM/20260504_SG DREAM Excel Example (Dawson Trails MD - DISTRICT)/Ver 01/'

type CorpusRead = {
  sourceZipPath: string
  sourceExists: boolean
  sourceWarnings: Array<string>
  documents: Array<SourceDocument>
  platPpps: Array<PlatPppRecord>
}

function execFileText(command: string, args: ReadonlyArray<string>) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      command,
      args,
      { maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error(String(stderr || err.message)))
          return
        }
        resolve(String(stdout))
      },
    )
  })
}

function execFileBuffer(command: string, args: ReadonlyArray<string>) {
  return new Promise<Buffer>((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: 'buffer', maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (err) {
          const detail = stderr.length > 0 ? stderr.toString() : err.message
          reject(new Error(detail))
          return
        }
        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout))
      },
    )
  })
}

function sourceId(entryPath: string): string {
  return createHash('sha1').update(entryPath).digest('hex').slice(0, 16)
}

function basename(entryPath: string): string {
  return entryPath.split('/').filter(Boolean).at(-1) ?? entryPath
}

function cleanPdfName(fileName: string): string {
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/_/g, ' ')
    .trim()
}

function decodeXml(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function parseAttrs(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const attrRe = /([\w:]+)="([^"]*)"/g
  let match: RegExpExecArray | null
  while ((match = attrRe.exec(tag))) {
    attrs[match[1]] = decodeXml(match[2])
  }
  return attrs
}

function columnToIndex(ref: string): number {
  const letters = ref.match(/[A-Z]+/)?.[0] ?? 'A'
  let index = 0
  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64
  }
  return index - 1
}

async function zipEntry(zipPath: string, entryPath: string): Promise<Buffer> {
  return execFileBuffer('unzip', ['-p', zipPath, entryPath])
}

async function listZipEntries(zipPath: string): Promise<Array<string>> {
  const out = await execFileText('zipinfo', ['-1', zipPath])
  return out
    .split('\n')
    .map((row) => row.trim())
    .filter(Boolean)
}

function inferKind(entryPath: string): SourceDocumentKind | null {
  if (entryPath.startsWith(MARKED_CONTRACTS_PREFIX)) return 'marked_contract'
  if (entryPath.startsWith(MARKED_PLATS_PREFIX)) return 'marked_plat'
  if (
    entryPath.startsWith(WORKBOOK_PREFIX) &&
    /Verification No\. 01\.xlsx$/i.test(entryPath)
  ) {
    return 'verification_workbook'
  }
  if (entryPath.includes('/Governance/')) return 'governance'
  return null
}

function inferDocCode(fileName: string): string | undefined {
  const match = fileName.match(/^([A-Z]{2,4})[_-]/)
  return match?.[1]
}

function inferFilingLabel(fileName: string): string | undefined {
  const normalized = fileName.replace(/_/g, ' ')
  const filing =
    normalized.match(/\bFiling\s+(\d+)(?:\s*-\s*A(\d+))?/i) ??
    normalized.match(/\bF(\d+)(?:\s*A(\d+))?\b/i)
  if (!filing) return undefined
  return filing[2]
    ? `Filing ${filing[1]} - A${filing[2]}`
    : `Filing ${filing[1]}`
}

function inferVendor(
  entryPath: string,
  kind: SourceDocumentKind,
): string | undefined {
  const parts = entryPath.split('/').filter(Boolean)
  if (kind !== 'marked_contract') return undefined
  const vendor = parts[2]
  if (!vendor) return undefined
  if (vendor === 'CORE') return 'CORE Consultants'
  return vendor
}

function inferGroupLabel(kind: SourceDocumentKind, entryPath: string): string {
  if (kind === 'marked_contract') return 'Marked contracts'
  if (kind === 'marked_plat') return 'Marked plats'
  if (kind === 'verification_workbook') return 'Verification workbook'
  if (entryPath.includes('/PPP Governance/')) return 'PPP governance'
  if (entryPath.includes('/System Constitution/')) return 'System constitution'
  if (entryPath.includes('/Cost & Authorization/'))
    return 'Cost & authorization'
  return 'Governance'
}

function parsePppPercent(fileName: string): number | undefined {
  const match = fileName.match(/PPP\s*-\s*([\d.]+)%/i)
  return match ? Number(match[1]) : undefined
}

function toSourceDocument(entryPath: string): SourceDocument | null {
  const kind = inferKind(entryPath)
  if (!kind) return null
  const fileName = basename(entryPath)
  const isPdf = /\.pdf$/i.test(fileName)
  const isXlsx = /\.xlsx$/i.test(fileName)
  if (!isPdf && !isXlsx && kind !== 'governance') return null
  return {
    id: sourceId(entryPath),
    entryPath,
    fileName,
    kind,
    groupLabel: inferGroupLabel(kind, entryPath),
    vendorName: inferVendor(entryPath, kind),
    filingLabel: inferFilingLabel(fileName),
    pppPercent: parsePppPercent(fileName),
    docCode: inferDocCode(fileName),
    sourceModifiedLabel: undefined,
    mimeType: isPdf
      ? 'application/pdf'
      : isXlsx
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/octet-stream',
  }
}

function sortDocuments(a: SourceDocument, b: SourceDocument): number {
  const order: Record<SourceDocumentKind, number> = {
    marked_contract: 1,
    marked_plat: 2,
    verification_workbook: 3,
    governance: 4,
  }
  return (
    order[a.kind] - order[b.kind] ||
    (a.vendorName ?? '').localeCompare(b.vendorName ?? '') ||
    a.fileName.localeCompare(b.fileName)
  )
}

async function readXlsxEntry(
  xlsxPath: string,
  entryPath: string,
): Promise<string> {
  const buffer = await execFileBuffer('unzip', ['-p', xlsxPath, entryPath])
  return buffer.toString('utf8')
}

function parseSharedStrings(xml: string): Array<string> {
  const values: Array<string> = []
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let match: RegExpExecArray | null
  while ((match = siRe.exec(xml))) {
    const bits: Array<string> = []
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g
    let tMatch: RegExpExecArray | null
    while ((tMatch = tRe.exec(match[1]))) {
      bits.push(decodeXml(tMatch[1]))
    }
    values.push(bits.join(''))
  }
  return values
}

function parseRows(
  sheetXml: string,
  sharedStrings: ReadonlyArray<string>,
): Array<Array<string | number | null>> {
  const rows: Array<Array<string | number | null>> = []
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRe.exec(sheetXml))) {
    const row: Array<string | number | null> = []
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = parseAttrs(cellMatch[1])
      const index = columnToIndex(attrs.r || 'A')
      const raw =
        cellMatch[2].match(/<v>([\s\S]*?)<\/v>/)?.[1] ??
        cellMatch[2].match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ??
        ''
      let value: string | number | null = null
      if (attrs.t === 's') {
        value = sharedStrings[Number(raw)] ?? null
      } else if (raw !== '') {
        const decoded = decodeXml(raw)
        const numeric = Number(decoded)
        value =
          Number.isFinite(numeric) && decoded.trim() !== '' ? numeric : decoded
      }
      row[index] = value
    }
    rows.push(row)
  }
  return rows
}

async function parsePlatPpps(
  xlsxBuffer: Buffer,
): Promise<Array<PlatPppRecord>> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sgdream-xlsx-'))
  const tmpXlsx = path.join(tmpDir, 'source.xlsx')
  try {
    await fs.writeFile(tmpXlsx, xlsxBuffer)
    const workbookXml = await readXlsxEntry(tmpXlsx, 'xl/workbook.xml')
    const relsXml = await readXlsxEntry(tmpXlsx, 'xl/_rels/workbook.xml.rels')
    const sheetMatch = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g))
      .map((match) => parseAttrs(match[1]))
      .find((attrs) => attrs.name === 'PLAT_PPPs')
    const relId = sheetMatch?.['r:id']
    if (!relId) return []
    const relMatch = Array.from(relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g))
      .map((match) => parseAttrs(match[1]))
      .find((attrs) => attrs.Id === relId)
    const target = relMatch?.Target
    if (!target) return []
    const sheetPath = target.startsWith('/')
      ? target.slice(1)
      : `xl/${target.replace(/^\.\.\//, '')}`
    const sheetXml = await readXlsxEntry(tmpXlsx, sheetPath)
    let sharedStrings: Array<string> = []
    try {
      sharedStrings = parseSharedStrings(
        await readXlsxEntry(tmpXlsx, 'xl/sharedStrings.xml'),
      )
    } catch {
      sharedStrings = []
    }
    const rows = parseRows(sheetXml, sharedStrings)
    return rows
      .slice(1)
      .map((row): PlatPppRecord | null => {
        const label = typeof row[0] === 'string' ? row[0] : ''
        const total = typeof row[1] === 'number' ? row[1] : Number.NaN
        const privateArea = typeof row[2] === 'number' ? row[2] : Number.NaN
        const publicArea = typeof row[3] === 'number' ? row[3] : Number.NaN
        const ppp = typeof row[4] === 'number' ? row[4] : Number.NaN
        if (!label || !Number.isFinite(ppp)) return null
        return {
          id: label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
          label,
          totalAreaAcres: total,
          privateAreaAcres: privateArea,
          publicAreaAcres: publicArea,
          ppp,
        }
      })
      .filter((row): row is PlatPppRecord => Boolean(row))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

async function readCorpus(): Promise<CorpusRead> {
  const warnings: Array<string> = []
  try {
    await fs.access(SOURCE_ZIP)
  } catch {
    return {
      sourceZipPath: SOURCE_ZIP,
      sourceExists: false,
      sourceWarnings: [`Source zip not found at ${SOURCE_ZIP}`],
      documents: [],
      platPpps: [],
    }
  }

  const entries = await listZipEntries(SOURCE_ZIP)
  const documents = entries
    .map(toSourceDocument)
    .filter((row): row is SourceDocument => Boolean(row))
    .sort(sortDocuments)

  const workbookEntry =
    entries
      .filter(
        (entry) =>
          entry.startsWith(WORKBOOK_PREFIX) &&
          /Verification No\. 01\.xlsx$/i.test(entry) &&
          !entry.includes('/_Archive/'),
      )
      .sort()
      .at(-1) ?? ''

  let platPpps: Array<PlatPppRecord> = []
  if (workbookEntry) {
    try {
      const workbook = await zipEntry(SOURCE_ZIP, workbookEntry)
      platPpps = await parsePlatPpps(workbook)
    } catch (err) {
      warnings.push(
        err instanceof Error
          ? `Could not parse PLAT_PPPs from workbook: ${err.message}`
          : 'Could not parse PLAT_PPPs from workbook',
      )
    }
  } else {
    warnings.push(
      'No active Dawson verification workbook was found in the zip.',
    )
  }

  return {
    sourceZipPath: SOURCE_ZIP,
    sourceExists: true,
    sourceWarnings: warnings,
    documents,
    platPpps,
  }
}

let cachedCorpus: Promise<CorpusRead> | null = null

export async function getSourceCorpus(): Promise<CorpusRead> {
  if (!cachedCorpus) cachedCorpus = readCorpus()
  return cachedCorpus
}

export async function getWorkspaceBase(): Promise<
  Omit<DeterminationWorkspace, 'assertions'>
> {
  const corpus = await getSourceCorpus()
  return {
    sourceZipPath: corpus.sourceZipPath,
    sourceExists: corpus.sourceExists,
    sourceWarnings: corpus.sourceWarnings,
    documents: corpus.documents,
    platPpps: corpus.platPpps,
  }
}

export async function readSourceDocumentById(
  id: string,
): Promise<{ doc: SourceDocument; bytes: Buffer } | null> {
  const corpus = await getSourceCorpus()
  const doc = corpus.documents.find((row) => row.id === id)
  if (!doc) return null
  if (!corpus.sourceExists) return null
  const bytes = await zipEntry(corpus.sourceZipPath, doc.entryPath)
  return { doc, bytes }
}

export function suggestedScopeLabel(doc: SourceDocument): string {
  if (doc.kind === 'marked_plat') return cleanPdfName(doc.fileName)
  if (doc.vendorName) return `${doc.vendorName} scope review`
  return cleanPdfName(doc.fileName)
}
