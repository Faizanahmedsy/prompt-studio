"use client"

import { SelectField, TextAreaField, ToggleRow } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { surfaceMeta } from "@/features/builder/utils/surfaces"
import { snippets } from "@/features/library/data/snippets"
import { promptTargets } from "@/features/prompt/engine/targets"
import { useProjectStore } from "@/stores/use-project-store"
import type { Project } from "@/types/project"

export function RequirementsPanel({ project }: { project: Project }) {
  const update = useProjectStore((s) => s.update)

  const grouped = snippets.reduce<Record<string, typeof snippets>>((acc, item) => {
    acc[item.category] = [...(acc[item.category] ?? []), item]
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <SelectField
        label="Prompt target"
        hint="Changes wording, block order and formatting."
        value={project.target}
        onValueChange={(target) =>
          update((doc) => {
            doc.target = target
          })
        }
        options={promptTargets.map((t) => ({ value: t.id, label: t.name }))}
      />

      <section className="space-y-2">
        <SectionLabel>Builds</SectionLabel>
        <p className="text-[11px] leading-snug text-muted-foreground">
          What this project ships. Choose more than one and the prompt describes a
          single repository containing all of them, how they wire together, and the
          tests that prove they do.
        </p>
        {(["web", "mobile", "backend"] as const).map((build) => (
          <ToggleRow
            key={build}
            variant="checkbox"
            title={surfaceMeta[build].label}
            description={surfaceMeta[build].hint}
            checked={project.builds[build]}
            onCheckedChange={(on) =>
              update((doc) => {
                doc.builds[build] = on
              })
            }
          />
        ))}
      </section>

      <ToggleRow
        variant="switch"
        title="Start from the boilerplate"
        description="The agent clones a pinned starter repo — folder structure, design tokens, http instance, CLAUDE.md — instead of scaffolding one. The stack, structure and convention sections shrink to what this product adds on top."
        checked={project.startFrom === "boilerplate"}
        onCheckedChange={(on) =>
          update((doc) => {
            doc.startFrom = on ? "boilerplate" : "scratch"
          })
        }
      />

      <TextAreaField
        label="Additional requirements"
        hint="Business rules, integrations, edge cases — anything the diagram cannot express."
        rows={8}
        value={project.requirements}
        onChange={(event) =>
          update((doc) => {
            doc.requirements = event.target.value
          })
        }
      />

      <section className="space-y-2 border-t border-border pt-4">
        <SectionLabel>Requirement packs</SectionLabel>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Reusable blocks appended to the technical requirements. Toggle the ones
          this build must honour.
        </p>
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category} className="space-y-0.5">
            <p className="pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {category}
            </p>
            {items.map((snippet) => (
              <ToggleRow
                key={snippet.id}
                variant="checkbox"
                title={snippet.name}
                description={snippet.description}
                checked={project.snippetIds.includes(snippet.id)}
                onCheckedChange={(checked) =>
                  update((doc) => {
                    doc.snippetIds = checked
                      ? [...doc.snippetIds, snippet.id]
                      : doc.snippetIds.filter((id) => id !== snippet.id)
                  })
                }
              />
            ))}
          </div>
        ))}
      </section>
    </div>
  )
}
