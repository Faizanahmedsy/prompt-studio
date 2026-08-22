"use client"

import { LayoutPanelTop } from "lucide-react"

import { EmptyState } from "@/components/shared/feedback"
import { addSection } from "@/features/builder/utils/actions"
import { AddMenu } from "@/features/library/components/add-menu"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { describeLayout } from "@/features/library/data/layouts"
import { sectionTypeMap, sectionTypes } from "@/features/library/data/section-types"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project } from "@/types/project"

/** The page as it will be assembled — every section stacked in order. */
export function LandingPreview({ project }: { project: Project }) {
  const selectedId = useUiStore((s) => s.selectedId)
  const select = useUiStore((s) => s.select)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const ordered = [...project.sections].sort((a, b) => a.order - b.order)

  const addSectionMenu = (
    <AddMenu
      label="Add section"
      items={sectionTypes}
      onPick={(type) => {
        const id = addSection(type)
        if (id) select(id)
      }}
    />
  )

  if (!ordered.length) {
    return (
      <EmptyState
        icon={<LayoutPanelTop />}
        title="No sections yet"
        description={
          advanced
            ? "Add sections from the library on the left. They stack in the order you add them, and that order is exactly what the prompt describes."
            : "Sections stack in the order you add them, and that order is exactly what the prompt describes."
        }
        action={!advanced ? addSectionMenu : undefined}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 p-4">
      {!advanced && <div className="flex justify-end">{addSectionMenu}</div>}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {ordered.map((section, index) => {
          const layout = describeLayout(section.layout)
          const meta = sectionTypeMap[section.type]
          const selected = selectedId === section.id
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => select(section.id)}
              className={cn(
                "group relative block w-full border-b border-border p-3 text-left transition-colors last:border-b-0",
                selected ? "bg-primary-soft/50" : "hover:bg-muted/50"
              )}
            >
              <span className="mb-2 flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="text-xs font-medium">
                  {section.name || meta?.name || section.type}
                </span>
                <span className="truncate text-[11px] text-muted-foreground">
                  {layout.name}
                </span>
              </span>
              <LayoutThumb
                wire={layout.wire}
                accent={project.theme.primaryColor}
                selected={selected}
                interactive
              />
            </button>
          )
        })}
      </div>
      <p className="text-center text-[11px] text-muted-foreground">
        Preview of section order and arrangement — not a pixel rendering.
      </p>
    </div>
  )
}
