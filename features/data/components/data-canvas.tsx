"use client"

import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  MarkerType,
  type Node,
  type NodeChange,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { Database, LayoutGrid, Plus } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import {
  type Box,
  type Point,
  pathIsClear,
  routeAround,
} from "@/features/builder/utils/edge-routing"
import { overlapping } from "@/features/builder/utils/graph"
import {
  addEntity,
  arrangeEntities,
  connectEntities,
  connectEntityFields,
  deleteEntity,
  deleteRelation,
  moveEntity,
} from "@/features/data/utils/actions"
import { ENTITY_WIDTH, entityHeight } from "@/features/data/utils/geometry"
import { relationKindMeta } from "@/features/data/utils/relation-kinds"
import { checkDataModel } from "@/features/data/utils/schema"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

import { DataLegend } from "./data-legend"
import { EntityNode } from "./entity-node"
import { RelationEdge } from "./relation-edge"

const nodeTypes = { entity: EntityNode }
const edgeTypes = { relation: RelationEdge }

/** Kept clear of the floating toolbars — see the flow canvas for the why. */
const FIT = {
  padding: { top: "72px", right: "24px", bottom: "88px", left: "24px" },
  maxZoom: 1,
  minZoom: 0.15,
} as const

function DataCanvasInner({ project }: { project: Project }) {
  const select = useUiStore((s) => s.select)
  const selectedId = useUiStore((s) => s.selectedId)
  const { fitView } = useReactFlow()
  const [dragging, setDragging] = useState(false)
  const nodesInitialized = useNodesInitialized()
  const hasFitted = useRef(false)

  const issues = useMemo(() => checkDataModel(project), [project])
  const errorCount = issues.filter((issue) => issue.level === "error").length

  /** Column names that a relation joins, per table — drawn with a link icon. */
  const foreignKeys = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const relation of project.relations) {
      if (relation.fromField) {
        const set = map.get(relation.from) ?? new Set<string>()
        set.add(relation.fromField)
        map.set(relation.from, set)
      }
    }
    return map
  }, [project.relations])

  useEffect(() => {
    if (hasFitted.current || !nodesInitialized || !project.entities.length) return
    hasFitted.current = true

    // Tables that arrived from a Flow file, or from a model that never set a
    // position, are all at the origin — one card on top of another. Lay them
    // out before the first paint anyone sees.
    const stacked =
      project.entities.length > 1 &&
      (project.entities.every((entity) => entity.x === 0 && entity.y === 0) ||
        overlapping(project.entities, {
          heights: Object.fromEntries(
            project.entities.map((entity) => [
              entity.id,
              entityHeight(entity.fields.length),
            ])
          ),
          nodeWidth: ENTITY_WIDTH,
        }))
    if (stacked) {
      arrangeEntities({ silent: true })
      requestAnimationFrame(() => fitView({ ...FIT, duration: 0 }))
      return
    }
    fitView({ ...FIT, duration: 0 })
  }, [nodesInitialized, project.entities, fitView])

  const nodes: Node[] = useMemo(
    () =>
      project.entities.map((entity) => ({
        id: entity.id,
        type: "entity",
        position: { x: entity.x, y: entity.y },
        selected: entity.id === selectedId,
        width: ENTITY_WIDTH,
        height: entityHeight(entity.fields.length),
        data: {
          entity,
          foreignKeys: foreignKeys.get(entity.id) ?? new Set<string>(),
          relationCount: project.relations.filter(
            (relation) =>
              relation.from === entity.id || relation.to === entity.id
          ).length,
        },
      })),
    [project.entities, project.relations, foreignKeys, selectedId]
  )

  const boxes = useMemo(() => {
    const map = new Map<string, Box>()
    for (const entity of project.entities) {
      map.set(entity.id, {
        x: entity.x,
        y: entity.y,
        width: ENTITY_WIDTH,
        height: entityHeight(entity.fields.length),
      })
    }
    return map
  }, [project.entities])

  /** Paths around the tables, for relations that would otherwise cross one. */
  const routesRef = useRef<Map<string, Point[]>>(new Map())
  const routes = useMemo(() => {
    if (dragging) return routesRef.current
    const next = new Map<string, Point[]>()
    const all = [...boxes.entries()]
    const until = performance.now() + 220
    for (const relation of project.relations) {
      if (performance.now() > until) break
      const from = boxes.get(relation.from)
      const to = boxes.get(relation.to)
      if (!from || !to || relation.from === relation.to) continue
      const others = all
        .filter(([id]) => id !== relation.from && id !== relation.to)
        .map(([, box]) => box)
      if (pathIsClear(from, to, others)) continue
      const points = routeAround(from, to, others)
      if (points) next.set(relation.id, points)
    }
    routesRef.current = next
    return next
  }, [project.relations, boxes, dragging])

  const edges: Edge[] = useMemo(
    () =>
      project.relations.map((relation) => {
        const meta = relationKindMeta[relation.kind]
        const from = project.entities.find((e) => e.id === relation.from)
        const to = project.entities.find((e) => e.id === relation.to)
        const sourceHandle =
          from?.fields.find((f) => f.name === relation.fromField)?.id ?? null
        const targetHandle =
          to?.fields.find((f) => f.name === relation.toField)?.id ?? null
        return {
          id: relation.id,
          source: relation.from,
          target: relation.to,
          // Falling back to the whole card keeps a relation visible when the
          // column behind it was renamed away.
          sourceHandle,
          targetHandle,
          type: "relation",
          selected: relation.id === selectedId,
          data: {
            kind: relation.kind,
            label: relation.label,
            points: routes.get(relation.id),
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 16,
            height: 16,
            color: meta.color,
          },
        }
      }),
    [project.relations, project.entities, routes, selectedId]
  )

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        moveEntity(change.id, change.position.x, change.position.y)
      }
      if (change.type === "select" && change.selected) {
        useUiStore.getState().select(change.id)
      }
    }
  }, [])

  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {}, [])

  const onConnect = useCallback((connection: Connection) => {
    const { source, target, sourceHandle, targetHandle } = connection
    if (!source || !target) return
    if (source === target) {
      // A table pointing at itself is a real thing — `parent_id` on a category
      // tree — but it has to be drawn between two different columns.
      if (!sourceHandle || !targetHandle || sourceHandle === targetHandle) {
        toast.error("A table can only join itself through two different columns.")
        return
      }
    }
    if (sourceHandle && targetHandle) {
      connectEntityFields(source, sourceHandle, target, targetHandle)
      return
    }
    connectEntities(source, target)
  }, [])

  const onNodesDelete = useCallback((deleted: Node[]) => {
    for (const node of deleted) deleteEntity(node.id)
  }, [])

  const onEdgesDelete = useCallback((deleted: Edge[]) => {
    for (const edge of deleted) deleteRelation(edge.id)
  }, [])

  if (!project.entities.length) {
    return (
      <div className="canvas-grid relative h-full w-full">
        <EmptyState
          icon={<Database />}
          title="No tables yet"
          description="This is the data every build shares — the web app, the phone app and the service all read the same tables. Draw them here and the generated prompt carries the schema, the relations and the migrations instead of leaving the model to guess."
          action={
            <Button
              onClick={() => {
                const id = addEntity("Users")
                if (id) select(id)
              }}
            >
              <Plus /> Add first table
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodesDelete={onNodesDelete}
      onEdgesDelete={onEdgesDelete}
      onConnect={onConnect}
      onNodeDragStart={() => setDragging(true)}
      onNodeDragStop={() => setDragging(false)}
      onPaneClick={() => select(null)}
      onNodeClick={(_, node) => select(node.id)}
      onEdgeClick={(_, edge) => select(edge.id)}
      fitView
      fitViewOptions={FIT}
      minZoom={0.2}
      maxZoom={1.6}
      snapToGrid
      snapGrid={[10, 10]}
      proOptions={{ hideAttribution: true }}
      deleteKeyCode={["Backspace", "Delete"]}
      className="h-full w-full"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} />
      <Controls
        showInteractive={false}
        className="rounded-lg! border! border-border! bg-card! shadow-sm! [&_button]:border-border! [&_button]:bg-card! [&_button]:text-foreground! hover:[&_button]:bg-muted!"
      />
      <DataLegend relations={project.relations} />

      <div className="absolute left-3 top-3 z-10">
        <Button
          size="sm"
          onClick={() => {
            const id = addEntity()
            if (id) select(id)
          }}
        >
          <Plus /> Add table
        </Button>
      </div>

      <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1.5 rounded-xl border border-border bg-card/95 p-1 shadow-md backdrop-blur">
        <span
          className="flex items-center gap-1 px-2 text-[11px] text-muted-foreground"
          title="Tables · relations"
        >
          <Database className="size-3" />
          {project.entities.length} tables · {project.relations.length} relations
        </span>
        {errorCount > 0 && (
          <span
            className="flex items-center rounded-md bg-destructive-soft px-2 text-[11px] font-medium text-destructive"
            title={issues
              .filter((issue) => issue.level === "error")
              .map((issue) => issue.message)
              .join("\n")}
          >
            {errorCount} to fix
          </span>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            arrangeEntities()
            requestAnimationFrame(() => fitView({ ...FIT, duration: 250 }))
          }}
        >
          <LayoutGrid /> Auto-arrange
        </Button>
      </div>
    </ReactFlow>
  )
}

export function DataCanvas({ project }: { project: Project }) {
  return (
    <ReactFlowProvider key="data">
      <DataCanvasInner project={project} />
    </ReactFlowProvider>
  )
}
