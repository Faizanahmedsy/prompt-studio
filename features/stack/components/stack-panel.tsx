"use client"

import { BookmarkPlus, Layers, Trash2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { WarningList } from "@/components/shared/feedback"
import {
  SelectField,
  TextAreaField,
  TextField,
  ToggleRow,
} from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { Button } from "@/components/ui/button"
import { conventions } from "@/features/stack/data/conventions"
import { builtInProfiles } from "@/features/stack/data/profiles"
import {
  stackGroups,
  stackWarnings,
} from "@/features/stack/data/stack-catalogue"
import { structureMap, structurePresets } from "@/features/stack/data/structures"
import { useProjectStore } from "@/stores/use-project-store"
import type { Project } from "@/types/project"

export function StackPanel({ project }: { project: Project }) {
  const update = useProjectStore((s) => s.update)
  const profiles = useProjectStore((s) => s.profiles)
  const saveProfile = useProjectStore((s) => s.saveProfile)
  const deleteProfile = useProjectStore((s) => s.deleteProfile)
  const applyProfile = useProjectStore((s) => s.applyProfile)
  const [profileName, setProfileName] = useState("")

  const warnings = stackWarnings(project.stack)
  const preset = structureMap[project.structure.preset]
  const grouped = conventions.reduce<Record<string, typeof conventions>>(
    (acc, item) => {
      acc[item.group] = [...(acc[item.group] ?? []), item]
      return acc
    },
    {}
  )

  return (
    <div className="space-y-5">
      {/* Profiles ---------------------------------------------------------- */}
      <section className="space-y-2 rounded-lg border border-border bg-surface p-2.5">
        <SectionLabel>Stack profile</SectionLabel>
        <p className="text-[11px] leading-snug text-muted-foreground">
          A profile bundles the stack, folder structure and conventions so the
          whole team generates consistent prompts.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {[...builtInProfiles, ...profiles].map((profile) => (
            <span key={profile.id} className="flex items-center">
              <Button
                size="xs"
                variant="outline"
                onClick={() => {
                  applyProfile(profile.id)
                  toast.success(`Applied “${profile.name}”`)
                }}
              >
                <Layers /> {profile.name}
              </Button>
              {profiles.some((p) => p.id === profile.id) && (
                <Button
                  size="icon-xs"
                  variant="ghost"
                  onClick={() => deleteProfile(profile.id)}
                  aria-label={`Delete ${profile.name}`}
                >
                  <Trash2 />
                </Button>
              )}
            </span>
          ))}
        </div>
        <div className="flex gap-1.5">
          <TextField
            placeholder="Save current as…"
            value={profileName}
            onChange={(event) => setProfileName(event.target.value)}
            className="flex-1 [&_input]:h-8 [&_input]:text-xs"
          />
          <Button
            size="icon-sm"
            variant="outline"
            disabled={!profileName.trim()}
            onClick={() => {
              saveProfile(profileName.trim())
              setProfileName("")
              toast.success("Profile saved")
            }}
            aria-label="Save profile"
          >
            <BookmarkPlus />
          </Button>
        </div>
      </section>

      {/* Stack ------------------------------------------------------------- */}
      <section className="space-y-3">
        <SectionLabel>Technology</SectionLabel>
        <WarningList warnings={warnings} />
        {stackGroups.map((group) => (
          <SelectField
            key={group.key}
            label={group.label}
            hint={group.hint}
            value={project.stack[group.key]}
            onValueChange={(value) =>
              update((doc) => {
                doc.stack[group.key] = value
              })
            }
            options={group.options.map((option) => ({
              value: option.id,
              label: option.label,
            }))}
          />
        ))}
        <TextAreaField
          label="Extras"
          hint="One per line — libraries or constraints the list above doesn't cover."
          rows={2}
          value={project.stack.extras.join("\n")}
          onChange={(event) =>
            update((doc) => {
              doc.stack.extras = event.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
            })
          }
        />
      </section>

      {/* Structure --------------------------------------------------------- */}
      <section className="space-y-2 border-t border-border pt-4">
        <SectionLabel>Folder structure</SectionLabel>
        <SelectField
          value={project.structure.preset}
          onValueChange={(value) =>
            update((doc) => {
              doc.structure.preset = value
            })
          }
          options={structurePresets.map((s) => ({ value: s.id, label: s.name }))}
        />
        {project.structure.preset === "custom" ? (
          <TextAreaField
            label="Your tree"
            hint="Pasted into the prompt verbatim."
            rows={8}
            className="[&_textarea]:code-surface"
            value={project.structure.customTree}
            onChange={(event) =>
              update((doc) => {
                doc.structure.customTree = event.target.value
              })
            }
          />
        ) : (
          preset && (
            <pre className="code-surface max-h-56 overflow-auto rounded-lg bg-surface p-2 text-[11px]">
              {preset.tree}
            </pre>
          )
        )}
      </section>

      {/* Conventions ------------------------------------------------------- */}
      <section className="space-y-2 border-t border-border pt-4">
        <SectionLabel>Conventions</SectionLabel>
        {Object.entries(grouped).map(([group, items]) => (
          <div key={group} className="space-y-0.5">
            <p className="pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
              {group}
            </p>
            {(items ?? []).map((convention) => (
              <ToggleRow
                key={convention.id}
                variant="checkbox"
                title={convention.label}
                description={convention.line}
                checked={project.conventions.ids.includes(convention.id)}
                onCheckedChange={(checked) =>
                  update((doc) => {
                    doc.conventions.ids = checked
                      ? [...doc.conventions.ids, convention.id]
                      : doc.conventions.ids.filter((id) => id !== convention.id)
                  })
                }
              />
            ))}
          </div>
        ))}
        <TextAreaField
          label="House rules"
          hint="Free text appended to the conventions block."
          rows={3}
          value={project.conventions.custom}
          onChange={(event) =>
            update((doc) => {
              doc.conventions.custom = event.target.value
            })
          }
        />
      </section>
    </div>
  )
}
