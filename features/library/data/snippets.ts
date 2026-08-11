export type Snippet = {
  id: string
  name: string
  description: string
  category: "Quality" | "Data" | "UX" | "Delivery"
  lines: string[]
}

/**
 * Reusable requirement blocks. Toggling one appends its lines to the
 * Technical Requirements block of the generated prompt — so the whole team
 * ships the same non-negotiables without retyping them.
 */
export const snippets: Snippet[] = [
  {
    id: "a11y",
    name: "Accessibility pack",
    description: "Keyboard, labels, contrast, focus",
    category: "Quality",
    lines: [
      "Every interactive element is reachable and operable by keyboard, with a visible focus ring.",
      "Form controls have associated labels; icon-only buttons carry an accessible name.",
      "Colour contrast meets WCAG AA (4.5:1 for body text, 3:1 for large text and UI borders).",
      "Dialogs trap focus, close on Escape and return focus to the trigger.",
      "Respect prefers-reduced-motion: no essential information is conveyed by motion alone.",
    ],
  },
  {
    id: "states",
    name: "Loading / empty / error states",
    description: "No blank screens, ever",
    category: "Quality",
    lines: [
      "Every async surface has three explicit states: layout-shaped skeleton while loading, an illustrated empty state with one primary action, and an error state with a retry.",
      "Never render a bare spinner in place of a page, and never render a blank area for an empty list.",
      "Mutations show pending state on the triggering control and disable double submission.",
    ],
  },
  {
    id: "forms",
    name: "Form validation pack",
    description: "Schema-first, inline errors",
    category: "Data",
    lines: [
      "Validate with a schema (zod) and infer the form types from it — no duplicated type definitions.",
      "Show field errors inline beneath the field, and summarise on submit for screen readers.",
      "Preserve entered values on failure; warn before discarding unsaved changes.",
    ],
  },
  {
    id: "tables",
    name: "Data table pack",
    description: "Sort, filter, paginate, export",
    category: "Data",
    lines: [
      "Tables support column sorting, text search, faceted filters, column visibility and pagination with page size.",
      "Row actions live in an overflow menu; destructive actions require confirmation naming the record.",
      "Provide a CSV export of the current filtered view.",
      "Tables scroll horizontally inside their own container — the page body never scrolls sideways.",
    ],
  },
  {
    id: "responsive",
    name: "Responsive rules",
    description: "Mobile-first, no clipped viewports",
    category: "UX",
    lines: [
      "Mobile-first: design the small screen first, then enhance upward at sm/md/lg/xl.",
      "Use dvh rather than vh for full-height layouts so mobile browser chrome cannot clip content.",
      "Multi-column layouts collapse to a single column below md; side panels become sheets.",
      "Tap targets are at least 44×44px with 8px of separation.",
    ],
  },
  {
    id: "rbac",
    name: "Permissions / RBAC",
    description: "Gate UI by capability",
    category: "Data",
    lines: [
      "Gate every action by an explicit permission check, not by role name comparisons scattered in components.",
      "Hide actions the user cannot perform rather than showing them disabled without explanation.",
      "Treat the client-side check as UX only — the server remains the authority.",
    ],
  },
  {
    id: "dark-mode",
    name: "Theming & dark mode",
    description: "Token-driven, both themes",
    category: "UX",
    lines: [
      "All colour comes from CSS custom properties defined once for light and dark; no hardcoded hex values in components.",
      "Both themes are designed, not inverted: verify contrast in each.",
      "Respect the system preference by default and remember an explicit user override.",
    ],
  },
  {
    id: "perf",
    name: "Performance budget",
    description: "Fast by construction",
    category: "Delivery",
    lines: [
      "Server components by default; add a client boundary only where interactivity requires it.",
      "Lazy-load heavy widgets (charts, editors, maps) and avoid blocking the first paint on them.",
      "Images use the framework's image component with explicit dimensions to prevent layout shift.",
    ],
  },
  {
    id: "testing",
    name: "Testing expectations",
    description: "Cover the logic that can break",
    category: "Delivery",
    lines: [
      "Unit-test pure logic (formatters, reducers, validation) and cover each non-trivial branch.",
      "Add a smoke test per screen asserting it renders its loading, empty and populated states.",
    ],
  },
  {
    id: "copy",
    name: "Microcopy rules",
    description: "Plain, specific language",
    category: "UX",
    lines: [
      "Buttons name the action ('Create client'), never 'Submit' or 'OK'.",
      "Error messages say what happened and what to do next; never surface a raw exception.",
      "Dates, currency and numbers use a shared formatter — no ad-hoc formatting in components.",
    ],
  },
]

export const snippetMap = Object.fromEntries(
  snippets.map((s) => [s.id, s])
) as Record<string, Snippet>
