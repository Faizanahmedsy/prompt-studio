"use client"

import { Figma } from "lucide-react"
import { toast } from "sonner"

import { ColorField, SelectField } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { LayoutThumb } from "@/features/library/components/layout-thumb"
import { describeLayout } from "@/features/library/data/layouts"
import { DesignLanguageCard } from "@/features/theme/components/design-language-card"
import { designLanguages } from "@/features/theme/data/design-languages"
import {
  colorSchemes,
  elevations,
  fontCharacters,
  iconStyles,
  motions,
  type ThemeOption,
  typeScales,
} from "@/features/theme/data/typography"
import {
  describeUiLevel,
  uiLevelOf,
  uiLevels,
} from "@/features/theme/data/ui-levels"
import { buildFigmaImportPrompt } from "@/features/theme/figma-prompt"
import { copyText } from "@/lib/download"
import { cn } from "@/lib/utils"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"
import {
  borderRadiusValues,
  buttonStyleValues,
  type Project,
} from "@/types/project"

/** A select built from one of the typography catalogues, hint and all. */
function OptionField({
  label,
  options,
  value,
  onChange,
  extra = [],
}: {
  label: string
  options: ThemeOption[]
  value: string
  onChange: (value: string) => void
  extra?: { value: string; label: string; hint: string }[]
}) {
  const all = [
    ...extra,
    ...options.map((o) => ({ value: o.id, label: o.label, hint: o.hint })),
  ]
  const current = all.find((o) => o.value === value)
  return (
    <div className="space-y-1">
      <SelectField
        label={label}
        value={value}
        onValueChange={onChange}
        options={all.map(({ value: v, label: l }) => ({ value: v, label: l }))}
      />
      {current?.hint && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {current.hint}
        </p>
      )}
    </div>
  )
}

export function ThemeEditor({ project }: { project: Project }) {
  const update = useProjectStore((s) => s.update)
  const advanced = useUiStore((s) => s.experience === "advanced")
  const theme = project.theme

  const set = (patch: Partial<Project["theme"]>) =>
    update((doc) => {
      Object.assign(doc.theme, patch)
    })

  // "Basic" tells the agent to apply no colour at all. Leaving the pickers live
  // beneath it would offer a choice that the generated prompt then ignores.
  const isBasic = theme.designLanguage === "basic"

  const copyFigmaPrompt = () => {
    copyText(buildFigmaImportPrompt(project))
    toast.success("Figma import prompt copied", {
      description:
        "Paste it into Claude Code with your Figma screenshots. It writes the stylesheet straight into your project.",
    })
  }

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
              accent={language.id === "basic" ? "#71717a" : theme.primaryColor}
              selected={theme.designLanguage === language.id}
              onSelect={() => set({ designLanguage: language.id })}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={copyFigmaPrompt}
          className="h-8 w-full gap-2 text-xs font-semibold"
        >
          <Figma className="size-3.5" />
          Import from Figma
        </Button>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Copies a prompt for Claude Code. Give it your Figma screenshots and it
          writes the stylesheet for this project — the same token names the build
          prompt already uses.
        </p>
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

      {isBasic ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
          <strong className="font-semibold text-foreground">Basic</strong> asks
          the agent for unstyled, semantic markup — so the colour, elevation and
          motion settings are left out of the prompt entirely. Pick another
          language, or bring a design in from Figma above.
        </p>
      ) : (
        <>
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

          <OptionField
            label="Heading font"
            options={fontCharacters}
            value={theme.headingFont}
            onChange={(value) =>
              set({ headingFont: value as Project["theme"]["headingFont"] })
            }
          />
          <OptionField
            label="Body font"
            options={fontCharacters}
            value={theme.bodyFont}
            onChange={(value) =>
              set({ bodyFont: value as Project["theme"]["bodyFont"] })
            }
            extra={[
              {
                value: "pair",
                label: "Pair with the heading",
                hint: "The agent picks a face that sits with the heading — usually right.",
              },
            ]}
          />
          <OptionField
            label="Type scale"
            options={typeScales}
            value={theme.typeScale}
            onChange={(value) =>
              set({ typeScale: value as Project["theme"]["typeScale"] })
            }
          />
          <OptionField
            label="Themes"
            options={colorSchemes}
            value={theme.colorScheme}
            onChange={(value) =>
              set({ colorScheme: value as Project["theme"]["colorScheme"] })
            }
          />
        </>
      )}

      {!isBasic && (
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
      )}

      {advanced && !isBasic && (
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

      <OptionField
        label="Icons"
        options={iconStyles}
        value={theme.iconStyle}
        onChange={(value) =>
          set({ iconStyle: value as Project["theme"]["iconStyle"] })
        }
      />
      <OptionField
        label="Elevation"
        options={elevations}
        value={theme.elevation}
        onChange={(value) =>
          set({ elevation: value as Project["theme"]["elevation"] })
        }
      />
      <OptionField
        label="Motion"
        options={motions}
        value={theme.motion}
        onChange={(value) =>
          set({ motion: value as Project["theme"]["motion"] })
        }
      />
        </>
      )}

      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Creative level</SectionLabel>
          <span className="text-[11px] font-medium text-primary">
            {describeUiLevel(uiLevelOf(project)).name} · {uiLevelOf(project)}/5
          </span>
        </div>
        {/* Five named buttons rather than a slider: each level is a different
            instruction, not a point on a continuum, and the name is what tells
            you what you are choosing. */}
        <div className="flex gap-1">
          {uiLevels.map((entry) => {
            const active = uiLevelOf(project) === entry.level
            return (
              <button
                type="button"
                key={entry.level}
                aria-pressed={active}
                aria-label={`Creative level ${entry.level} — ${entry.name}`}
                title={`${entry.name} — ${entry.hint}`}
                onClick={() =>
                  update((doc) => {
                    doc.uiLevel = entry.level
                  })
                }
                className={cn(
                  "flex-1 rounded-md border py-1.5 text-[11px] font-medium transition-colors",
                  active
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                )}
              >
                {entry.level}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground">
          {describeUiLevel(uiLevelOf(project)).hint} The agent still reads the
          journeys first and spends the effort where the people using it need
          it — this sets the ceiling, not a quota.
        </p>
      </div>
    </div>
  )
}
