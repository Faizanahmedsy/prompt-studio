"use client"

import { ColorField, SelectField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Slider } from "@/components/ui/misc"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { describeLayout } from "@/features/library/data/layouts"
import { DesignLanguageCard } from "@/features/theme/components/design-language-card"
import { designLanguages } from "@/features/theme/data/design-languages"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import {
  borderRadiusValues,
  buttonStyleValues,
  type Project,
} from "@/types/project"

const creativityWords = [
  "Literal",
  "Literal",
  "Literal",
  "Close to spec",
  "Close to spec",
  "Balanced",
  "Balanced",
  "Expressive",
  "Expressive",
  "Bold",
  "Bold",
]

export function ThemeEditor({ project }: { project: Project }) {
  const update = useProjectStore((s) => s.update)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const theme = project.theme

  const set = (patch: Partial<Project["theme"]>) =>
    update((doc) => {
      Object.assign(doc.theme, patch)
    })

  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <div>
          <SectionLabel>Design language</SectionLabel>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            The overall character of the UI. Each preview is a real mock built
            with that language's radii, borders, shadows and type.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {designLanguages.map((language) => (
            <DesignLanguageCard
              key={language.id}
              language={language}
              accent={theme.primaryColor}
              selected={theme.designLanguage === language.id}
              onSelect={() => set({ designLanguage: language.id })}
            />
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-border bg-surface p-2">
        <LayoutThumb
          wire={describeLayout("dashboard-sidebar").wire}
          size="md"
          accent={theme.primaryColor}
        />
        <p className="mt-2 text-[11px] text-muted-foreground">
          Layout preview — every thumbnail uses these colours.
        </p>
      </div>

      <ColorField
        label="Primary colour"
        value={theme.primaryColor}
        onChange={(primaryColor) => set({ primaryColor })}
      />
      <ColorField
        label="Secondary colour"
        value={theme.secondaryColor}
        onChange={(secondaryColor) => set({ secondaryColor })}
      />

      <SelectField
        label="Corner radius"
        value={theme.borderRadius}
        onValueChange={(value) =>
          set({ borderRadius: value as Project["theme"]["borderRadius"] })
        }
        options={borderRadiusValues.map((value) => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
        }))}
      />

      {advanced && (
        <>
      <SelectField
        label="Button style"
        value={theme.buttonStyle}
        onValueChange={(value) =>
          set({ buttonStyle: value as Project["theme"]["buttonStyle"] })
        }
        options={buttonStyleValues.map((value) => ({
          value,
          label: value.charAt(0).toUpperCase() + value.slice(1),
        }))}
      />

      <SelectField
        label="Density"
        value={theme.density}
        onValueChange={(value) =>
          set({ density: value as Project["theme"]["density"] })
        }
        options={[
          { value: "compact", label: "Compact" },
          { value: "comfortable", label: "Comfortable" },
          { value: "spacious", label: "Spacious" },
        ]}
      />
        </>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Creative latitude</SectionLabel>
          <span className="text-[11px] font-medium text-primary">
            {creativityWords[project.creativity]} · {project.creativity}/10
          </span>
        </div>
        <Slider
          value={[project.creativity]}
          min={0}
          max={10}
          step={1}
          onValueChange={([creativity]) =>
            update((doc) => {
              doc.creativity = creativity
            })
          }
          aria-label="Creative latitude"
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Low keeps the agent literal about these layouts. High invites motion,
          depth and its own visual ideas on top of them.
        </p>
      </div>
    </div>
  )
}
