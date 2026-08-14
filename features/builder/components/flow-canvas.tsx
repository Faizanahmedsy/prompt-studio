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
import { LayoutGrid, Plus, Workflow } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import { analyseGraph } from "@/features/builder/utils/graph"
import {
  addScreen,
  arrangeScreens,
  connectScreens,
  deleteEdge,
  deleteScreen,
  moveScreen,
} from "@/features/builder/utils/actions"
import { AddMenu } from "@/features/library/components/add-menu"
import { screenTemplates } from "@/features/library/data/templates"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

import { FlowEdge } from "./flow-edge"
import { ScreenNode } from "./screen-node"

const nodeTypes = { screen: ScreenNode }
const edgeTypes = { flow: FlowEdge }

function CanvasInner({ project }: { project: Project }) {
  const select = useUiStore((s) => s.select)
  const selectedId = useUiStore((s) => s.selectedId)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const { screenToFlowPosition, fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const hasFitted = useRef(false)

  /**
   * The canvas mounts inside a resizable panel, so on the first frame the pane
   * can still be zero-width and the nodes unmeasured — `fitView` then resolves
   * to minZoom and parks the graph off-screen. Wait until the nodes report
   * their real size, then fit once.
   */
  useEffect(() => {
    if (hasFitted.current || !nodesInitialized || !project.screens.length) return

    // Projects saved before the layout fix can hold runaway coordinates; a graph
    // wider than any real flow gets re-arranged instead of fitted to a viewport
    // where every node is a speck. The fit then happens on the next pass.
    const spread = Math.max(...project.screens.map((s) => s.x))
    if (spread > 400 * project.screens.length) {
      arrangeScreens()
      return
    }

    hasFitted.current = true
    fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.4, duration: 0 })
  }, [nodesInitialized, project.screens, fitView])

  const entries = useMemo(
    () => new Set(analyseGraph(project.screens, project.edges).entries.map((s) => s.id)),
    [project.screens, project.edges]
  )

  const nodes: Node[] = useMemo(
    () =>
      project.screens.map((screen) => ({
        id: screen.id,
        type: "screen",
        position: { x: screen.x, y: screen.y },
        selected: screen.id === selectedId,
        // Declared up front so bounds maths works before measurement lands.
        initialWidth: 224,
        initialHeight: 168,
        data: {
          screen,
          accent: project.theme.primaryColor,
          isEntry: entries.has(screen.id),
        },
      })),
    [project.screens, project.theme.primaryColor, entries, selectedId]
  )

  const edges: Edge[] = useMemo(
    () =>
      project.edges.map((edge) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.trigger || "",
        type: "flow",
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      })),
    [project.edges]
  )

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const change of changes) {
      if (change.type === "position" && change.position) {
        moveScreen(change.id, change.position.x, change.position.y)
      }
      if (change.type === "select" && change.selected) {
        useUiStore.getState().select(change.id)
      }
      if (change.type === "remove") deleteScreen(change.id)
    }
  }, [])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const change of changes) {
      if (change.type === "remove") deleteEdge(change.id)
    }
  }, [])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) {
      toast.error("A screen cannot connect to itself.")
      return
    }
    connectScreens(connection.source, connection.target)
  }, [])

  if (!project.screens.length) {
    return (
      <div className="canvas-grid relative h-full w-full">
        <EmptyState
          icon={<Workflow />}
          title="No screens yet"
          description={
            advanced
              ? "Add screens from the library on the left, paste a Flow file, or start from a template. Then drag from a screen's right edge to connect it to the next one."
              : "Add a screen, or paste a Flow file from the header. Then drag from a screen's right edge to the next screen to connect them."
          }
          action={
            advanced ? (
              <Button size="sm" onClick={() => addScreen("auth")}>
                <Plus /> Add first screen
              </Button>
            ) : (
              <AddMenu
                label="Add first screen"
                align="center"
                items={screenTemplates}
                onPick={(template) => {
                  const id = addScreen(template)
                  if (id) select(id)
                }}
              />
            )
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
      onConnect={onConnect}
      onPaneClick={() => select(null)}
      onNodeClick={(_, node) => select(node.id)}
      onDrop={(event) => {
        event.preventDefault()
        const template = event.dataTransfer.getData("application/x-template")
        if (!template) return
        const position = screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        })
        addScreen(template, position)
      }}
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
      }}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1, minZoom: 0.4 }}
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
      {!advanced && (
        <div className="absolute left-3 top-3 z-10">
          <AddMenu
            label="Add screen"
            items={screenTemplates}
            onPick={(template) => {
              const id = addScreen(template)
              if (id) select(id)
            }}
          />
        </div>
      )}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            arrangeScreens()
            // Re-fit after the new positions have rendered, otherwise a wider
            // graph spills past the pane edge.
            requestAnimationFrame(() =>
              fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.4, duration: 250 })
            )
          }}
        >
          <LayoutGrid /> Auto-arrange
        </Button>
      </div>
    </ReactFlow>
  )
}

export function FlowCanvas({ project }: { project: Project }) {
  return (
    <ReactFlowProvider>
      <CanvasInner project={project} />
    </ReactFlowProvider>
  )
}
