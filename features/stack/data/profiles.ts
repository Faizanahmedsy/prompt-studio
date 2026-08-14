import type { StackProfile } from "@/types/project"

import { defaultConventionIds } from "./conventions"

/**
 * Built-in stack profiles. A profile bundles stack + folder structure +
 * conventions so a team can standardise every prompt in one click.
 */
export const builtInProfiles: StackProfile[] = [
  {
    id: "house-rules",
    name: "House rules",
    stack: {
      framework: "next-16",
      language: "ts-strict",
      styling: "tailwind4-shadcn",
      state: "tanstack-zustand",
      forms: "rhf-zod",
      http: "axios-instance",
      icons: "lucide",
      tables: "tanstack-table",
      charts: "recharts",
      testing: "none-testing",
      tooling: "biome-prettier",
      packageManager: "pnpm",
      extras: ["sonner for toasts", "next-themes for dark mode"],
    },
    structure: { preset: "feature-based", customTree: "" },
    conventions: {
      ids: [
        ...defaultConventionIds,
        "no-native-controls",
        "server-state",
        "ssr-safe",
        "no-todo",
      ],
      // Keep in sync with the snippets enabled by default for this profile.
      custom:
        "Backend is a separate repo — never modify it. If the API needs a change, state the required contract instead of working around it.",
    },
  },
  {
    id: "marketing-site",
    name: "Marketing site",
    stack: {
      framework: "next-16",
      language: "ts-strict",
      styling: "tailwind4-shadcn",
      state: "none-state",
      forms: "rhf-zod",
      http: "none-http",
      icons: "lucide",
      tables: "html-table",
      charts: "none-charts",
      testing: "none-testing",
      tooling: "biome-prettier",
      packageManager: "pnpm",
      extras: ["next/image for all imagery", "metadata + Open Graph per route"],
    },
    structure: { preset: "route-colocated", customTree: "" },
    conventions: {
      ids: ["kebab-files", "shared-first", "tokens-only", "a11y-baseline", "alias-@"],
      custom: "Ship real copy, not lorem ipsum. Every section must work with content of varying length.",
    },
  },
  {
    id: "spa-prototype",
    name: "Vite SPA prototype",
    stack: {
      framework: "vite-react",
      language: "ts-strict",
      styling: "tailwind4-shadcn",
      state: "tanstack",
      forms: "rhf-zod",
      http: "fetch-wrapper",
      icons: "lucide",
      tables: "tanstack-table",
      charts: "recharts",
      testing: "vitest",
      tooling: "biome",
      packageManager: "pnpm",
      extras: [],
    },
    structure: { preset: "src-layered", customTree: "" },
    conventions: {
      ids: ["kebab-files", "typed-payloads", "states-required", "a11y-baseline"],
      custom: "",
    },
  },
]
