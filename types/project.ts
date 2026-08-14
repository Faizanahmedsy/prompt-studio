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

export const SCHEMA_VERSION = 1

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

export const screenSchema = z.object({
  id: z.string(),
  /** stable slug used by the `.flow` language — unique per project */
  key: z.string(),
  title: z.string(),
  template: z.string().default(""),
  layout: z.string().default(""),
  note: z.string().default(""),
  x: z.number().default(0),
  y: z.number().default(0),
})

export const edgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  /** what causes the transition — "on submit", "click Add Client" */
  trigger: z.string().default(""),
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

export const projectDocSchema = z.object({
  name: z.string().default("Untitled project"),
  target: z.string().default("claude-code"),
  creativity: z.number().min(0).max(10).default(5),
  screens: z.array(screenSchema).default([]),
  edges: z.array(edgeSchema).default([]),
  sections: z.array(sectionSchema).default([]),
  theme: themeSchema.default({}),
  stack: stackSchema.default({}),
  structure: structureSchema.default({}),
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
export type FlowEdge = z.infer<typeof edgeSchema>
export type Section = z.infer<typeof sectionSchema>
export type Stack = z.infer<typeof stackSchema>
export type Structure = z.infer<typeof structureSchema>
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
