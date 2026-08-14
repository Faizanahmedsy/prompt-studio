"use client"

import { Sparkles, SlidersHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"
import { type Experience, useUiStore } from "@/stores/use-ui-store"

const OPTIONS: {
  value: Experience
  label: string
  hint: string
  icon: typeof Sparkles
}[] = [
  {
    value: "easy",
    label: "Easy",
    hint: "Screens, layouts and a prompt. Nothing else.",
    icon: Sparkles,
  },
  {
    value: "advanced",
    label: "Advanced",
    hint: "Adds stack, conventions, Flow source, diffs and versions.",
    icon: SlidersHorizontal,
  },
]

/**
 * The one control that decides how much of the tool is on screen. Deliberately
 * large — it changes the whole workbench, so it should not look like a minor
 * icon button sitting among the others.
 */
export function ExperienceToggle() {
  const experience = useUiStore((s) => s.experience)
  const setExperience = useUiStore((s) => s.setExperience)

  return (
    <div
      role="group"
      aria-label="Interface mode"
      className="inline-flex shrink-0 rounded-full bg-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = experience === option.value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setExperience(option.value)}
            aria-pressed={active}
            title={option.hint}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            <span className="max-sm:hidden">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
