/**
 * RenameTransform — the visible "original filename → standardized filing name"
 * transform that Tim called the best first deliverable (drag/drop, rename,
 * inventory). It keeps the original upload name visible and auditable while
 * decoding the SG DREAM naming convention into labeled segments:
 *
 *   SG-<entity>-V<NNN>-<DocType>-<Vendor4>-<year>-<seq>.<ext>
 *
 * Two modes:
 *   - "applied"  — a real renamed document (processing + library). Parses the
 *                  standardized name and shows each segment's meaning.
 *   - "preview"  — a staged upload that hasn't been analyzed yet. Shows the
 *                  parts SG already knows (entity, verification, year) and
 *                  ghosts the parts that get filled in after analysis.
 *
 * Purely presentational: no state, no effects.
 */

import { CornerDownRight } from 'lucide-react'

type Segment = {
  key: string
  label: string
  value: string
  /** Workflow-tinted: the meaning SG DREAM adds (Schedio, type, vendor). */
  accent?: boolean
  /** Not yet known — rendered muted in preview mode. */
  ghost?: boolean
}

const RENAMED_PATTERN =
  /^SG-([^-]+)-V(\d+)-([^-]+)-([^-]+)-(\d{4})-(\d+)\.([A-Za-z0-9]+)$/

/** Decode a fully-standardized filing name into labeled segments. */
function parseApplied(name: string): Segment[] | null {
  const match = RENAMED_PATTERN.exec(name)
  if (!match) return null
  const [, entity, vNumber, docType, vendor, year, seq, ext] = match
  return [
    { key: 'sg', label: 'Schedio', value: 'SG', accent: true },
    { key: 'entity', label: 'Entity', value: entity },
    { key: 'verification', label: 'Verification', value: `V${vNumber}` },
    { key: 'type', label: 'Type', value: docType, accent: true },
    { key: 'vendor', label: 'Vendor', value: vendor, accent: true },
    { key: 'year', label: 'Year', value: year },
    { key: 'seq', label: 'Seq', value: `${seq}.${ext}` },
  ]
}

/** Build the preview template + segments for a staged (not-yet-analyzed) file. */
function buildPreview(spec: {
  entityCode: string
  verificationNumber: number
  year: number
}): { template: string; segments: Segment[] } {
  const v = `V${String(spec.verificationNumber).padStart(3, '0')}`
  const template = `SG-${spec.entityCode}-${v}-‹type›-‹vendor›-${spec.year}-‹seq›`
  const segments: Segment[] = [
    { key: 'sg', label: 'Schedio', value: 'SG', accent: true },
    { key: 'entity', label: 'Entity', value: spec.entityCode },
    { key: 'verification', label: 'Verification', value: v },
    { key: 'type', label: 'Type', value: '‹type›', accent: true, ghost: true },
    {
      key: 'vendor',
      label: 'Vendor',
      value: '‹vendor›',
      accent: true,
      ghost: true,
    },
    { key: 'year', label: 'Year', value: String(spec.year) },
    { key: 'seq', label: 'Seq', value: '‹seq›', ghost: true },
  ]
  return { template, segments }
}

type RenameTransformProps =
  | {
      mode: 'applied'
      originalName: string
      renamedName: string
    }
  | {
      mode: 'preview'
      originalName: string
      entityCode: string
      verificationNumber: number
      year: number
    }

export function RenameTransform(props: RenameTransformProps) {
  if (props.mode === 'applied') {
    const segments = parseApplied(props.renamedName)
    // Unparseable or no actual change — fall back to a plain title so we never
    // render a misleading transform.
    if (!segments || props.renamedName === props.originalName) {
      return <p className="qtitle">{props.renamedName}</p>
    }
    return (
      <div className="rnm">
        <div className="rnm-orig-line">
          <span className="rnm-tag">Original</span>
          <span className="rnm-orig">{props.originalName}</span>
        </div>
        <div className="rnm-conn">
          <CornerDownRight aria-hidden className="size-3.5" />
          <span>Standardized filing name</span>
        </div>
        <p className="rnm-final">{props.renamedName}</p>
        <SegmentRow segments={segments} />
      </div>
    )
  }

  const { template, segments } = buildPreview(props)
  return (
    <div className="rnm">
      <div className="rnm-orig-line">
        <span className="rnm-tag">Original · preserved</span>
        <span className="rnm-orig">{props.originalName}</span>
      </div>
      <div className="rnm-conn">
        <CornerDownRight aria-hidden className="size-3.5" />
        <span>Standardized name assigned after analysis</span>
      </div>
      <p className="rnm-final rnm-final-ghost">{template}</p>
      <SegmentRow segments={segments} />
    </div>
  )
}

function SegmentRow({ segments }: { segments: ReadonlyArray<Segment> }) {
  return (
    <div className="rnm-segs" aria-hidden>
      {segments.map((seg) => (
        <span
          key={seg.key}
          className={`rnm-seg${seg.accent ? ' accent' : ''}${
            seg.ghost ? ' ghost' : ''
          }`}
        >
          <span className="k">{seg.label}</span>
          <span className="v">{seg.value}</span>
        </span>
      ))}
    </div>
  )
}
