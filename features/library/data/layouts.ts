import type { LayoutOption } from "./layout-types"
import { screenLayouts } from "./layouts-screen"
import { sectionLayouts } from "./layouts-section"

export const allLayouts: LayoutOption[] = [...screenLayouts, ...sectionLayouts]

export const layoutMap = Object.fromEntries(
  allLayouts.map((l) => [l.id, l])
) as Record<string, LayoutOption>

export function getLayout(id: string): LayoutOption | undefined {
  return layoutMap[id]
}

/** Never throws — an unknown id still produces usable prompt text. */
export function describeLayout(id: string) {
  const known = layoutMap[id]
  if (known) return known
  return {
    id,
    name: id || "Default layout",
    description: "Custom layout",
    category: "Custom",
    scope: "screen" as const,
    promptDetails: id
      ? `A ${id.replace(/[-_]/g, " ")} layout, implemented sensibly for this screen.`
      : "Use the conventional layout for this kind of screen.",
    wire: { k: "spacer" as const },
  }
}

export function layoutsForSection(sectionType: string) {
  return sectionLayouts.filter((l) => l.sectionType === sectionType)
}

/** Screen layouts, best matches for the template first. */
export function layoutsForTemplate(template: string) {
  if (!template) return screenLayouts
  const matches = screenLayouts.filter((l) => l.templates?.includes(template))
  const rest = screenLayouts.filter((l) => !l.templates?.includes(template))
  return [...matches, ...rest]
}

export function layoutCategories(layouts: LayoutOption[]) {
  return Array.from(new Set(layouts.map((l) => l.category)))
}

export { screenLayouts, sectionLayouts }
export type { LayoutOption }
