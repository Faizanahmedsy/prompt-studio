"use client"

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react"
import { useState } from "react"

import { TextAreaField, TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import {
  deleteSection,
  moveSection,
  updateSection,
} from "@/features/builder/utils/actions"
import { LayoutPicker } from "@/features/library/components/layout-picker"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { describeLayout, layoutsForSection } from "@/features/library/data/layouts"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Section } from "@/types/project"

export function SectionInspector({
  project,
  section,
}: {
  project: Project
  section: Section
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const select = useUiStore((s) => s.select)
  const layout = describeLayout(section.layout)
  const options = layoutsForSection(section.type)

  return (
    <div className="space-y-4">
      <TextField
        label="Section name"
        value={section.name}
        onChange={(event) => updateSection(section.id, { name: event.target.value })}
      />

      <div className="space-y-1.5">
        <SectionLabel>Layout</SectionLabel>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="group w-full rounded-lg border border-border bg-surface p-2 text-left transition-colors hover:border-primary/50"
        >
          <LayoutThumb
            wire={layout.wire}
            accent={project.theme.primaryColor}
            interactive
          />
          <span className="mt-2 block text-xs font-medium">{layout.name}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {layout.description}
          </span>
        </button>
      </div>

      <TextAreaField
        label="Notes"
        rows={3}
        placeholder="Copy direction, must-have content, links…"
        value={section.note}
        onChange={(event) => updateSection(section.id, { note: event.target.value })}
      />

      <div className="flex gap-1.5 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() => moveSection(section.id, -1)}
          aria-label="Move section up"
        >
          <ArrowUp />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => moveSection(section.id, 1)}
          aria-label="Move section down"
        >
          <ArrowDown />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-destructive"
          onClick={() => {
            deleteSection(section.id)
            select(null)
          }}
        >
          <Trash2 /> Delete
        </Button>
      </div>

      <LayoutPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        layouts={options}
        selected={section.layout}
        accent={project.theme.primaryColor}
        title={`Layout for ${section.name}`}
        onSelect={(layoutId) => updateSection(section.id, { layout: layoutId })}
      />
    </div>
  )
}
