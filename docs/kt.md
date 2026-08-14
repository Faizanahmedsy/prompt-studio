# Prompt Studio — knowledge transfer / resume prompt

> **New Claude Code session: read this file top to bottom before touching code.**
> It is the whole context — product intent, agreed design, what exists, what is
> half-built, and the exact next step. Nothing else needs to be reconstructed
> from the old repo.

Repo: `/home/faizan/devstree_projects/Intelli Wealth Repos/prompt-studio`
Status: **v1 complete.** All features built. `pnpm test` (32 tests),
`pnpm typecheck` and `pnpm build` all pass. Never opened in a browser yet —
first job for anyone picking this up is `pnpm dev` and a visual pass at 360 /
768 / 1280px in both themes.
Date started: 2026-08-11.

> Sections 4–5 below describe the mid-build state and are kept for the design
> rationale. For the shipped file map read `README.md` first.

---

## 1. What this product is

An **internal tool for this company's developers**. It is a *visual editor for a
frontend build prompt*.

The loop it exists to serve:

1. Dev clicks **"Copy prompt for diagram syntax"** → gets a big authoring prompt
   explaining the product and the `.flow` language.
2. Dev pastes that into ChatGPT together with the client's requirements →
   ChatGPT emits `.flow` source describing the whole app (screens, layouts,
   navigation, stack).
3. Dev pastes the `.flow` back into Prompt Studio → it renders as an **editable
   flow diagram** (nodes + labelled connectors) plus a landing-section stack.
4. Dev edits visually, then hits **Generate prompt** → a complete build prompt
   for **Claude Code** (or v0 / Cursor / Lovable / generic) that produces the app.

Frontend only. No backend, no auth, no AI calls from the app itself. Everything
persists in the browser.

**Quality bar set by the user, verbatim in spirit:** *"make it real app not a ai
slop, this will be an internal tool many devs of this company will depend on"*
and *"make sure there are no UI issues, make it fully responsive"* and *"make
sure small mock screens shown during add layout look extremely good and
beautiful"*. Treat those as hard requirements, not flavour text.

### Origin
It replaces `../propmt-builder` — a v0.dev-generated Next 15 app (flat
`components/`, all `useState`, no persistence, hardcoded `bg-gray-50`, no dark
mode, desktop-only, drag-broken canvas, connections made by clicking a "→ Page1"
button). Read it only for feature reference. **Do not copy its code.**

### House reference
`../frontend` (the main product, Next 16) is the conventions reference — read its
`CLAUDE.md`. Same folder philosophy and code rules, **deliberately different UI**
(different shell, different palette). Never edit `../frontend` or `../backend`.

---

## 2. Decisions already made (do not re-litigate)

| Question | Decision |
|---|---|
| Location | New repo `prompt-studio/`, sibling of `frontend/`. Old `propmt-builder/` untouched. |
| Framework | Next 16 App Router, React 19, TS strict, Tailwind v4, pnpm. |
| Folder shape | Mirrors `../frontend`: `app/ features/<x>/{components,data,services,types,utils} components/{ui,shared,layout} stores/ lib/ types/`. Feature exposes one barrel `index.ts`; no cross-feature deep imports. kebab-case files, PascalCase exports. |
| Prompt output | Multi-target with presets: `claude-code` (XML-ish blocks), `v0`, `cursor`, `lovable`, `generic`. |
| Persistence | localStorage projects + JSON import/export + gzip share links (`#s=`) + per-project version snapshots. |
| Non-AI features (all four requested) | live prompt preview + token/char meter + diff; ⌘K palette + hotkeys + undo/redo; templates + snippet library; markdown/JSON export + print view + version history. |
| Shell | **Three-pane workbench + thin top bar.** Top: project switcher, target preset, actions. Left: library/outline. Centre: canvas or preview. Right: inspector. Panels collapsible + resizable, sizes persisted. |
| Canvas | Free canvas via `@xyflow/react` — pan/zoom/snap, drag-from-port connectors, one-click auto-arrange (hand-rolled layered layout, no dagre). |
| Connectors | Real directed edges with an optional **trigger label** ("on submit", "click Add Client"). The prompt's Navigation block is generated from the graph. |
| Mobile | Full editing on small screens: panes become sheets/tabs, canvas swaps to an **editable outline list** (same model, two views). Not view-only. |
| Layout thumbnails | Declarative wireframe DSL + one renderer, token-coloured, theme-aware, three sizes, hover/selected/focus states. |
| `.flow` language | Real language with a tolerant hand-written parser (~200 lines, no parser generator) + serializer for round-trip. JSON+zod import stays as fallback. |
| Stack/structure/conventions | Selectable catalogues, saved together as reusable **Stack Profiles**; ships a "House rules" profile. |
| Deps | radix primitives, zustand, cmdk, react-hotkeys-hook, sonner, lucide-react, zod, next-themes, `@xyflow/react`, `react-resizable-panels`, vitest (dev). No TanStack Query / axios (zero network). |

---

## 3. Domain model (already written — `types/project.ts`)

Zod schemas are the source of truth and the **import trust boundary**: anything
from a `.json` file, share link or `.flow` paste is parsed through them before
reaching the store.

```
Project { id, name, target, creativity 0-10,
          screens[], edges[], sections[],
          theme, stack, structure, conventions,
          requirements, snippetIds[],
          createdAt, updatedAt, schemaVersion, versions[] }

Screen  { id, key, title, template, layout, note, x, y }   // key = .flow slug
FlowEdge{ id, from, to, trigger }
Section { id, type, name, layout, note, order }
Theme   { primaryColor, secondaryColor, borderRadius, buttonStyle, density }
Stack   { framework, language, styling, state, forms, http, icons, tables,
          charts, testing, tooling, packageManager, extras[] }
Structure { preset, customTree }
Conventions { ids[], custom }
```
`projectDocSchema` = everything except id/timestamps/versions. `snapshotSchema`
wraps a `doc` for version history. `projectFileSchema` is the export envelope
(`kind: "prompt-studio/project"`).

---

## 4. What already exists on disk (~4,000 LOC, all written, **none compiled yet**)

### Config
`package.json` (all deps installed, `node_modules` present), `tsconfig.json`
(`@/*` → repo root), `next.config.ts`, `postcss.config.mjs`, `biome.json`,
`.prettierrc` (no semis, double quotes, width 80), `.gitignore`.

### `lib/`
- `utils.ts` — `cn`, `uid`, `slugify`, `uniqueKey`, date/relative formatters,
  `estimateTokens` (len/4), `countWords`.
- `share-codec.ts` — `encodeShare`/`decodeShare` using native
  `CompressionStream("gzip")` + base64url; `v1.` prefix gzip, `p1.` plain
  fallback; `shareUrl`, `readShareToken`, `clearShareToken`.
- `download.ts` — `downloadFile`, `copyText` (with textarea fallback),
  `readFileAsText`.

### `types/project.ts`
All schemas above. `SCHEMA_VERSION = 1`.

### `features/library/` — catalogues + thumbnails
- `data/wire.ts` — the wireframe DSL **types** (`Wire` union: frame, stack, bar,
  pill, circle, grid, chart, table, field, avatarRow, spacer; tones: line,
  strong, surface, accent, accentSoft, accentLine).
- `data/wire-helpers.ts` — builders (`col`, `row`, `bar`, `heading`, `sub`,
  `pill`, `circle`, `grid`, `chart`, `table`, `field`, `avatarRow`, `spacer`,
  `frame`, `card`).
- `components/layout-thumb.tsx` — the renderer. Fixed 16:10 frame, one `UNIT`
  scale per size (sm/md/lg) so every measurement stays proportional, browser and
  phone frames, `--thumb-accent` CSS var driven by the project's primary colour,
  hover lift / selected ring / reduced-motion handling.
  **Depends on `.wire-*` classes that do not exist yet — see §5.**
- `data/layout-types.ts` — `LayoutOption { id, name, description, category,
  scope, sectionType?, templates?, promptDetails, wire }`.
- `data/layouts-screen.ts` — ~26 screen layouts (auth ×4, dashboard ×4, forms ×4,
  tables ×4, profile/settings ×3, detail ×2, commerce ×2, misc ×6) each with
  prompt text + wireframe.
- `data/layouts-section.ts` — ~35 section layouts across navigation, hero,
  features, testimonials, logos, stats, pricing, faq, cta, gallery, team, blog,
  contact, footer.
- `data/layouts.ts` — `allLayouts`, `layoutMap`, `getLayout`, `describeLayout`
  (never throws — unknown id still yields prompt text), `layoutsForSection`,
  `layoutsForTemplate` (best match first), `layoutCategories`.
- `data/templates.ts` — 17 screen templates (auth, dashboard, table, form,
  detail, profile, settings, admin, onboarding, checkout, product, landing,
  search, chat, calendar, empty, mobile) with `icon` keys + prompt text.
- `data/section-types.ts` — 14 section types with `icon` keys + prompt text.
- `data/snippets.ts` — 10 toggleable requirement packs (a11y, states, forms,
  tables, responsive, rbac, dark-mode, perf, testing, copy).

### `features/stack/data/`
- `stack-catalogue.ts` — 12 groups × options, each with a `promptLine`;
  `stackWarnings()` flags impossible combos (Vite + server actions, etc.).
- `structures.ts` — 6 folder presets incl. the house feature-based tree + custom.
- `conventions.ts` — 18 convention lines grouped Naming/Structure/Code/UI/Process
  + `defaultConventionIds`.
- `profiles.ts` — built-in Stack Profiles: **House rules**,
  Marketing site, Vite SPA prototype.

### `features/builder/utils/graph.ts`
`analyseGraph()` → entries, BFS `ordered`, `unreachable`, `branching`, `cycles`,
`danglingEdges`. Plus `outgoingEdges`, `edgeExists`, and `autoLayout()` (layered
columns by depth, guard against cycles).

### `features/prompt/engine/`
- `targets.ts` — the 5 targets with block order, preamble, closing, format
  (markdown vs XML tags), `stackDetail`.
- `build-prompt.ts` — `buildPrompt(doc) → { text, blocks, warnings }`. Blocks:
  overview, screens (in flow order), navigation (entries, `A → B → C`, per-edge
  transitions, branch points), sections, design (theme + creativity sentence),
  stack, structure, conventions, requirements (base + snippets), additional,
  delivery. `collectWarnings()` surfaces unconnected screens, cycles, dangling
  edges, missing layouts/templates, stack conflicts.
- `diff.ts` — LCS line diff + `diffStats`.

### `features/flow-lang/tokenize.ts` — **INCOMPLETE, HAS A KNOWN BUG**
Pre-pass: lifts `"""…"""` heredocs, strips `//` and `# ` comments (so `#2563eb`
colours survive), splits on `;` and braces, keeps line numbers. Also exports
`readQuoted`, `editDistance`, `closestMatch` (typo → nearest valid id).

**Bug to fix first:** the heredoc placeholder is `" H<n> "` and `resolveHeredoc`
matches `/^ H(\d+) $/`, which breaks as soon as the statement is trimmed. Replace
with a distinctive token, e.g. `«H0»`, and match `/^«H(\d+)»$/` after `.trim()`.
An edit attempting exactly this was in flight when the session ended — verify the
file's current contents before assuming either state.

---

## 5. What is NOT built yet (the remaining work, in order)

1. **`app/globals.css`** — Tailwind v4 `@theme inline` tokens (own palette,
   *not* the product green), light + dark, plus the `.wire-*` classes the
   thumbnail renderer needs:
   `wire-line`, `wire-strong`, `wire-surface`, `wire-accent`,
   `wire-accent-soft`, `wire-accent-line`, `wire-border`, `wire-border-b`,
   `wire-border-accent`, `wire-field`, `wire-donut`, `wire-thumb`.
   Use `color-mix(in oklab, …)` against `--foreground` / `--thumb-accent` so one
   definition works in both themes.
2. **`app/layout.tsx` / `providers.tsx` / `page.tsx`** — fonts, `next-themes`,
   sonner `<Toaster />`, the workbench page.
3. **`components/ui/`** — shadcn-style primitives, hand-written (no CLI):
   button, input, textarea, label, badge, card, dialog, sheet, tabs, select,
   separator, tooltip, dropdown-menu, popover, scroll-area, switch, slider,
   checkbox, command (cmdk), sonner, resizable.
4. **`components/shared/`** — the reuse layer: `text-field`, `select-field`,
   `color-field`, `empty-state`, `confirm-dialog`, `section-header`, `chip`,
   `kbd`, `panel`. Extract on second use; never inline duplicate markup.
5. **`stores/`** — `use-project-store.ts` (zustand `persist`, key `ps:v1`,
   `skipHydration` on server, many named projects, debounced autosave, undo/redo
   snapshot ring capped at 50 with canvas drags coalesced into one step, version
   snapshots capped at 20) and `use-ui-store.ts` (panel sizes, collapsed state,
   active mode, theme).
6. **`features/flow-lang/`** — finish `parser.ts` (grammar in §6), `serializer.ts`
   (canonical emit → round-trip), `authoring-prompt.ts` (generated **from the
   catalogues** so the valid-id list can never drift), `index.ts`.
7. **`features/library/components/`** — `layout-picker.tsx` (category rail,
   search, responsive 2/3/4 grid, arrow-key navigation, `lg` hover detail pane
   showing description + what it injects into the prompt), `glyph.tsx` (icon key
   → lucide component map used by templates/section types).
8. **`features/builder/components/`** — `flow-canvas.tsx` (`@xyflow/react`,
   custom screen node with ports, edge label editing, delete via keyboard,
   auto-arrange button), `outline-list.tsx` (the mobile/list equivalent with
   "Goes to" rows), `screen-inspector.tsx`.
9. **`features/landing/components/`** — section stack with reorder (drag +
   keyboard), section inspector, live page preview built from `LayoutThumb`s.
10. **`features/prompt/components/`** — live prompt panel (blocks, char/word/token
    meter, warnings list, diff vs last generated, copy/download).
11. **`features/projects/`** — project switcher, new/duplicate/rename/delete with
    confirm, JSON import (zod-validated, refuses mismatched `schemaVersion` with
    a readable message), export, share link create/open (imported state is
    read-only until saved), version history with restore + diff preview.
12. **`features/stack/components/`** — stack picker with incompatibility
    warnings, structure preset picker showing the ASCII tree, conventions toggle
    list, profile save/load/export.
13. **`features/palette/`** — ⌘K command palette (cmdk), hotkeys via
    `react-hotkeys-hook`, `?` shortcuts overlay.
14. **`app/print/page.tsx`** — print-friendly prompt view.
15. **Starter templates** — ~6 project starters (SaaS dashboard, auth flow, admin
    CRUD, marketing site, checkout, settings) as `ProjectDoc` factories.
16. **Tests (`vitest`)** — engine block/target output, graph ordering +
    unreachable + cycles, `parse(serialize(doc)) ≡ doc` round-trip, messy-LLM
    parser fixtures (missing braces, unknown layout ids, undeclared screens,
    unicode arrows), share codec round-trip.
17. **Verify** — `pnpm typecheck`, `pnpm check`, `pnpm build`, then run it and
    smoke-test in a browser at 360 / 768 / 1280 / 1920 px, light **and** dark.

---

## 6. The `.flow` language (agreed grammar — implement exactly this)

```
app "Acme Admin" {
  target claude-code
  creativity 6
  theme { primary #2563eb; secondary #10b981; radius md; buttons filled }
}

screen login "Sign In" {
  template auth
  layout   auth-split
  note     "email + OTP, Google SSO"
}
screen dashboard "Dashboard" { template dashboard; layout dashboard-sidebar }

flow {
  login     -> dashboard : "on successful login"
  dashboard -> clients   : "click Clients in sidebar"
  clients   -> client_new: "click Add Client"
  client_new-> clients   : "on save"
}

landing { section hero layout hero-two-column; section features layout features-grid-3 }

stack {
  framework next-16
  styling   tailwind4-shadcn
  state     tanstack-zustand
  extras    axios, lucide
}
structure feature-based            # or: structure custom """ <ascii tree> """
conventions [kebab-files, barrel-exports, alias-@]
snippets [a11y, states]
profile "House rules"      # shorthand: expands stack + structure + conventions
requirements """
Multi-tenant, role-gated admin actions.
"""
```

**Tolerance rules (the whole point — LLM output is messy):**
- keywords case-insensitive; braces, semicolons and trailing commas optional
- `->`, `→`, `=>` all accepted; chains `a -> b -> c` allowed
- a screen referenced in `flow` but never declared is **auto-created** + warned
- an unknown `layout`/`template`/`convention` id is fuzzy-matched via
  `closestMatch()` and warned — never dropped silently; if no match, keep the raw
  string so user intent survives into the prompt
- every error and warning carries a line number; nothing is fatal if recoverable

**Parser output shape:** `{ doc: ProjectDoc, profile?: string, warnings: Issue[],
errors: Issue[] }` where `Issue = { line, column?, message }`. Screens get fresh
`uid()`s; `key` is the declared slug.

**Paste UX:** parse → preview before commit ("14 screens, 17 connections, 2
warnings — Replace / Merge / Cancel") → applied as **one undoable step** →
auto-arranged.

**Copy prompt for diagram syntax** (top-bar button): emits product explanation +
full grammar + **the complete valid id lists generated from the catalogues** +
hard rules (only these ids; every screen reachable; label every edge; output
nothing but one `flow` code block) + two worked examples (admin app, marketing
site).

---

## 7. Working agreements for whoever picks this up

- **User commits. Never run `git commit` / `git push`.** (This repo is not yet a
  git repo — leave `git init` to the user unless asked.)
- Laziest solution that actually works; reuse before writing; no speculative
  abstraction. But **never** cut: input validation at the import boundary, a11y
  basics, error handling, responsiveness — those were explicitly requested.
- Any markup used twice becomes a shared component. No hardcoded colours.
- No fixed `h-[calc(100vh-Npx)]`; use `dvh` + flex/grid.
- Prose style in chat: terse (caveman mode active in the origin session). Code
  and comments: normal English.
- Verify before claiming done: `pnpm typecheck && pnpm check && pnpm build`, then
  actually open the app.

## 8. First three moves for the next session

1. Fix the `tokenize.ts` heredoc placeholder bug (§4).
2. Write `app/globals.css` (tokens + `.wire-*`), `app/layout.tsx`,
   `app/providers.tsx`, and a throwaway `app/page.tsx` that renders a grid of
   every `allLayouts` thumbnail — then run `pnpm dev` and look at it. That
   validates the whole wireframe system before any of the workbench is built,
   and the thumbnails are the part the user explicitly wants to be beautiful.
3. Then follow §5 in order.
