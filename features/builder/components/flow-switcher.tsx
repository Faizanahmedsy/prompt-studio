"use client"

import { Check, GitBranch, Layers, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { addFlow } from "@/features/builder/utils/actions"
import { flowCounts, UNGROUPED } from "@/features/builder/utils/flows"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, Screen } from "@/types/project"

/**
 * The second way to look at the same diagram: whole app, or one journey.
 *
 * A separate control from the role-view switcher on purpose. Roles answer *who
 * can reach this screen*; journeys answer *what is this screen part of*. A
 * screen has one role set and several journeys at once, so folding them into
 * one list would make both unusable — and picking "Admin" would silently mean
 * something different from picking "Checkout".
 */
export function FlowSwitcher({
  project,
  screens,
}: {
  project: Project
  /** the screens on this surface, so counts match what is on the canvas */
  screens: Screen[]
}) {
  const activeFlowId = useUiStore((s) => s.activeFlowId)
  const setActiveFlow = useUiStore((s) => s.setActiveFlow)
  const flowFaded = useUiStore((s) => s.flowFaded)
  const setFlowFaded = useUiStore((s) => s.setFlowFaded)
  const select = useUiStore((s) => s.select)

  const { counts, ungrouped } = flowCounts(screens)
  const active = project.flows.find((f) => f.id === activeFlowId) ?? null
  const showingUngrouped = activeFlowId === UNGROUPED

  /** Picking a journey also selects it, so its story opens in the inspector. */
  const pick = (id: string | null) => {
    setActiveFlow(id)
    if (id && id !== UNGROUPED) select(id)
  }

  if (!project.flows.length) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const id = addFlow("Authentication")
          if (id) pick(id)
        }}
        title="Group these screens into journeys — authentication, onboarding, checkout"
      >
        <GitBranch /> Group into journeys
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant={activeFlowId ? "default" : "outline"}
          title="Show the whole app, or one journey at a time"
        >
          {activeFlowId ? <GitBranch /> : <Layers />}
          <span className="max-w-32 truncate">
            {active ? active.name : showingUngrouped ? "Ungrouped" : "Whole app"}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[11px] font-normal text-muted-foreground">
          The same screens, grouped by what someone is trying to get done. A
          screen can be in several journeys at once.
        </DropdownMenuLabel>

        <FlowRow
          label="Whole app"
          detail={`${screens.length} screen${screens.length === 1 ? "" : "s"}, every connection`}
          active={!activeFlowId}
          onSelect={() => pick(null)}
        />

        <DropdownMenuSeparator />

        {[...project.flows]
          .sort((a, b) => a.order - b.order)
          .map((flow) => {
            const count = counts.get(flow.id) ?? 0
            return (
              <FlowRow
                key={flow.id}
                label={flow.name}
                detail={
                  count
                    ? `${count} screen${count === 1 ? "" : "s"}`
                    : "no screens tagged yet"
                }
                active={activeFlowId === flow.id}
                onSelect={() => pick(flow.id)}
              />
            )
          })}

        {ungrouped > 0 && (
          <FlowRow
            label="Ungrouped"
            detail={`${ungrouped} screen${ungrouped === 1 ? "" : "s"} in no journey`}
            active={showingUngrouped}
            onSelect={() => pick(UNGROUPED)}
          />
        )}

        <DropdownMenuSeparator />

        <DropdownMenuCheckboxItem
          checked={flowFaded}
          onCheckedChange={setFlowFaded}
          disabled={!activeFlowId}
          className="text-xs"
        >
          Show the rest, faded
        </DropdownMenuCheckboxItem>

        <DropdownMenuItem
          onSelect={() => {
            const id = addFlow(`Journey ${project.flows.length + 1}`)
            if (id) pick(id)
          }}
          className="gap-2 text-xs"
        >
          <Plus className="size-3.5" /> Add a journey
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function FlowRow({
  label,
  detail,
  active,
  onSelect,
}: {
  label: string
  detail: string
  active: boolean
  onSelect: () => void
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="items-start gap-2 py-1.5">
      <Check
        className={cn("mt-0.5 size-3.5 shrink-0", !active && "opacity-0")}
      />
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium">{label}</span>
        <span className="block truncate text-[10px] text-muted-foreground">
          {detail}
        </span>
      </span>
    </DropdownMenuItem>
  )
}
