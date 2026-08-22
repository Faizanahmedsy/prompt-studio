"use client"

import { ChevronDown, ChevronRight, Plus, Trash2, Workflow } from "lucide-react"
import { useState } from "react"

import { Glyph } from "@/components/icons/glyph"
import { EmptyState } from "@/components/shared/feedback"
import { TextField } from "@/components/shared/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  addScreen,
  deleteScreen,
  updateScreen,
} from "@/features/builder/utils/actions"
import { analyseGraph } from "@/features/builder/utils/graph"
import { AddMenu } from "@/features/library/components/add-menu"
import { LayoutPicker } from "@/features/library/components/layout-picker"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { describeLayout, layoutsForTemplate } from "@/features/library/data/layouts"
import {
  screenTemplateMap,
  screenTemplates,
} from "@/features/library/data/templates"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Surface } from "@/types/project"

import { ScreenConnections } from "./screen-connections"

/**
 * The list rendering of the same graph the canvas draws. Used on small screens
 * (where a pannable canvas is hostile) and as a keyboard-friendly alternative
 * everywhere else — one model, two views.
 */
export function OutlineList({
  project,
  surface = "web",
}: {
  project: Project
  surface?: Surface
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const select = useUiStore((s) => s.select)

  // Mobile-width fallback for the canvas — it shows one build at a time too.
  const surfaceScreens = project.screens.filter((s) => s.surface === surface)
  const surfaceIds = new Set(surfaceScreens.map((s) => s.id))
  const surfaceEdges = project.edges.filter(
    (e) => surfaceIds.has(e.from) && surfaceIds.has(e.to)
  )
  const { ordered, entries } = analyseGraph(surfaceScreens, surfaceEdges)
  const entryIds = new Set(entries.map((s) => s.id))
  const pickerScreen = project.screens.find((s) => s.id === pickerFor)

  // Easy mode has no library pane, so the list carries its own add affordance.
  const addMenu = (
    <AddMenu
      label="Add screen"
      items={screenTemplates}
      onPick={(template) => {
        const id = addScreen(template)
        if (id) select(id)
      }}
    />
  )

  if (!surfaceScreens.length) {
    return (
      <EmptyState
        icon={<Workflow />}
        title="No screens yet"
        description="Add a screen to start describing the app."
        action={
          advanced ? (
            <Button size="sm" onClick={() => addScreen("auth")}>
              <Plus /> Add screen
            </Button>
          ) : (
            addMenu
          )
        }
      />
    )
  }

  return (
    // Extra bottom padding in Easy mode so the floating settings bar never
    // covers the last screen in the list.
    <div className={cn("space-y-2 p-3", !advanced && "pb-24")}>
      {!advanced && <div className="flex justify-end">{addMenu}</div>}
      {ordered.map((screen, index) => {
        const template = screenTemplateMap[screen.template]
        const layout = describeLayout(screen.layout)
        const open = openId === screen.id
        const outgoing = project.edges.filter((e) => e.from === screen.id)

        return (
          <div
            key={screen.id}
            className={cn(
              "overflow-hidden rounded-xl border bg-card transition-colors",
              open ? "border-primary/40" : "border-border"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenId(open ? null : screen.id)}
              className="flex w-full items-center gap-2.5 p-2.5 text-left"
              aria-expanded={open}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                <Glyph name={template?.icon ?? "file"} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{screen.title}</span>
                  {entryIds.has(screen.id) && (
                    <Badge variant="success">Start</Badge>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {index + 1}. {layout.name}
                  {outgoing.length > 0 && ` · ${outgoing.length} connection${outgoing.length === 1 ? "" : "s"}`}
                </span>
              </span>
              <span className="w-24 shrink-0">
                <LayoutThumb
                  wire={layout.wire}
                  size="sm"
                  accent={project.theme.primaryColor}
                />
              </span>
              {open ? (
                <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
            </button>

            {open && (
              <div className="space-y-3 border-t border-border p-3">
                <TextField
                  label="Title"
                  value={screen.title}
                  onChange={(event) =>
                    updateScreen(screen.id, { title: event.target.value })
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => setPickerFor(screen.id)}
                >
                  Change layout — {layout.name}
                </Button>
                <ScreenConnections project={project} screenId={screen.id} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full text-destructive"
                  onClick={() => deleteScreen(screen.id)}
                >
                  <Trash2 /> Delete screen
                </Button>
              </div>
            )}
          </div>
        )
      })}

      {pickerScreen && (
        <LayoutPicker
          open={Boolean(pickerFor)}
          onOpenChange={(open) => !open && setPickerFor(null)}
          layouts={layoutsForTemplate(pickerScreen.template)}
          selected={pickerScreen.layout}
          accent={project.theme.primaryColor}
          onSelect={(layoutId) => updateScreen(pickerScreen.id, { layout: layoutId })}
        />
      )}
    </div>
  )
}
