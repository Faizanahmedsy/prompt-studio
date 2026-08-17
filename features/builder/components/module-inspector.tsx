"use client"

import { ArrowUpRight, Copy, Trash2 } from "lucide-react"

import { Glyph } from "@/components/icons/glyph"
import { SelectField, TextAreaField, TextField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import {
  deleteModule,
  duplicateModule,
  updateModule,
} from "@/features/builder/utils/actions"
import { describeModuleKind, moduleKinds } from "@/features/library/data/module-kinds"
import { useUiStore } from "@/stores/use-ui-store"
import type { Project, ScreenModule } from "@/types/project"

/**
 * Editing one piece of a screen. Deliberately the same shape as the screen
 * inspector — a developer who has edited a screen already knows this form.
 */
export function ModuleInspector({
  project,
  module,
}: {
  project: Project
  module: ScreenModule
}) {
  const select = useUiStore((s) => s.select)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const screen = project.screens.find((s) => s.id === module.screenId)
  const kind = describeModuleKind(module.kind)

  const inner = project.moduleEdges.filter(
    (e) => e.from === module.id || e.to === module.id
  )
  const nameOf = (id: string) =>
    project.modules.find((m) => m.id === id)?.name ?? "—"

  return (
    <div className="space-y-4">
      {screen && (
        <button
          type="button"
          onClick={() => select(screen.id)}
          className="flex w-full items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
        >
          <Glyph name={kind.icon} className="size-3.5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            Inside <strong className="font-medium">{screen.title}</strong>
          </span>
          <ArrowUpRight className="size-3 shrink-0" />
        </button>
      )}

      <TextField
        label="Name"
        value={module.name}
        onChange={(event) => updateModule(module.id, { name: event.target.value })}
      />

      {advanced && (
        <TextField
          label="Key"
          hint="Used in Flow source. Unique within this screen only."
          value={module.key}
          onChange={(event) => updateModule(module.id, { key: event.target.value })}
          className="[&_input]:font-mono [&_input]:text-xs"
        />
      )}

      <SelectField
        label="Kind"
        value={module.kind}
        onValueChange={(value) => updateModule(module.id, { kind: value })}
        options={moduleKinds.map((k) => ({ value: k.id, label: k.name }))}
      />
      <p className="-mt-2 text-[11px] leading-snug text-muted-foreground">
        {kind.promptDetails.charAt(0).toUpperCase()}
        {kind.promptDetails.slice(1)}.
      </p>

      <TextField
        label="Trigger"
        hint="What opens or fires it. Appears in the prompt verbatim."
        placeholder="click Add Client"
        value={module.trigger}
        onChange={(event) =>
          updateModule(module.id, { trigger: event.target.value })
        }
      />

      <TextAreaField
        label="Notes for this module"
        placeholder="Fields, columns, rules, permissions, the API it calls…"
        rows={3}
        value={module.note}
        onChange={(event) => updateModule(module.id, { note: event.target.value })}
      />

      {inner.length > 0 && (
        <div className="space-y-1.5">
          <SectionLabel>Inside this screen</SectionLabel>
          <ul className="space-y-1">
            {inner.map((edge) => (
              <li
                key={edge.id}
                className="rounded-md border border-border bg-surface px-2 py-1.5 text-[11px]"
              >
                <span className="block truncate">
                  {edge.from === module.id ? "→ " : "← "}
                  <strong className="font-medium">
                    {nameOf(edge.from === module.id ? edge.to : edge.from)}
                  </strong>
                </span>
                {edge.trigger.trim() && (
                  <span className="block truncate text-muted-foreground">
                    {edge.trigger.trim()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-1.5 border-t border-border pt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={() => duplicateModule(module.id)}
        >
          <Copy /> Duplicate
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-destructive"
          onClick={() => {
            deleteModule(module.id)
            select(module.screenId)
          }}
        >
          <Trash2 /> Delete
        </Button>
      </div>
    </div>
  )
}
