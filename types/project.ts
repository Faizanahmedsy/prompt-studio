import { z } from "zod"

/**
 * The project document is the single source of truth for everything the app
 * generates: the flow graph, the landing stack, the design system, the target
 * stack/structure/conventions and the free-text requirements.
 *
 * The zod schemas here are also the import boundary — anything arriving from a
 * `.json` file, a share link or a `.flow` paste is parsed through them before
 * it is allowed anywhere near the store.
 */

export const SCHEMA_VERSION = 4

export const borderRadiusValues = [
  "none",
  "small",
  "medium",
  "large",
  "full",
] as const
export const buttonStyleValues = [
  "filled",
  "outlined",
  "rounded",
  "sharp",
] as const

export const themeSchema = z.object({
  /** id from features/theme/data/design-languages.ts */
  designLanguage: z.string().default("modern-soft"),
  primaryColor: z.string().default("#4f46e5"),
  secondaryColor: z.string().default("#0ea5e9"),
  borderRadius: z.enum(borderRadiusValues).default("medium"),
  buttonStyle: z.enum(buttonStyleValues).default("filled"),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
})

/**
 * A perspective on the same application — "Super Admin", "Admin", "Field Rep".
 *
 * Views are not separate diagrams. One real app has one set of screens, and a
 * role changes which of them you can reach; duplicating Sign In per role would
 * mean editing it per role and letting the copies drift.
 */
export const viewSchema = z.object({
  id: z.string(),
  /** stable slug used by the `.flow` language — unique per project */
  key: z.string(),
  name: z.string(),
  note: z.string().default(""),
})

/**
 * Which build a screen belongs to. One product often ships as a web app, a
 * phone app and the service behind them; they share a brand, a brief and a set
 * of roles, but they are separate builds with separate stacks — so the surface
 * lives on the screen and the canvas shows one at a time.
 */
export const surfaceValues = ["web", "mobile", "backend"] as const
export type Surface = (typeof surfaceValues)[number]

export const screenSchema = z.object({
  id: z.string(),
  /** stable slug used by the `.flow` language — unique per project */
  key: z.string(),
  title: z.string(),
  template: z.string().default(""),
  layout: z.string().default(""),
  note: z.string().default(""),
  /** which build this screen is part of */
  surface: z.enum(surfaceValues).default("web"),
  /**
   * View ids this screen belongs to. **Empty means every view** — shared
   * surfaces are the common case, and it keeps projects written before views
   * existed behaving exactly as they did.
   */
  views: z.array(z.string()).default([]),
  x: z.number().default(0),
  y: z.number().default(0),
})

/**
 * A module is a piece of a screen — a table, a filter bar, a modal, a row menu.
 * Big existing applications carry most of their behaviour inside a screen, not
 * between screens, and a diagram that stops at screen level cannot describe
 * them. Modules are optional: a project with none behaves exactly as before.
 *
 * They are stored flat rather than nested inside the screen so undo, merge and
 * the schema-revalidating rehydrate keep working unchanged.
 */
export const moduleSchema = z.object({
  id: z.string(),
  /** owning screen id */
  screenId: z.string(),
  /** unique within the owning screen — how `.flow` refers to it */
  key: z.string(),
  name: z.string(),
  /** id from features/library/data/module-kinds.ts */
  kind: z.string().default("panel"),
  /** what opens or fires it — "click Add Client", "on page load" */
  trigger: z.string().default(""),
  note: z.string().default(""),
  order: z.number().default(0),
})

/** A transition between two modules of the same screen. */
export const moduleEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  trigger: z.string().default(""),
})

export const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  /** what causes the transition — "on submit", "click Add Client" */
  trigger: z.string().default(""),
  /** view ids this transition exists in; empty means every view */
  views: z.array(z.string()).default([]),
})

export const sectionSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  layout: z.string().default(""),
  note: z.string().default(""),
  order: z.number(),
})

export const stackSchema = z.object({
  framework: z.string().default("next-16"),
  language: z.string().default("ts-strict"),
  styling: z.string().default("tailwind4-shadcn"),
  state: z.string().default("tanstack-zustand"),
  forms: z.string().default("rhf-zod"),
  http: z.string().default("axios-instance"),
  icons: z.string().default("lucide"),
  tables: z.string().default("tanstack-table"),
  charts: z.string().default("recharts"),
  testing: z.string().default("vitest"),
  tooling: z.string().default("biome-prettier"),
  packageManager: z.string().default("pnpm"),
  /** free-text additions the catalogue does not know about */
  extras: z.array(z.string()).default([]),
})

export const structureSchema = z.object({
  preset: z.string().default("feature-based"),
  customTree: z.string().default(""),
})

export const conventionsSchema = z.object({
  ids: z.array(z.string()).default([]),
  custom: z.string().default(""),
})

/** The stack and folder structure for one non-web surface. */
export const surfaceConfigSchema = z.object({
  stack: stackSchema.default({}),
  structure: structureSchema.default({}),
})

/**
 * A surface arrives pre-configured. Switching to Mobile and finding Next.js 16
 * and shadcn selected would mean correcting six dropdowns before the tab is
 * usable, and anyone who skipped that would generate a React Native prompt full
 * of web libraries.
 */
const mobileSurfaceDefaults = {
  stack: {
    framework: "expo-router",
    styling: "nativewind",
    state: "rn-query-zustand",
    icons: "rn-vector-icons",
    tables: "rn-flashlist",
    charts: "victory-native",
    testing: "rn-testing-library",
  },
  structure: { preset: "expo-feature-based" },
}

const backendSurfaceDefaults = {
  stack: {
    // A service has no UI, so the presentation choices are deliberately blank
    // rather than a web default nobody meant to pick.
    framework: "",
    styling: "",
    forms: "",
    icons: "",
    tables: "",
    charts: "",
  },
  structure: { preset: "src-layered" },
}

export const projectDocSchema = z.object({
  name: z.string().default("Untitled project"),
  target: z.string().default("claude-code"),
  creativity: z.number().min(0).max(10).default(5),
  views: z.array(viewSchema).default([]),
  screens: z.array(screenSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  modules: z.array(moduleSchema).default([]),
  moduleEdges: z.array(moduleEdgeSchema).default([]),
  sections: z.array(sectionSchema).default([]),
  theme: themeSchema.default({}),
  /**
   * `stack` and `structure` are the **web** surface's, kept at the top level so
   * every project written before surfaces existed still means what it said.
   * Mobile and backend carry their own under `surfaces`.
   */
  stack: stackSchema.default({}),
  structure: structureSchema.default({}),
  surfaces: z
    .object({
      mobile: surfaceConfigSchema.default(() =>
        surfaceConfigSchema.parse(mobileSurfaceDefaults)
      ),
      backend: surfaceConfigSchema.default(() =>
        surfaceConfigSchema.parse(backendSurfaceDefaults)
      ),
    })
    .default({}),
  conventions: conventionsSchema.default({}),
  requirements: z.string().default(""),
  snippetIds: z.array(z.string()).default([]),
})

export const snapshotSchema = z.object({
  id: z.string(),
  label: z.string(),
  createdAt: z.number(),
  doc: projectDocSchema,
})

export const projectSchema = projectDocSchema.extend({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  schemaVersion: z.number().default(SCHEMA_VERSION),
  versions: z.array(snapshotSchema).default([]),
})

/** what an exported `.json` file / share link carries */
export const projectFileSchema = z.object({
  kind: z.literal("prompt-studio/project"),
  schemaVersion: z.number(),
  exportedAt: z.number().optional(),
  project: projectSchema,
})

export type Theme = z.infer<typeof themeSchema>
export type Screen = z.infer<typeof screenSchema>
export type FlowView = z.infer<typeof viewSchema>
export type FlowEdge = z.infer<typeof edgeSchema>
export type ScreenModule = z.infer<typeof moduleSchema>
export type ModuleEdge = z.infer<typeof moduleEdgeSchema>
export type Section = z.infer<typeof sectionSchema>
export type Stack = z.infer<typeof stackSchema>
export type Structure = z.infer<typeof structureSchema>
export type SurfaceConfig = z.infer<typeof surfaceConfigSchema>
export type Conventions = z.infer<typeof conventionsSchema>
export type ProjectDoc = z.infer<typeof projectDocSchema>
export type Snapshot = z.infer<typeof snapshotSchema>
export type Project = z.infer<typeof projectSchema>
export type ProjectFile = z.infer<typeof projectFileSchema>

export type StackProfile = {
  id: string
  name: string
  stack: Stack
  structure: Structure
  conventions: Conventions
}
