import type { Stack } from "@/types/project"

export type StackOption = {
  id: string
  label: string
  /** the line injected into the Tech Stack block */
  promptLine: string
  /** ids from other groups this option cannot be combined with */
  incompatibleWith?: string[]
}

export type StackGroup = {
  key: keyof Omit<Stack, "extras">
  label: string
  hint: string
  options: StackOption[]
}

export const stackGroups: StackGroup[] = [
  {
    key: "framework",
    label: "Framework",
    hint: "Runtime + routing model",
    options: [
      {
        id: "next-16",
        label: "Next.js 16 (App Router)",
        promptLine:
          "Next.js 16 with the App Router; server components by default and `\"use client\"` only where interactivity requires it.",
      },
      {
        id: "next-15",
        label: "Next.js 15 (App Router)",
        promptLine: "Next.js 15 with the App Router and React Server Components.",
      },
      {
        id: "next-pages",
        label: "Next.js (Pages Router)",
        promptLine: "Next.js using the Pages Router with `getServerSideProps`/`getStaticProps`.",
      },
      {
        id: "vite-react",
        label: "Vite + React SPA",
        promptLine:
          "A Vite-powered React single-page app with React Router for client-side routing.",
        incompatibleWith: ["route-colocated"],
      },
      {
        id: "remix",
        label: "Remix / React Router 7",
        promptLine: "Remix (React Router 7 framework mode) with loaders and actions.",
      },
      {
        id: "astro",
        label: "Astro + React islands",
        promptLine: "Astro for static delivery with React islands for interactive parts.",
      },
    ],
  },
  {
    key: "language",
    label: "Language",
    hint: "Type-safety level",
    options: [
      {
        id: "ts-strict",
        label: "TypeScript (strict)",
        promptLine:
          "TypeScript in strict mode. No implicit `any`; every prop, payload and return value is typed.",
      },
      { id: "ts", label: "TypeScript", promptLine: "TypeScript with default compiler strictness." },
      { id: "js", label: "JavaScript", promptLine: "Plain JavaScript with JSDoc type hints." },
    ],
  },
  {
    key: "styling",
    label: "Styling",
    hint: "How components are styled",
    options: [
      {
        id: "tailwind4-shadcn",
        label: "Tailwind v4 + shadcn/ui",
        promptLine:
          "Tailwind CSS v4 with shadcn/ui primitives. All colour comes from CSS custom properties defined in `globals.css` — no hardcoded hex values in components.",
      },
      {
        id: "tailwind3-shadcn",
        label: "Tailwind v3 + shadcn/ui",
        promptLine: "Tailwind CSS v3 with shadcn/ui primitives and a `tailwind.config.ts` theme.",
      },
      { id: "tailwind", label: "Tailwind only", promptLine: "Tailwind CSS with hand-built components." },
      { id: "css-modules", label: "CSS Modules", promptLine: "CSS Modules with design tokens in a shared stylesheet." },
      { id: "styled", label: "styled-components", promptLine: "styled-components with a shared ThemeProvider." },
      { id: "mui", label: "MUI", promptLine: "MUI components with a customised theme." },
    ],
  },
  {
    key: "state",
    label: "State",
    hint: "Server cache + client state",
    options: [
      {
        id: "tanstack-zustand",
        label: "TanStack Query + Zustand",
        promptLine:
          "Server state in TanStack Query v5 (never copied into client stores); client/session state in Zustand; local UI state in `useState`.",
      },
      { id: "tanstack", label: "TanStack Query only", promptLine: "TanStack Query v5 for all server state." },
      { id: "redux", label: "Redux Toolkit", promptLine: "Redux Toolkit with RTK Query for data fetching." },
      { id: "swr", label: "SWR", promptLine: "SWR for data fetching and caching." },
      { id: "context", label: "React Context", promptLine: "React Context plus `useReducer` for shared state." },
      { id: "none-state", label: "Local state only", promptLine: "Component-local state only; no global store." },
    ],
  },
  {
    key: "forms",
    label: "Forms",
    hint: "Inputs + validation",
    options: [
      {
        id: "rhf-zod",
        label: "react-hook-form + zod",
        promptLine:
          "react-hook-form with zod resolvers; form types are inferred from the schema via `z.infer`.",
      },
      { id: "rhf", label: "react-hook-form", promptLine: "react-hook-form with hand-written validation rules." },
      { id: "formik", label: "Formik + Yup", promptLine: "Formik with Yup validation schemas." },
      { id: "native-forms", label: "Native form elements", promptLine: "Native form elements with the Constraint Validation API." },
    ],
  },
  {
    key: "http",
    label: "HTTP",
    hint: "How the API is called",
    options: [
      {
        id: "axios-instance",
        label: "axios (shared instance)",
        promptLine:
          "A single shared axios instance with interceptors for auth headers, response normalisation and 401 refresh — components never call axios directly.",
      },
      { id: "fetch-wrapper", label: "fetch wrapper", promptLine: "A thin typed `fetch` wrapper with a single place for auth and error handling." },
      { id: "server-actions", label: "Server actions", promptLine: "Next.js server actions for mutations; no client-side API layer." },
      { id: "trpc", label: "tRPC", promptLine: "tRPC for end-to-end typed procedures." },
      { id: "none-http", label: "No backend", promptLine: "No network layer — all data is local/mocked." },
    ],
  },
  {
    key: "icons",
    label: "Icons",
    hint: "Icon set",
    options: [
      { id: "lucide", label: "lucide-react", promptLine: "Icons from lucide-react at a consistent stroke width and size scale." },
      { id: "hugeicons", label: "Hugeicons", promptLine: "Icons from @hugeicons/react." },
      { id: "heroicons", label: "Heroicons", promptLine: "Icons from Heroicons." },
      { id: "radix-icons", label: "Radix icons", promptLine: "Icons from @radix-ui/react-icons." },
    ],
  },
  {
    key: "tables",
    label: "Tables",
    hint: "Grid engine",
    options: [
      { id: "tanstack-table", label: "TanStack Table", promptLine: "TanStack Table v8 behind one shared `DataTable` component." },
      { id: "ag-grid", label: "AG Grid", promptLine: "AG Grid for the data grids." },
      { id: "html-table", label: "Plain table", promptLine: "Semantic HTML tables with hand-rolled sorting." },
    ],
  },
  {
    key: "charts",
    label: "Charts",
    hint: "Visualisation library",
    options: [
      { id: "recharts", label: "Recharts", promptLine: "Recharts for charts, wrapped in a shared chart container with themed colours." },
      { id: "visx", label: "visx", promptLine: "visx for bespoke visualisations." },
      { id: "chartjs", label: "Chart.js", promptLine: "Chart.js via react-chartjs-2." },
      { id: "none-charts", label: "No charts", promptLine: "No charting library required." },
    ],
  },
  {
    key: "testing",
    label: "Testing",
    hint: "Test runner",
    options: [
      { id: "vitest", label: "Vitest + Testing Library", promptLine: "Vitest with React Testing Library for unit and component tests." },
      { id: "jest", label: "Jest + Testing Library", promptLine: "Jest with React Testing Library." },
      { id: "playwright", label: "Playwright (e2e)", promptLine: "Playwright for end-to-end coverage of the critical flows." },
      { id: "none-testing", label: "No tests", promptLine: "No automated tests required for this build." },
    ],
  },
  {
    key: "tooling",
    label: "Lint / format",
    hint: "Code hygiene",
    options: [
      { id: "biome-prettier", label: "Biome + Prettier", promptLine: "Biome for linting and Prettier for formatting, enforced on commit via Husky and lint-staged." },
      { id: "eslint-prettier", label: "ESLint + Prettier", promptLine: "ESLint with Prettier, enforced on commit." },
      { id: "biome", label: "Biome only", promptLine: "Biome for both linting and formatting." },
    ],
  },
  {
    key: "packageManager",
    label: "Package manager",
    hint: "Install tooling",
    options: [
      { id: "pnpm", label: "pnpm", promptLine: "pnpm as the package manager." },
      { id: "npm", label: "npm", promptLine: "npm as the package manager." },
      { id: "yarn", label: "yarn", promptLine: "yarn as the package manager." },
      { id: "bun", label: "bun", promptLine: "bun as the runtime and package manager." },
    ],
  },
]

export const stackGroupMap = Object.fromEntries(
  stackGroups.map((g) => [g.key, g])
) as Record<string, StackGroup>

export function findStackOption(groupKey: string, id: string) {
  return stackGroupMap[groupKey]?.options.find((o) => o.id === id)
}

/** Combinations that produce nonsense prompts if left unflagged. */
export function stackWarnings(stack: Stack): string[] {
  const warnings: string[] = []
  const selected = Object.entries(stack).filter(([k]) => k !== "extras") as [
    string,
    string,
  ][]
  for (const [groupKey, value] of selected) {
    const option = findStackOption(groupKey, value)
    if (!option) {
      warnings.push(`Unknown ${groupKey} option "${value}" — it will be passed through as free text.`)
      continue
    }
    for (const bad of option.incompatibleWith ?? []) {
      if (selected.some(([, v]) => v === bad)) {
        warnings.push(`${option.label} does not combine with "${bad}".`)
      }
    }
  }
  if (stack.framework === "vite-react" && stack.http === "server-actions") {
    warnings.push("Server actions need a Next.js/Remix server — pick a different HTTP layer for a Vite SPA.")
  }
  if (stack.styling === "tailwind4-shadcn" && stack.framework === "next-pages") {
    warnings.push("Tailwind v4 + shadcn assumes the App Router conventions; double-check with the Pages Router.")
  }
  return warnings
}
