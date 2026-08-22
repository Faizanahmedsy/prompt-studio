"use client"

import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react"
import { useState } from "react"

import { Glyph } from "@/components/icons/glyph"
import { PanelBody, PanelHeader, SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { Hint } from "@/components/ui/misc"
import {
  addScreen,
  addSection,
  moveSection,
  reorderScreens,
  reorderSections,
} from "@/features/builder/utils/actions"
import { analyseGraph } from "@/features/builder/utils/graph"
import { sectionTypes } from "@/features/library/data/section-types"
import { screenTemplates } from "@/features/library/data/templates"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/** Left pane: what you can add, and what you have added. */
export function LibraryPanel({ project }: { project: Project }) {
  const mode = useUiStore((s) => s.mode)
  const selectedId = useUiStore((s) => s.selectedId)
  const select = useUiStore((s) => s.select)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const landing = mode === "landing"
  const items = landing
    ? [...project.sections].sort((a, b) => a.order - b.order)
    : analyseGraph(project.screens, project.edges).ordered

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={landing ? "Sections" : "Screens"}
        count={items.length}
      />
      <PanelBody className="space-y-4">
        <div className="space-y-1.5">
          <SectionLabel>{landing ? "Add a section" : "Add a screen"}</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {(landing ? sectionTypes : screenTemplates).map((entry) => (
              <button
                key={entry.id}
                type="button"
                draggable={!landing}
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-template", entry.id)
                  event.dataTransfer.effectAllowed = "copy"
                }}
                onClick={() => {
                  const id = landing ? addSection(entry.id) : addScreen(entry.id)
                  if (id) select(id)
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[11px] font-medium transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
                title={entry.description}
              >
                <Glyph name={entry.icon} className="size-3.5 shrink-0 text-primary" />
                <span className="truncate">{entry.name}</span>
              </button>
            ))}
          </div>
          {!landing && (
            <p className="pt-1 text-[10px] text-muted-foreground">
              Drag onto the canvas to place precisely.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <SectionLabel>
            {landing ? "Page order" : "Flow order"}
          </SectionLabel>
          {items.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              Nothing added yet.
            </p>
          ) : (
            <ul className="space-y-1">
              {items.map((item, index) => {
                const meta = landing
                  ? sectionTypes.find((s) => s.id === (item as { type: string }).type)
                  : screenTemplates.find(
                      (t) => t.id === (item as { template: string }).template
                    )
                const label =
                  "title" in item ? item.title : (item as { name: string }).name
                return (
                  <li key={item.id}>
                    {/* A drag source with no click role. Dragging is one of
                        two ways to add from the library — the canvas has its
                        own "Add screen" picker — so this is not the only path,
                        but making the panel keyboard-operable is real work that
                        belongs in its own change rather than here. */}
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: see above */}
                    <div
                      draggable
                      onDragStart={(event) => {
                        setDragId(item.id)
                        event.dataTransfer.effectAllowed = "move"
                        // Firefox refuses to start a drag without payload.
                        event.dataTransfer.setData("text/plain", item.id)
                      }}
                      onDragEnd={() => {
                        setDragId(null)
                        setDropIndex(null)
                      }}
                      onDragOver={(event) => {
                        if (!dragId || dragId === item.id) return
                        event.preventDefault()
                        event.dataTransfer.dropEffect = "move"
                        const box = event.currentTarget.getBoundingClientRect()
                        const after = event.clientY > box.top + box.height / 2
                        setDropIndex(index + (after ? 1 : 0))
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId = dragId ?? event.dataTransfer.getData("text/plain")
                        const fromIndex = items.findIndex((i) => i.id === sourceId)
                        let target = dropIndex ?? index
                        if (fromIndex !== -1 && fromIndex < target) target -= 1
                        if (sourceId) {
                          if (landing) reorderSections(sourceId, target)
                          else reorderScreens(sourceId, target)
                        }
                        setDragId(null)
                        setDropIndex(null)
                      }}
                      className={cn(
                        "group flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors active:cursor-grabbing",
                        selectedId === item.id
                          ? "bg-primary-soft text-foreground"
                          : "hover:bg-muted",
                        dragId === item.id && "opacity-40",
                        dropIndex === index &&
                          dragId !== item.id &&
                          "border-t-2 border-primary",
                        dropIndex === index + 1 &&
                          dragId !== item.id &&
                          "border-b-2 border-primary"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => select(item.id)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      >
                        <span className="w-4 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                          {index + 1}
                        </span>
                        <Glyph
                          name={meta?.icon ?? "file"}
                          className="size-3.5 shrink-0 text-muted-foreground"
                        />
                        <span className="truncate text-xs">{label}</span>
                      </button>
                      {landing && (
                        <span className="flex shrink-0 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <Hint label="Move up">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              disabled={index === 0}
                              onClick={() => moveSection(item.id, -1)}
                              aria-label={`Move ${label} up`}
                            >
                              <ArrowUp />
                            </Button>
                          </Hint>
                          <Hint label="Move down">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              disabled={index === items.length - 1}
                              onClick={() => moveSection(item.id, 1)}
                              aria-label={`Move ${label} down`}
                            >
                              <ArrowDown />
                            </Button>
                          </Hint>
                        </span>
                      )}
                      <GripVertical className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => {
            const id = landing ? addSection("hero") : addScreen("")
            if (id) select(id)
          }}
        >
          <Plus /> {landing ? "Blank section" : "Blank screen"}
        </Button>
      </PanelBody>
    </div>
  )
}
