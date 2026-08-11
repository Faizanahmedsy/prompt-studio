import type { Wire } from "./wire"

export type LayoutScope = "screen" | "section"

export type LayoutOption = {
  id: string
  name: string
  description: string
  category: string
  scope: LayoutScope
  /** for section layouts: which section type they belong to */
  sectionType?: string
  /** screen templates this layout suits — used to sort the picker */
  templates?: string[]
  /** the sentence injected into the generated prompt */
  promptDetails: string
  wire: Wire
}
