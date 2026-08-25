"use client"

import { Plus, X } from "lucide-react"

import { TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  addCriterion,
  hasStory,
  removeCriterion,
  setCriterion,
  updateStory,
} from "@/features/builder/utils/actions"
import type { UserStory } from "@/types/project"

/**
 * The editing surface for a user story — on a screen or on a flow.
 *
 * It is not the *authoring* surface. Stories normally arrive with the pasted
 * `.flow` file, written by the model that generated the diagram; this is where
 * one gets corrected. That is why it opens filled in and empty fields are
 * unremarkable rather than a prompt to start typing.
 *
 * Three fields rather than one box: the grammar the model writes has three
 * keys, and parsing "As a … I want … so that …" back out of free text works
 * right up until a model phrases it differently, at which point it fails
 * silently and the prompt renders nonsense.
 */
export function StoryEditor({
  ownerId,
  story,
  subject,
}: {
  /** the screen id or flow id the story hangs off */
  ownerId: string
  story: UserStory
  /** "this screen" / "this journey" — used in the placeholders */
  subject: string
}) {
  const written = hasStory(story)

  return (
    <div className="space-y-2 rounded-lg border border-border bg-surface p-2.5">
      <div className="flex items-baseline justify-between">
        <SectionLabel>User story</SectionLabel>
        {!written && (
          <span className="text-[10px] text-muted-foreground">
            none yet
          </span>
        )}
      </div>

      <TextField
        label="As a…"
        placeholder="an operations admin"
        value={story.role}
        onChange={(event) => updateStory(ownerId, { role: event.target.value })}
      />
      <TextField
        label="I want to…"
        placeholder={`see every client in one filterable table`}
        value={story.want}
        onChange={(event) => updateStory(ownerId, { want: event.target.value })}
      />
      <TextField
        label="so that…"
        placeholder="I can reach the right record without hunting"
        value={story.soThat}
        onChange={(event) =>
          updateStory(ownerId, { soThat: event.target.value })
        }
      />

      <div className="space-y-1.5 pt-1">
        <SectionLabel>Accepted when</SectionLabel>
        {story.criteria.length === 0 && (
          <p className="text-[11px] leading-snug text-muted-foreground">
            Nothing to check yet. A criterion is a rule about what {subject}{" "}
            does — not a description of what is on it.
          </p>
        )}
        {story.criteria.map((criterion, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: criteria have no ids, and the row is identified only by its position — reordering is by editing, not dragging
            key={index}
            className="flex items-center gap-1"
          >
            <Input
              value={criterion}
              placeholder="clearing a filter returns to page 1"
              onChange={(event) =>
                setCriterion(ownerId, index, event.target.value)
              }
              className="h-8 text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove criterion ${index + 1}`}
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeCriterion(ownerId, index)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-full gap-1.5 text-[11px]"
          onClick={() => addCriterion(ownerId)}
        >
          <Plus className="size-3" />
          Add a criterion
        </Button>
      </div>
    </div>
  )
}
