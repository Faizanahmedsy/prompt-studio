"use client"

import { Trash2 } from "lucide-react"

import { TextAreaField, TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { deleteFlow, toggleScreenFlow, updateFlow } from "@/features/builder/utils/actions"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { FlowGroup, Project } from "@/types/project"

import { StoryEditor } from "./story-editor"

/**
 * A journey: its name, its story, and which screens are in it.
 *
 * Opened by picking a journey in the flow switcher — "click a flow and see its
 * user story" is the whole point of the second view, so selecting one on the
 * toolbar selects it here too rather than needing a second click somewhere else.
 */
export function FlowInspector({
  project,
  flow,
}: {
  project: Project
  flow: FlowGroup
}) {
  const select = useUiStore((s) => s.select)
  const setActiveFlow = useUiStore((s) => s.setActiveFlow)
  const activeFlowId = useUiStore((s) => s.activeFlowId)
  const advanced = useUiStore((s) => s.experience === "advanced")

  const members = project.screens.filter((s) => s.flows.includes(flow.id))

  return (
    <div className="space-y-4">
      <TextField
        label="Journey"
        value={flow.name}
        onChange={(event) => updateFlow(flow.id, { name: event.target.value })}
      />

      {advanced && (
        <TextField
          label="Key"
          hint="How the Flow language refers to this journey."
          value={flow.key}
          onChange={(event) => updateFlow(flow.id, { key: event.target.value })}
        />
      )}

      <StoryEditor
        ownerId={flow.id}
        story={flow.story}
        subject="this journey"
      />

      <TextAreaField
        label="Notes"
        placeholder="Anything the story does not cover"
        rows={2}
        value={flow.note}
        onChange={(event) => updateFlow(flow.id, { note: event.target.value })}
      />

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Screens in this journey</SectionLabel>
          <span className="text-[10px] text-muted-foreground">
            {members.length || "none"}
          </span>
        </div>
        {members.length === 0 && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Nothing tagged yet. Tag a screen from its own inspector, or click one
            below to add it.
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {project.screens.map((screen) => {
            const on = screen.flows.includes(flow.id)
            return (
              <button
                key={screen.id}
                type="button"
                onClick={() => toggleScreenFlow(screen.id, flow.id)}
                aria-pressed={on}
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                  on
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                {screen.title}
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          className="w-full text-destructive"
          onClick={() => {
            deleteFlow(flow.id)
            if (activeFlowId === flow.id) setActiveFlow(null)
            select(null)
          }}
        >
          <Trash2 /> Delete journey
        </Button>
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          The screens stay — they simply become ungrouped.
        </p>
      </div>
    </div>
  )
}
