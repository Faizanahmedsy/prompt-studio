export type Convention = {
  id: string
  label: string
  line: string
  group: "Naming" | "Structure" | "Code" | "UI" | "Process"
}

export const conventions: Convention[] = [
  {
    id: "kebab-files",
    label: "kebab-case files",
    group: "Naming",
    line: "Files and folders are kebab-case; component exports stay PascalCase.",
  },
  {
    id: "named-exports",
    label: "Named exports",
    group: "Naming",
    line: "Prefer named exports over default exports, except for framework-required files.",
  },
  {
    id: "barrel-exports",
    label: "One barrel per feature",
    group: "Structure",
    line: "Each feature exposes a single `index.ts`; nothing else in the feature is imported from outside it.",
  },
  {
    id: "no-deep-imports",
    label: "No cross-feature deep imports",
    group: "Structure",
    line: "Never reach into another feature's `components/` or `services/` — go through its barrel.",
  },
  {
    id: "alias-@",
    label: "`@/` path alias",
    group: "Structure",
    line: "Import via the `@/` alias rather than relative `../../` chains.",
  },
  {
    id: "shared-first",
    label: "Shared component first",
    group: "UI",
    line: "Before writing UI, check `components/shared/` and reuse it. Any markup used twice becomes a shared component — extract on the second use.",
  },
  {
    id: "no-native-controls",
    label: "No raw form controls",
    group: "UI",
    line: "Never use a raw `<input type=\"date\">`, `<select>` or bare `<button>` where the design system has a component for it.",
  },
  {
    id: "typed-payloads",
    label: "Typed payloads",
    group: "Code",
    line: "Type every payload, prop and return value; no implicit `any`. Use `import type` for type-only imports.",
  },
  {
    id: "schema-first",
    label: "Schema-first data",
    group: "Code",
    line: "Validate external data with a schema at the boundary and infer the types from it.",
  },
  {
    id: "server-state",
    label: "Server state stays in the cache",
    group: "Code",
    line: "Fetched data lives in the query cache — never copied into a client store or `useState`.",
  },
  {
    id: "ssr-safe",
    label: "SSR-safe client code",
    group: "Code",
    line: "No `window`/`document`/`localStorage` access at module scope or in a state initialiser; guard or defer to an effect.",
  },
  {
    id: "states-required",
    label: "Loading / empty / error required",
    group: "UI",
    line: "Every async surface ships all three states; no blank areas and no bare spinners.",
  },
  {
    id: "a11y-baseline",
    label: "Accessibility baseline",
    group: "UI",
    line: "Keyboard operable, labelled controls, visible focus, WCAG AA contrast.",
  },
  {
    id: "tokens-only",
    label: "Design tokens only",
    group: "UI",
    line: "No hardcoded colours, radii or shadows in components — reference the design tokens.",
  },
  {
    id: "small-files",
    label: "Small focused files",
    group: "Code",
    line: "Keep files focused; split a component once it does more than one job.",
  },
  {
    id: "comments-why",
    label: "Comments explain why",
    group: "Code",
    line: "Comment intent and trade-offs, not restatements of the code.",
  },
  {
    id: "conventional-commits",
    label: "Conventional commits",
    group: "Process",
    line: "Commit messages follow Conventional Commits.",
  },
  {
    id: "no-todo",
    label: "No TODOs shipped",
    group: "Process",
    line: "Do not leave TODO placeholders or stub screens — deliver each screen complete.",
  },
]

export const conventionMap = Object.fromEntries(
  conventions.map((c) => [c.id, c])
) as Record<string, Convention>

export const defaultConventionIds = [
  "kebab-files",
  "barrel-exports",
  "no-deep-imports",
  "alias-@",
  "shared-first",
  "typed-payloads",
  "states-required",
  "a11y-baseline",
  "tokens-only",
]
