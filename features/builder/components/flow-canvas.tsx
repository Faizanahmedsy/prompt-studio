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
import {
  ChevronsDownUp,
  ChevronsUpDown,
  LayoutGrid,
  Workflow,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/feedback"
import { Button } from "@/components/ui/button"
import {
  addScreen,
  arrangeScreens,
  connectModules,
  connectScreens,
  deleteEdge,
  deleteModule,
  deleteModuleEdge,
  deleteScreen,
  moveScreen,
} from "@/features/builder/utils/actions"
import { inFlow } from "@/features/builder/utils/flows"
import { analyseGraph } from "@/features/builder/utils/graph"
import {
  CARD_HEIGHT_FALLBACK,
  expandedHeight,
  MODULE_HEIGHT,
  moduleOffsetY,
  nodeWidthFor,
  WELL_PAD,
} from "@/features/builder/utils/node-geometry"
import { surfaceMeta } from "@/features/builder/utils/surfaces"
import { edgesInView, inView } from "@/features/builder/utils/views"
import { AddMenu } from "@/features/library/components/add-menu"
import { screenTemplates } from "@/features/library/data/templates"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Surface } from "@/types/project"

import { FlowEdge } from "./flow-edge"
import { FlowSwitcher } from "./flow-switcher"
import { ModuleNode } from "./module-node"
import { ScreenNode } from "./screen-node"
import { ViewSwitcher } from "./view-switcher"

const nodeTypes = { screen: ScreenNode, module: ModuleNode }
const edgeTypes = { flow: FlowEdge }

function CanvasInner({
  project,
  surface,
}: {
  project: Project
  surface: Surface
}) {
  const select = useUiStore((s) => s.select)
  const selectedId = useUiStore((s) => s.selectedId)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const expandedScreenIds = useUiStore((s) => s.expandedScreenIds)
  const setExpandedScreens = useUiStore((s) => s.setExpandedScreens)
  const cardHeights = useUiStore((s) => s.cardHeights)
  const activeViewId = useUiStore((s) => s.activeViewId)
  const viewStrict = useUiStore((s) => s.viewStrict)
  const activeFlowId = useUiStore((s) => s.activeFlowId)
  const flowFaded = useUiStore((s) => s.flowFaded)

  /**
   * Filtering happens at render, not in the data: the project always holds the
   * whole app, and a view is a lens over it. Positions therefore stay stable
   * when you switch role, and nothing can be lost by looking at a subset.
   */
  const roleScreens = useMemo(
    () =>
      project.screens.filter(
        (screen) =>
          screen.surface === surface && inView(screen, activeViewId, viewStrict)
      ),
    [project.screens, surface, activeViewId, viewStrict]
  )

  /**
   * Journeys narrow what the role view already left. The two filters compose
   * rather than replace: a screen is shown when this role can reach it **and**
   * it belongs to the journey being looked at.
   *
   * With "show the rest, faded" on, nothing is removed — the screens outside
   * the journey are still drawn, dimmed, which is what you want at the moment
   * you need to see where the journey joins the rest of the app.
   */
  const visibleScreens = useMemo(
    () =>
      flowFaded
        ? roleScreens
        : roleScreens.filter((screen) => inFlow(screen, activeFlowId)),
    [roleScreens, activeFlowId, flowFaded]
  )

  const dimmed = useMemo(() => {
    if (!activeFlowId || !flowFaded) return new Set<string>()
    return new Set(
      roleScreens.filter((s) => !inFlow(s, activeFlowId)).map((s) => s.id)
    )
  }, [roleScreens, activeFlowId, flowFaded])

  const visibleEdges = useMemo(() => {
    const ids = new Set(visibleScreens.map((s) => s.id))
    return edgesInView(project, activeViewId, viewStrict).filter(
      (e) => ids.has(e.from) && ids.has(e.to)
    )
  }, [project, visibleScreens, activeViewId, viewStrict])
  const { screenToFlowPosition, fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()
  const hasFitted = useRef(false)

  /**
   * The canvas mounts inside a resizable panel, so on the first frame the pane
   * can still be zero-width and the nodes unmeasured — `fitView` then resolves
   * to minZoom and parks the graph off-screen. Wait until the nodes report
   * their real size, then fit once.
   */
  // biome-ignore lint/correctness/useExhaustiveDependencies: one-shot, guarded by `hasFitted` — depending on the screens array would re-run it on every drag
  useEffect(() => {
    if (hasFitted.current || !nodesInitialized || !project.screens.length) return
    hasFitted.current = true

    // Projects saved before the layout fix can hold runaway coordinates; a graph
    // wider than any real flow gets re-arranged instead of fitted to a viewport
    // where every node is a speck. Guarded by the same ref so a graph that
    // somehow stays wide can never re-trigger this in a loop.
    const spread = Math.max(...project.screens.map((s) => s.x))
    if (spread > 400 * project.screens.length) {
      arrangeScreens()
      requestAnimationFrame(() =>
        fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.4, duration: 0 })
      )
      return
    }

    fitView({ padding: 0.2, maxZoom: 1, minZoom: 0.4, duration: 0 })
  }, [nodesInitialized, project.screens.length, fitView])

  const entries = useMemo(
    () => new Set(analyseGraph(visibleScreens, visibleEdges).entries.map((s) => s.id)),
    [visibleScreens, visibleEdges]
  )

  const modulesByScreen = useMemo(() => {
    const map = new Map<string, typeof project.modules>()
    for (const module of [...project.modules].sort((a, b) => a.order - b.order)) {
      const list = map.get(module.screenId)
      if (list) list.push(module)
      else map.set(module.screenId, [module])
    }
    return map
  }, [project.modules])

  const openScreens = useMemo(
    () => new Set(expandedScreenIds.filter((id) => project.screens.some((s) => s.id === id))),
    [expandedScreenIds, project.screens]
  )

  // Expand-all only concerns screens that have something to show.
  const screensWithModules = useMemo(
    () =>
      project.screens
        .filter((s) => modulesByScreen.has(s.id))
        .map((s) => s.id),
    [project.screens, modulesByScreen]
  )
  const allExpanded =
    screensWithModules.length > 0 &&
    screensWithModules.every((id) => openScreens.has(id))

  /** How tall each node is for a given set of expanded screens. */
  const heightsFor = useCallback(
    (open: Set<string>) => {
      const heights: Record<string, number> = {}
      for (const screen of project.screens) {
        const card = cardHeights[screen.id] ?? CARD_HEIGHT_FALLBACK
        const count = modulesByScreen.get(screen.id)?.length ?? 0
        heights[screen.id] = open.has(screen.id)
          ? expandedHeight(card, count)
          : card
      }
      return heights
    },
    [project.screens, cardHeights, modulesByScreen]
  )

  const renderedHeights = useCallback(
    () => heightsFor(openScreens),
    [heightsFor, openScreens]
  )

  const toggleAll = useCallback(() => {
    setExpandedScreens(allExpanded ? [] : screensWithModules)
  }, [allExpanded, screensWithModules, setExpandedScreens])

  /**
   * Re-space the graph whenever the set of expanded screens changes, from
   * wherever — the node chip, the well's Collapse button, the inspector, or
   * Expand all.
   *
   * An expanded screen is several times taller than a collapsed one, and the
   * stored positions were chosen for whatever it was before, so without this
   * the cards land on top of each other. Doing it here rather than in each
   * toggle means there is one place that can get it wrong.
   */
  const expandSignature = useMemo(
    () => [...openScreens].sort().join("|"),
    [openScreens]
  )
  const lastExpanded = useRef<{ signature: string; ids: Set<string> } | null>(null)

  useEffect(() => {
    const previous = lastExpanded.current
    lastExpanded.current = { signature: expandSignature, ids: openScreens }

    // First render: adopt the current state without moving anything, so simply
    // opening the app never reflows a layout the user arranged by hand.
    if (!previous || previous.signature === expandSignature) return
    if (!project.screens.length) return

    arrangeScreens(heightsFor(openScreens), { silent: true })

    // One screen toggling is a local change and the user's viewport should stay
    // put; a bulk expand changes the whole graph's size, so re-fit for that.
    const changed = new Set([...previous.ids, ...openScreens])
    for (const id of previous.ids) if (openScreens.has(id)) changed.delete(id)
    if (changed.size > 1) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          fitView({ padding: 0.15, maxZoom: 1, minZoom: 0.15, duration: 300 })
        )
      )
    }
  }, [expandSignature, openScreens, heightsFor, project.screens.length, fitView])

  /**
   * Switching role re-lays out and re-fits what that role can see.
   *
   * Filtering alone was not enough to notice: the stored positions were chosen
   * for the whole app, so hiding 17 of 96 screens left the remaining 79 exactly
   * where they were, with gaps — the canvas looked unchanged. Laying out the
   * subset and fitting to it makes the switch read as "this is that role's
   * flow" rather than "the same picture, slightly emptier".
   */
  const lastView = useRef<string | undefined>(undefined)

  useEffect(() => {
    const previous = lastView.current
    const signature = `${activeViewId ?? ""}:${viewStrict}:${activeFlowId ?? ""}:${flowFaded}`
    lastView.current = signature

    // Undefined on the first render — adopt the current view without moving
    // anything, so opening the app never reflows a hand-arranged layout.
    if (previous === undefined || previous === signature) return
    if (!visibleScreens.length) return

    arrangeScreens(heightsFor(openScreens), {
      silent: true,
      only: visibleScreens.map((s) => s.id),
    })
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        fitView({ padding: 0.15, maxZoom: 1, minZoom: 0.1, duration: 350 })
      )
    )
  }, [
    activeViewId,
    viewStrict,
    activeFlowId,
    flowFaded,
    visibleScreens,
    heightsFor,
    openScreens,
    fitView,
  ])

  const nodes: Node[] = useMemo(() => {
    const out: Node[] = []
    for (const screen of visibleScreens) {
      const modules = modulesByScreen.get(screen.id) ?? []
      const expanded = openScreens.has(screen.id)
      const cardHeight = cardHeights[screen.id] ?? CARD_HEIGHT_FALLBACK
      const nodeWidth = nodeWidthFor(surface)

      out.push({
        id: screen.id,
        type: "screen",
        position: { x: screen.x, y: screen.y },
        selected: screen.id === selectedId,
        // Declared up front so bounds maths works before measurement lands.
        width: nodeWidth,
        // An expanded screen is a container, and `extent: "parent"` clamps its
        // children into whatever height it declares — declare it too short and
        // every module row piles up on the last pixel that fits. Collapsed
        // screens take their natural height, as they always did.
        ...(expanded
          ? { height: expandedHeight(cardHeight, modules.length) }
          : { initialHeight: CARD_HEIGHT_FALLBACK }),
        data: {
          screen,
          accent: project.theme.primaryColor,
          isEntry: entries.has(screen.id),
          moduleCount: modules.length,
          expanded,
          dimmed: dimmed.has(screen.id),
          flowNames: project.flows
            .filter((flow) => screen.flows.includes(flow.id))
            .map((flow) => flow.name),
        },
      })

      if (!expanded) continue

      // Children must follow their parent in the array — xyflow resolves
      // `parentId` in one pass.
      modules.forEach((module, index) => {
        out.push({
          id: module.id,
          type: "module",
          parentId: screen.id,
          extent: "parent",
          // Position is derived, not stored: modules are an ordered list, and
          // letting them be dragged loose inside the well would make the order
          // shown disagree with the order the prompt emits.
          draggable: false,
          position: { x: WELL_PAD, y: moduleOffsetY(cardHeight, index) },
          width: nodeWidth - WELL_PAD * 2,
          height: MODULE_HEIGHT,
          selected: module.id === selectedId,
          data: { module },
        })
      })
    }
    return out
  }, [
    visibleScreens,
    project.theme.primaryColor,
    project.flows,
    modulesByScreen,
    openScreens,
    cardHeights,
    dimmed,
    entries,
    selectedId,
    surface,
  ])

  const edges: Edge[] = useMemo(() => {
    const out: Edge[] = visibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: edge.trigger || "",
      type: "flow",
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    }))

    // Inner transitions only exist while both ends are on screen; drawing them
    // to a collapsed screen would render an arrow from nowhere.
    const visibleModules = new Set(
      project.modules
        .filter((m) => openScreens.has(m.screenId))
        .map((m) => m.id)
    )
    for (const edge of project.moduleEdges) {
      if (!visibleModules.has(edge.from) || !visibleModules.has(edge.to)) continue
      out.push({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.trigger || "",
        type: "flow",
        animated: false,
        data: { level: "module" },
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
      })
    }
    return out
  }, [visibleEdges, project.moduleEdges, project.modules, openScreens])

  const isModule = useCallback(
    (id: string) => project.modules.some((m) => m.id === id),
    [project.modules]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position) {
          // Module rows are not draggable, so any position change is a screen.
          if (!isModule(change.id)) {
            moveScreen(change.id, change.position.x, change.position.y)
          }
        }
        if (change.type === "select" && change.selected) {
          useUiStore.getState().select(change.id)
        }
        // `remove` is deliberately NOT handled here — see onNodesDelete.
      }
    },
    // `isModule` closes over `project.modules`; pinned to `[]` this held a
    // stale copy and misclassified any module added since the last render.
    [isModule]
  )

  /**
   * Deletion is handled here rather than through the `remove` change, because
   * xyflow also emits `remove` when it prunes elements that merely stopped
   * being rendered. Collapsing a screen unmounts its module rows, which pruned
   * their edges, which deleted them from the project — the graph quietly lost
   * its connections every time a screen was collapsed. These two callbacks fire
   * only for deletions the user actually asked for.
   */
  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        if (isModule(node.id)) deleteModule(node.id)
        else deleteScreen(node.id)
      }
    },
    [isModule]
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        if (project.moduleEdges.some((e) => e.id === edge.id)) {
          deleteModuleEdge(edge.id)
        } else {
          deleteEdge(edge.id)
        }
      }
    },
    [project.moduleEdges]
  )

  // Required for a controlled graph; selection is the only change it carries.
  const onEdgesChange = useCallback((_changes: EdgeChange[]) => {}, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      const { source, target } = connection
      if (!source || !target) return
      if (source === target) {
        toast.error("A node cannot connect to itself.")
        return
      }

      const fromModule = project.modules.find((m) => m.id === source)
      const toModule = project.modules.find((m) => m.id === target)

      if (fromModule && toModule) {
        if (fromModule.screenId !== toModule.screenId) {
          toast.error("Modules can only connect inside their own screen.", {
            description:
              "To move between screens, connect the screens themselves.",
          })
          return
        }
        connectModules(source, target)
        return
      }
      if (fromModule || toModule) {
        toast.error("Connect a module to another module in the same screen.", {
          description: "Screen-to-screen navigation uses the screen ports.",
        })
        return
      }

      connectScreens(source, target)
    },
    [project.modules]
  )

  // An empty surface is the normal starting point for Mobile and Backend, so it
  // gets an invitation rather than the "nothing here" of a broken filter.
  if (!visibleScreens.length && !activeViewId) {
    return (
      <div className="canvas-grid relative h-full w-full">
        <EmptyState
          icon={<Workflow />}
          title={`No ${surfaceMeta[surface].label.toLowerCase()} screens yet`}
          description={`${surfaceMeta[surface].hint}. Add a screen here, or paste a Flow file from the header — screens land on whichever tab you are on.`}
          action={
            <AddMenu
              label="Add first screen"
              align="center"
              items={screenTemplates}
              onPick={(template) => {
                const id = addScreen(template, undefined, surface)
                if (id) select(id)
              }}
            />
          }
        />
      </div>
    )
  }

  if (
    !visibleScreens.length &&
    project.screens.length &&
    (activeViewId || activeFlowId)
  ) {
    return (
      <div className="canvas-grid relative h-full w-full">
        <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1.5">
          <FlowSwitcher project={project} screens={roleScreens} />
          <ViewSwitcher project={project} />
        </div>
        <EmptyState
          icon={<Workflow />}
          title={
            activeFlowId ? "No screens in this journey" : "No screens in this view"
          }
          description={
            activeFlowId
              ? "Tag screens into this journey from the inspector, or switch back to Whole app."
              : "Tag screens with this role in the inspector, or switch back to All views."
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
        addScreen(template, position, surface)
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
              const id = addScreen(template, undefined, surface)
              if (id) select(id)
            }}
          />
        </div>
      )}
      <div className="absolute right-3 top-3 z-10 flex flex-wrap justify-end gap-1.5">
        <FlowSwitcher project={project} screens={roleScreens} />
        <ViewSwitcher project={project} />
        {screensWithModules.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={toggleAll}
            title={
              allExpanded
                ? "Hide the modules inside every screen"
                : "Show the modules inside every screen"
            }
          >
            {allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            // Arrange for the sizes on screen right now, expanded ones included.
            arrangeScreens(renderedHeights())
            // Re-fit after the new positions have rendered, otherwise a wider
            // graph spills past the pane edge.
            requestAnimationFrame(() =>
              fitView({ padding: 0.15, maxZoom: 1, minZoom: 0.15, duration: 250 })
            )
          }}
        >
          <LayoutGrid /> Auto-arrange
        </Button>
      </div>
    </ReactFlow>
  )
}

export function FlowCanvas({
  project,
  surface = "web",
}: {
  project: Project
  surface?: Surface
}) {
  return (
    // Keyed by surface so switching tabs remounts the canvas with its own
    // viewport and fit state, rather than inheriting the previous build's.
    <ReactFlowProvider key={surface}>
      <CanvasInner project={project} surface={surface} />
    </ReactFlowProvider>
  )
}
