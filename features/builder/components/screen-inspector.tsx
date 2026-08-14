"use client"

import { Copy, Trash2 } from "lucide-react"
import { useState } from "react"

import { SelectField, TextAreaField, TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { LayoutPicker } from "@/features/library/components/layout-picker"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import {
  deleteScreen,
  duplicateScreen,
  updateScreen,
} from "@/features/builder/utils/actions"
import { describeLayout, layoutsForTemplate } from "@/features/library/data/layouts"
import { screenTemplates } from "@/features/library/data/templates"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Screen } from "@/types/project"

import { ScreenConnections } from "./screen-connections"

export function ScreenInspector({
  project,
  screen,
}: {
  project: Project
  screen: Screen
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const select = useUiStore((s) => s.select)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const layout = describeLayout(screen.layout)

  return (
    <div className="space-y-4">
      <TextField
        label="Title"
        value={screen.title}
        onChange={(event) => updateScreen(screen.id, { title: event.target.value })}
      />

      {advanced && (
        <TextField
          label="Key"
          hint="Used in Flow source and in the generated prompt."
          value={screen.key}
          onChange={(event) => updateScreen(screen.id, { key: event.target.value })}
          className="[&_input]:font-mono [&_input]:text-xs"
        />
      )}

      <SelectField
        label="Screen type"
        value={screen.template}
        onValueChange={(template) => {
          const meta = screenTemplates.find((t) => t.id === template)
          updateScreen(screen.id, {
            template,
            layout: screen.layout || (meta?.defaultLayout ?? ""),
          })
        }}
        options={screenTemplates.map((t) => ({ value: t.id, label: t.name }))}
      />

      <div className="space-y-1.5">
        <SectionLabel>Layout</SectionLabel>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="group w-full rounded-lg border border-border bg-surface p-2 text-left transition-colors hover:border-primary/50"
        >
          {screen.layout ? (
            <LayoutThumb
              wire={layout.wire}
              size="md"
              accent={project.theme.primaryColor}
              interactive
            />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
              Choose a layout
            </div>
          )}
          <span className="mt-2 block text-xs font-medium">{layout.name}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {layout.description}
          </span>
        </button>
      </div>

      <TextAreaField
        label="Notes for this screen"
        placeholder="Anything specific: fields, rules, edge cases…"
        rows={3}
        value={screen.note}
        onChange={(event) => updateScreen(screen.id, { note: event.target.value })}
      />

      <ScreenConnections project={project} screenId={screen.id} />

      <div className="flex gap-1.5 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => duplicateScreen(screen.id)}
        >
          <Copy /> Duplicate
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-destructive"
          onClick={() => {
            deleteScreen(screen.id)
            select(null)
          }}
        >
          <Trash2 /> Delete
        </Button>
      </div>

      <LayoutPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        layouts={layoutsForTemplate(screen.template)}
        selected={screen.layout}
        accent={project.theme.primaryColor}
        title={`Layout for “${screen.title}”`}
        onSelect={(layoutId) => updateScreen(screen.id, { layout: layoutId })}
      />
    </div>
  )
}
