"use client"

import { ClipboardCopy, Copy, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Glyph } from "@/components/icons/glyph"
import { SelectField, TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import {
  addFlow,
  addModule,
  deleteScreen,
  duplicateScreen,
  setScreenSurface,
  toggleScreenFlow,
  toggleScreenView,
  updateScreen,
} from "@/features/builder/utils/actions"
import { surfaceMeta } from "@/features/builder/utils/surfaces"
import { AddMenu } from "@/features/library/components/add-menu"
import { LayoutPicker } from "@/features/library/components/layout-picker"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import {
  defaultLayoutFor,
  describeLayout,
  layoutsForSurface,
} from "@/features/library/data/layouts"
import {
  describeModuleKind,
  moduleKinds,
} from "@/features/library/data/module-kinds"
import { screenTemplates } from "@/features/library/data/templates"
import { buildScreenPrompt } from "@/features/prompt/engine/screen-prompt"
import { copyText } from "@/lib/download"
import { cn } from "@/lib/utils"
import { useUiStore } from "@/stores/use-ui-store"
import { type Project, type Screen, surfaceValues } from "@/types/project"

import { ScreenConnections } from "./screen-connections"
import { StoryEditor } from "./story-editor"

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
            layout:
              screen.layout ||
              defaultLayoutFor(meta?.defaultLayout ?? "", screen.surface),
          })
        }}
        options={screenTemplates.map((t) => ({ value: t.id, label: t.name }))}
      />

      {/* A service area has nothing to lay out, so the picker would be
          offering a choice that never reaches the prompt. */}
      {screen.surface !== "backend" && (
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
                shape={screen.surface === "mobile" ? "phone" : "wide"}
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
      )}

      <StoryEditor
        ownerId={screen.id}
        story={screen.story}
        subject="this screen"
        note={screen.note}
        onNoteChange={(note) => updateScreen(screen.id, { note })}
      />

      <ScreenFlows project={project} screen={screen} />

      <div className="space-y-1.5">
        <SectionLabel>Build</SectionLabel>
        <div className="flex flex-wrap gap-1">
          {surfaceValues.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setScreenSurface(screen.id, value)}
              title={surfaceMeta[value].hint}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                screen.surface === value
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {surfaceMeta[value].label}
            </button>
          ))}
        </div>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Moving a screen to another build drops its connections to screens that
          stayed behind — those are integrations, not navigation.
        </p>
      </div>

      <ScreenViews project={project} screen={screen} />

      <ScreenModules project={project} screenId={screen.id} />

      <ScreenConnections project={project} screenId={screen.id} />

      <div className="border-t border-border pt-3">
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={async () => {
            // Deliberately the whole module, not this tab's half of it: the
            // brief is only useful if the agent reading it can see the API and
            // the other devices this screen has to agree with.
            const built = buildScreenPrompt(project, screen.id)
            if (!built.text) {
              toast.error(built.warnings[0] ?? "Nothing to copy yet.")
              return
            }
            await copyText(built.text)
            const builds = built.surfaces.map((s) => surfaceMeta[s].label).join(", ")
            toast.success(`Copied the ${screen.title} prompt`, {
              description: built.warnings[0] ?? `Covers ${builds}, the data model and the user stories.`,
            })
          }}
        >
          <ClipboardCopy /> Copy prompt for this screen
        </Button>
        <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
          Everything this screen touches — its journey on the other builds, the
          tables underneath, and the stories all of them serve.
        </p>
      </div>

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
        layouts={layoutsForSurface(screen.template, screen.surface)}
        selected={screen.layout}
        accent={project.theme.primaryColor}
        title={`Layout for “${screen.title}”`}
        onSelect={(layoutId) => updateScreen(screen.id, { layout: layoutId })}
      />
    </div>
  )
}

/**
 * Which journeys this screen is part of — the second axis, independent of roles.
 *
 * A screen has one role set and belongs to several flows at once: Sign In
 * starts authentication and is also the first step of onboarding. Untagged is
 * shown as "Ungrouped" rather than treated as "all", which is the opposite of
 * how `views` behaves, and deliberately: a screen in no journey is a screen
 * nobody has said the purpose of, and that is worth seeing.
 */
function ScreenFlows({
  project,
  screen,
}: {
  project: Project
  screen: Screen
}) {
  return (
    <div className="space-y-1.5">
      <SectionLabel>Journeys</SectionLabel>
      <div className="flex flex-wrap gap-1">
        {project.flows.map((flow) => {
          const on = screen.flows.includes(flow.id)
          return (
            <button
              key={flow.id}
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
              {flow.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => {
            const id = addFlow("New journey")
            if (id) toggleScreenFlow(screen.id, id)
          }}
          className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          + New journey
        </button>
      </div>
      {!screen.flows.length && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          Not in any journey yet. Journeys normally arrive with a pasted Flow
          file — this is where you correct one.
        </p>
      )}
    </div>
  )
}

/**
 * Which roles reach this screen. Untagged means every role, which is both the
 * common case and what keeps a single-audience project free of this decision —
 * so the control only appears once a project has defined a view.
 */
function ScreenViews({
  project,
  screen,
}: {
  project: Project
  screen: Screen
}) {
  if (!project.views.length) return null
  const shared = screen.views.length === 0

  return (
    <div className="space-y-1.5">
      <SectionLabel>Seen by</SectionLabel>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => updateScreen(screen.id, { views: [] })}
          className={cn(
            "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
            shared
              ? "border-primary bg-primary-soft text-primary"
              : "border-border text-muted-foreground hover:border-primary/50"
          )}
        >
          Every role
        </button>
        {project.views.map((view) => {
          const on = screen.views.includes(view.id)
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => toggleScreenView(screen.id, view.id)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                on
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              )}
            >
              {view.name}
            </button>
          )
        })}
      </div>
      <p className="text-[10px] leading-snug text-muted-foreground">
        {shared
          ? "Shared — appears in every view."
          : "Only the selected roles reach this screen."}
      </p>
    </div>
  )
}

/**
 * The screen's modules, listed here as well as on the canvas — the canvas shows
 * them only while the screen is expanded, and adding the first one should not
 * require finding that toggle first.
 */
function ScreenModules({
  project,
  screenId,
}: {
  project: Project
  screenId: string
}) {
  const select = useUiStore((s) => s.select)
  const expanded = useUiStore((s) => s.expandedScreenIds.includes(screenId))
  const toggle = useUiStore((s) => s.toggleScreenExpanded)

  const modules = project.modules
    .filter((m) => m.screenId === screenId)
    .sort((a, b) => a.order - b.order)

  const open = (id: string) => {
    if (!expanded) toggle(screenId)
    select(id)
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Inside this screen</SectionLabel>
        {modules.length > 0 && (
          <button
            type="button"
            onClick={() => toggle(screenId)}
            className="text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {expanded ? "Hide on canvas" : "Show on canvas"}
          </button>
        )}
      </div>

      {modules.length === 0 ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          Optional. Add modules when a screen carries real behaviour — a table,
          its filters, the dialogs it opens.
        </p>
      ) : (
        <ul className="space-y-1">
          {modules.map((module) => {
            const kind = describeModuleKind(module.kind)
            return (
              <li key={module.id}>
                <button
                  type="button"
                  onClick={() => open(module.id)}
                  className="flex w-full items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left transition-colors hover:border-primary/50"
                >
                  <Glyph
                    name={kind.icon}
                    className="size-3.5 shrink-0 text-muted-foreground"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[11px] font-medium leading-tight">
                      {module.name}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-muted-foreground">
                      {module.trigger.trim() || kind.name}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <AddMenu
        label="Add module"
        items={moduleKinds.map((kind) => ({
          id: kind.id,
          name: kind.name,
          icon: kind.icon,
          description: kind.description,
        }))}
        onPick={(kind) => {
          const id = addModule(screenId, kind)
          if (id) open(id)
        }}
      />
    </div>
  )
}
