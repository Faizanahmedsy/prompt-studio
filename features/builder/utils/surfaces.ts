import {
  type ProjectDoc,
  type Stack,
  type Structure,
  type Surface,
  stackSchema,
  structureSchema,
} from "@/types/project"

/**
 * A surface is one build of the product: the web app, the phone app, the
 * service behind them.
 *
 * They share what is genuinely shared — the brand, the brief, the roles — and
 * split on what is genuinely different: the stack, the folder structure and the
 * generated prompt. Keeping them in one project is what lets a mobile screen
 * sit next to the backend endpoint it calls; keeping the stacks apart is what
 * stops a React Native build being told to use shadcn.
 */
export const surfaceMeta: Record<
  Surface,
  { label: string; icon: string; hint: string }
> = {
  web: {
    label: "Web",
    icon: "globe",
    hint: "Browser app — routes, pages, responsive layouts",
  },
  mobile: {
    label: "Mobile",
    icon: "smartphone",
    hint: "Phone app — React Native or native iOS",
  },
  backend: {
    label: "Backend",
    icon: "layers",
    hint: "Services, endpoints and jobs",
  },
}

/**
 * Sensible starting stacks, so switching to Mobile does not hand you a Next.js
 * config to correct by hand. Only used when that surface is first configured.
 */
export const surfaceStackDefaults: Record<Surface, Partial<Stack>> = {
  web: {},
  mobile: {
    framework: "expo-router",
    styling: "nativewind",
    state: "rn-query-zustand",
    icons: "rn-vector-icons",
    tables: "rn-flashlist",
    charts: "victory-native",
    testing: "rn-testing-library",
  },
  backend: {
    framework: "",
    styling: "",
    state: "",
    forms: "",
    icons: "",
    tables: "",
    charts: "",
  },
}

const surfaceStructureDefaults: Record<Surface, string> = {
  web: "feature-based",
  mobile: "expo-feature-based",
  backend: "src-layered",
}

export function defaultStackFor(surface: Surface): Stack {
  return stackSchema.parse(surfaceStackDefaults[surface])
}

export function defaultStructureFor(surface: Surface): Structure {
  return structureSchema.parse({ preset: surfaceStructureDefaults[surface] })
}

/** The web surface keeps the top-level fields — see the schema comment. */
export function stackFor(doc: ProjectDoc, surface: Surface): Stack {
  return surface === "web" ? doc.stack : doc.surfaces[surface].stack
}

export function structureFor(doc: ProjectDoc, surface: Surface): Structure {
  return surface === "web" ? doc.structure : doc.surfaces[surface].structure
}

export function screensOnSurface(doc: ProjectDoc, surface: Surface) {
  return doc.screens.filter((screen) => screen.surface === surface)
}

export function edgesOnSurface(doc: ProjectDoc, surface: Surface) {
  const ids = new Set(screensOnSurface(doc, surface).map((s) => s.id))
  // A transition between surfaces is not a transition — it is an integration,
  // and belongs in the brief rather than as an arrow.
  return doc.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
}

/** Surfaces this project actually uses, so empty tabs can be de-emphasised. */
export function usedSurfaces(doc: ProjectDoc): Surface[] {
  const used = new Set(doc.screens.map((s) => s.surface))
  return (["web", "mobile", "backend"] as Surface[]).filter((s) => used.has(s))
}

export function countsBySurface(doc: ProjectDoc): Record<Surface, number> {
  const counts: Record<Surface, number> = { web: 0, mobile: 0, backend: 0 }
  for (const screen of doc.screens) counts[screen.surface] += 1
  return counts
}
