import '@xyflow/react/dist/style.css'

import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
} from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import dagre from 'dagre'
import {
  ArrowLeft,
  Brain,
  FileText,
  GitBranch,
  Network,
  Rows3,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import type { JSX } from 'react'

import { buildRelationshipGraph } from '#/lib/intelligence-relationships'
import type {
  RelationshipEdgeKind,
  RelationshipGraph,
  RelationshipMode,
  RelationshipNodeKind,
} from '#/lib/intelligence-relationships'
import { intelligenceWorkspaceQuery } from '#/lib/queries'
import { getIntelligencePreviewEnabled } from '#/server/fns/intelligencePreviewEnabled'
import { categoryLabels } from '#/server/intelligence/catalog'
import type {
  IntelligenceCategoryId,
  IntelligenceDocument,
} from '#/server/intelligence/types'

type RelationshipSearch = {
  document?: string
  mode?: RelationshipMode
}

type RelationshipFlowNodeData = Record<string, unknown> & {
  label: string
  eyebrow: string
  detail: string
  metric?: string
  kind: RelationshipNodeKind
  active: boolean
  sourcePosition: Position
  targetPosition: Position
}

type RelationshipFlowNode = Node<RelationshipFlowNodeData, 'relationship'>

const relationshipModes = new Set<RelationshipMode>(['tree', 'graph'])
const NODE_WIDTH = 250
const NODE_HEIGHT = 104

const edgeLabels: Record<RelationshipEdgeKind, string> = {
  contains: 'Contains',
  same_vendor: 'Same vendor',
  same_filing: 'Same filing',
  same_ppp: 'PPP match',
  same_source: 'Same source',
  same_category: 'Same category',
  shared_identifier: 'Shared identifier',
  manual: 'Manual link',
  source_evidence: 'Evidence',
  suggested_apply: 'Suggested apply',
}

export const Route = createFileRoute('/intelligence_/relationships')({
  beforeLoad: async () => {
    const { enabled } = await getIntelligencePreviewEnabled()
    if (!enabled) throw redirect({ to: '/' })
  },
  validateSearch: (s: Record<string, unknown>): RelationshipSearch => ({
    document: typeof s.document === 'string' ? s.document : undefined,
    mode:
      typeof s.mode === 'string' &&
      relationshipModes.has(s.mode as RelationshipMode)
        ? (s.mode as RelationshipMode)
        : 'tree',
  }),
  loader: ({ context, location }) => {
    const search = location.search as RelationshipSearch
    return context.queryClient.ensureQueryData(
      intelligenceWorkspaceQuery({
        selectedDocumentId: search.document,
      }),
    )
  },
  head: () => ({ meta: [{ title: 'Relationship Map | Schedio' }] }),
  component: IntelligenceRelationshipsPage,
})

function formatScore(score: number | undefined): string | undefined {
  if (typeof score !== 'number') return undefined
  return `${Math.round(score * 100)}%`
}

function relationshipSearch(input: {
  documentId?: string
  mode: RelationshipMode
}): RelationshipSearch {
  return {
    document: input.documentId,
    mode: input.mode,
  }
}

function workbenchSearch(input: { document?: IntelligenceDocument }): {
  document?: string
  segment?: string
  category: IntelligenceCategoryId | 'all'
} {
  return {
    document: input.document?.id,
    category: input.document?.categoryId ?? 'all',
  }
}

function nodeEyebrow(kind: RelationshipNodeKind): string {
  if (kind === 'scope') return 'Workspace'
  if (kind === 'category') return 'Category'
  if (kind === 'document') return 'Document'
  if (kind === 'segment') return 'Segment'
  if (kind === 'finding') return 'Finding'
  return 'Learning'
}

function RelationshipNodeCard({
  data,
}: NodeProps<RelationshipFlowNode>): JSX.Element {
  return (
    <div
      className={`intel-rf-node ${data.kind}${data.active ? ' active' : ''}`}
    >
      <Handle
        type="target"
        position={data.targetPosition}
        className="intel-rf-handle"
      />
      <span>{data.eyebrow}</span>
      <strong>{data.label}</strong>
      <em>{data.detail}</em>
      {data.metric ? <b>{data.metric}</b> : null}
      <Handle
        type="source"
        position={data.sourcePosition}
        className="intel-rf-handle"
      />
    </div>
  )
}

const nodeTypes = {
  relationship: RelationshipNodeCard,
}

function layoutRelationshipFlow(
  graph: RelationshipGraph,
  selectedNodeId: string | undefined,
): {
  nodes: Array<RelationshipFlowNode>
  edges: Array<Edge>
} {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: graph.mode === 'tree' ? 'TB' : 'LR',
    nodesep: graph.mode === 'tree' ? 34 : 54,
    ranksep: graph.mode === 'tree' ? 76 : 96,
    marginx: 40,
    marginy: 40,
  })

  for (const node of graph.nodes) {
    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })
  }
  for (const edge of graph.edges) {
    dagreGraph.setEdge(edge.source, edge.target)
  }
  dagre.layout(dagreGraph)

  return {
    nodes: graph.nodes.map((node) => {
      const position = dagreGraph.node(node.id) as
        | { x: number; y: number }
        | undefined
      return {
        id: node.id,
        type: 'relationship',
        position: {
          x: (position?.x ?? 0) - NODE_WIDTH / 2,
          y: (position?.y ?? 0) - NODE_HEIGHT / 2,
        },
        sourcePosition:
          graph.mode === 'tree' ? Position.Bottom : Position.Right,
        targetPosition: graph.mode === 'tree' ? Position.Top : Position.Left,
        data: {
          label: node.label,
          eyebrow: nodeEyebrow(node.kind),
          detail: node.detail,
          metric: node.metric,
          kind: node.kind,
          active: node.id === selectedNodeId,
          sourcePosition:
            graph.mode === 'tree' ? Position.Bottom : Position.Right,
          targetPosition: graph.mode === 'tree' ? Position.Top : Position.Left,
        },
      }
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label:
        edge.kind === 'contains'
          ? undefined
          : (formatScore(edge.score) ?? edgeLabels[edge.kind]),
      className: `intel-rf-edge ${edge.kind}`,
      animated: edge.kind === 'suggested_apply',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
      },
    })),
  }
}

function edgeDetail(edgeKind: RelationshipEdgeKind): string {
  if (edgeKind === 'same_vendor') return 'Shared vendor or contractor'
  if (edgeKind === 'same_filing') return 'Shared filing label'
  if (edgeKind === 'same_ppp') return 'Similar PPP percentage'
  if (edgeKind === 'same_source') return 'Same intake source type'
  if (edgeKind === 'source_evidence') return 'Evidence or learning link'
  if (edgeKind === 'suggested_apply') return 'Learning reuse suggestion'
  return 'Tree containment'
}

function IntelligenceRelationshipsPage() {
  const { document: selectedDocumentId, mode = 'tree' } = Route.useSearch()
  const workspaceQuery = useSuspenseQuery(
    intelligenceWorkspaceQuery({
      selectedDocumentId,
    }),
  )
  const workspace = workspaceQuery.data
  const graph = buildRelationshipGraph(workspace, {
    documentId: selectedDocumentId,
    mode,
  })
  const selectedDoc =
    (graph.focusDocumentId
      ? workspace.documents.find((doc) => doc.id === graph.focusDocumentId)
      : undefined) ?? workspace.documents.at(0)
  const [manualNodeId, setManualNodeId] = useState<string | null>(null)
  const selectedNodeId = graph.nodes.some((node) => node.id === manualNodeId)
    ? manualNodeId
    : graph.focusNodeId
  const flow = layoutRelationshipFlow(graph, selectedNodeId ?? undefined)
  const activeNode =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? graph.nodes.at(0)
  const activeEdges = graph.edges.filter(
    (edge) => edge.source === activeNode?.id || edge.target === activeNode?.id,
  )
  const activeDocument = activeNode?.documentId
    ? workspace.documents.find((doc) => doc.id === activeNode.documentId)
    : undefined

  return (
    <div className="intel-map-app">
      <aside className="intel-map-rail">
        <div className="intel-brand">
          <img src="/schedio-logo.svg" alt="Schedio Group" />
          <span>Intelligence</span>
        </div>
        <Link
          to="/intelligence"
          search={workbenchSearch({ document: selectedDoc })}
          className="intel-back-link unstyled-link"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Intelligence workbench
        </Link>

        <section className="intel-map-brief">
          <div>
            <p>Relationship map</p>
            <h1>{selectedDoc?.title ?? 'Document relationships'}</h1>
          </div>
          <span>{mode === 'tree' ? 'Tree mode' : 'Graph mode'}</span>
        </section>

        <div className="intel-map-mode" aria-label="Relationship mode">
          <Link
            to="/intelligence/relationships"
            search={relationshipSearch({
              documentId: graph.focusDocumentId,
              mode: 'tree',
            })}
            className={
              mode === 'tree' ? 'active unstyled-link' : 'unstyled-link'
            }
            aria-current={mode === 'tree' ? 'page' : undefined}
          >
            <Rows3 className="size-4" aria-hidden />
            Tree
          </Link>
          <Link
            to="/intelligence/relationships"
            search={relationshipSearch({
              documentId: graph.focusDocumentId,
              mode: 'graph',
            })}
            className={
              mode === 'graph' ? 'active unstyled-link' : 'unstyled-link'
            }
            aria-current={mode === 'graph' ? 'page' : undefined}
          >
            <Network className="size-4" aria-hidden />
            Graph
          </Link>
        </div>

        <div className="intel-map-stats" aria-label="Map metrics">
          <span>
            <b>{graph.nodes.length}</b> nodes
          </span>
          <span>
            <b>{graph.edges.length}</b> links
          </span>
          <span>
            <b>{graph.preview.documentMatchCount}</b> doc matches
          </span>
          <span>
            <b>{graph.preview.applyCount}</b> applies
          </span>
        </div>

        <div className="intel-map-docs" aria-label="Focus documents">
          {workspace.documents.map((doc) => {
            const active = doc.id === graph.focusDocumentId
            return (
              <Link
                to="/intelligence/relationships"
                search={relationshipSearch({ documentId: doc.id, mode })}
                className={`intel-map-doc unstyled-link${
                  active ? ' active' : ''
                }`}
                aria-current={active ? 'page' : undefined}
                key={doc.id}
              >
                <FileText className="size-4" aria-hidden />
                <span>
                  <strong>{doc.title}</strong>
                  <em>{categoryLabels[doc.categoryId]}</em>
                </span>
              </Link>
            )
          })}
        </div>
      </aside>

      <main className="intel-map-main">
        <header className="intel-map-top">
          <div>
            <p className="intel-kicker">
              {mode === 'tree' ? 'Intake structure' : 'Relationship matching'}
            </p>
            <h2>
              {mode === 'tree'
                ? 'Source package → category → document → evidence'
                : 'Document evidence connected by reusable signals'}
            </h2>
          </div>
          <Link
            to="/intelligence"
            search={workbenchSearch({
              document: activeDocument ?? selectedDoc,
            })}
            className="intel-button unstyled-link"
          >
            <Brain className="size-4" aria-hidden />
            Open selected
          </Link>
        </header>

        <section className="intel-map-canvas" aria-label="Relationship canvas">
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.16 }}
            onNodeClick={(_event, node) => setManualNodeId(node.id)}
          >
            <Background color="rgba(100, 116, 139, 0.22)" gap={18} />
            <Controls showInteractive={false} />
            <MiniMap
              pannable
              zoomable
              nodeStrokeWidth={3}
              nodeColor={(node) =>
                node.id === selectedNodeId ? '#003da6' : '#d8dee8'
              }
            />
          </ReactFlow>
        </section>
      </main>

      <aside className="intel-map-inspector">
        <section>
          <p>Selected node</p>
          <h2>{activeNode?.label ?? 'No node selected'}</h2>
          <span>{activeNode ? nodeEyebrow(activeNode.kind) : 'Node'}</span>
          {activeNode?.metric ? <b>{activeNode.metric}</b> : null}
          <p>{activeNode?.detail}</p>
          {activeDocument ? (
            <Link
              to="/intelligence"
              search={workbenchSearch({ document: activeDocument })}
              className="intel-button primary unstyled-link"
            >
              <FileText className="size-4" aria-hidden />
              Review document
            </Link>
          ) : null}
        </section>

        <section>
          <p>Why it is connected</p>
          <div className="intel-map-link-list">
            {activeEdges.length > 0 ? (
              activeEdges.map((edge) => (
                <article key={edge.id}>
                  <GitBranch className="size-4" aria-hidden />
                  <div>
                    <strong>{edgeLabels[edge.kind]}</strong>
                    <span>
                      {formatScore(edge.score) ?? edgeDetail(edge.kind)}
                    </span>
                  </div>
                  <p>{edge.detail}</p>
                </article>
              ))
            ) : (
              <div className="intel-muted">No relationships selected.</div>
            )}
          </div>
        </section>

        <section>
          <p>Top matches</p>
          <div className="intel-map-link-list">
            {graph.preview.rows.length > 0 ? (
              graph.preview.rows.map((row) => (
                <article key={`${row.kind}-${row.documentId}-${row.title}`}>
                  <Sparkles className="size-4" aria-hidden />
                  <div>
                    <strong>{row.label}</strong>
                    <span>{formatScore(row.score)}</span>
                  </div>
                  <p>
                    {row.title} · {row.detail}
                  </p>
                </article>
              ))
            ) : (
              <div className="intel-muted">
                No deterministic matches found for this document yet.
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  )
}
