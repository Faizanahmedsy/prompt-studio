"use client"

import { ArrowRight, Plus, X } from "lucide-react"
import { useState } from "react"

import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  connectScreens,
  deleteEdge,
  updateEdge,
} from "@/features/builder/utils/actions"
import type { Project } from "@/types/project"

/**
 * The list view of a screen's outgoing connections — the same edges the canvas
 * draws, editable without a pointer. This is what makes the builder usable on a
 * phone.
 */
export function ScreenConnections({
  project,
  screenId,
}: {
  project: Project
  screenId: string
}) {
  const [target, setTarget] = useState("")
  const outgoing = project.edges.filter((edge) => edge.from === screenId)
  const byId = new Map(project.screens.map((s) => [s.id, s]))
  const candidates = project.screens.filter(
    (s) => s.id !== screenId && !outgoing.some((e) => e.to === s.id)
  )

  return (
    <div className="space-y-2">
      <SectionLabel>Goes to</SectionLabel>

      {outgoing.length === 0 && (
        <p className="text-[11px] text-muted-foreground">
          Nothing yet — connect this screen to the one that follows it.
        </p>
      )}

      <ul className="space-y-2">
        {outgoing.map((edge) => (
          <li
            key={edge.id}
            className="rounded-lg border border-border bg-surface p-2"
          >
            <div className="flex items-center gap-1.5">
              <ArrowRight className="size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium">
                {byId.get(edge.to)?.title ?? "Deleted screen"}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                onClick={() => deleteEdge(edge.id)}
                aria-label="Remove connection"
              >
                <X />
              </Button>
            </div>
            <Input
              value={edge.trigger}
              onChange={(event) => updateEdge(edge.id, event.target.value)}
              placeholder="What triggers it? e.g. on submit"
              className="mt-1.5 h-7 text-[11px]"
            />
          </li>
        ))}
      </ul>

      {candidates.length > 0 && (
        <div className="flex gap-1.5">
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Connect to…" />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((screen) => (
                <SelectItem key={screen.id} value={screen.id}>
                  {screen.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={!target}
            onClick={() => {
              if (!target) return
              connectScreens(screenId, target)
              setTarget("")
            }}
            aria-label="Add connection"
          >
            <Plus />
          </Button>
        </div>
      )}
    </div>
  )
}
