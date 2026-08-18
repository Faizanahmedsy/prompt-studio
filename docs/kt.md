# Prompt Studio — knowledge transfer / resume prompt

Read this once and you can pick the project up cold. It describes what is
actually on disk and working, not a plan.

---

## 1. What this product is

An internal tool for turning a product idea, or an existing codebase, into a
**build prompt for a coding agent** — by way of an editable flow diagram.

The diagram is the interface; the prompt is the deliverable. Nothing here calls
an AI. The app is entirely frontend: everything lives in `localStorage`.

Three ways a diagram starts, one per prompt the app hands out:

1. **New flow from requirements** — paste the prompt into ChatGPT with a
   client's requirements; it writes a `.flow` file; paste that back.
2. **From an existing codebase** — run the prompt with Claude Code *inside* a
   repo; it reads the code and writes the real flow (frontend routes/components,
   or backend services/endpoints).
3. **Fragment to merge in** — the prompt embeds the current project's screen
   keys, so a model returns a piece that attaches to screens you already have.

Then: edit on the canvas → **Generate prompt** → paste into Claude Code.

---

## 2. Decisions already made (do not re-litigate)

- **Frontend only.** No server, no database, no auth. `localStorage` + share
  links (native `CompressionStream` gzip + base64url, no library).
- **Zod is the trust boundary.** Anything from storage, a `.json` import, a
  share link or a `.flow` paste is parsed through `types/project.ts` first. The
  store's `merge` re-parses on rehydrate — that is what stops a field added
  later from crashing an old saved project. Do not remove it.
- **`.flow` is hand-written and tolerant.** No parser generator. Unknown ids are
  fuzzy-matched and warned about, never dropped. `parseFlow(serializeFlow(doc))`
  must equal `doc` — there is a test per starter.
- **Two experience modes.** Easy hides the left rail and puts Design/Brief in a
  floating bar; Advanced adds stack, conventions, Flow source, diffs, versions.
- **The user owns git.** Never run `git commit` / `git push`.
- Never edit `../frontend` or `../backend` — separate repos, separate owners.

---

## 3. Domain model — `types/project.ts`

`SCHEMA_VERSION = 4`. Every field has a `.default()`, which is what makes an
older saved project load instead of failing.

```
ProjectDoc
  name, target, creativity
  views[]        { id, key, name, note }            // role perspectives
  screens[]      { id, key, title, template, layout, note, surface, views[], x, y }
  edges[]        { id, from, to, trigger, views[] } // screen → screen
  modules[]      { id, screenId, key, name, kind, trigger, note, order }
  moduleEdges[]  { id, from, to, trigger }          // module → module, one screen
  sections[]     { id, type, name, layout, note, order }   // landing page
  theme, conventions, requirements, snippetIds
  stack, structure                                 // the WEB surface's
  surfaces { mobile: {stack,structure}, backend: {…} }
```

**Modules are the "inside of a screen"** — a table, its filter bar, the modal it
opens. They are optional and hidden by default; a project with none looks and
behaves exactly as it did before they existed. Stored flat (not nested inside
`Screen`) so undo, merge and rehydrate stay simple.

Module `key` is unique **per screen**, not per project — two screens may each
own a `table`.

**Views are role perspectives over one graph**, not separate diagrams. The rule
everywhere (`features/builder/utils/views.ts`): **an empty `views` array means
every view**. Most screens in a real app are shared, and tagging each with all
five roles would go stale the moment a sixth appears — so tagging is how you say
"only these roles". The canvas filters at render; the project always holds the
whole app, so switching role can never lose anything and positions stay put.

**Surfaces are separate builds of one product** — web, mobile, backend. The
tabs switch between them; each has its own stack, folder structure and generated
prompt, and they share the theme, brief and role views. `stack`/`structure` stay
at the top level as the web surface's so older projects still mean what they
said. A `flow` arrow never crosses a surface — that is an integration, and it
belongs in a note. Mobile and backend arrive pre-seeded (Expo + NativeWind,
`src-layered` with the UI choices blank) because a Next.js default on the Mobile
tab is six dropdowns to correct before the tab is usable.

`addScreen` reads the active surface from the UI store rather than taking it
from each caller — six call sites add screens, and one forgetting would drop a
screen onto Web where the user cannot see it.

---

## 4. Layout of the code

```
app/                     shell, print route
components/
  layout/                top-bar, workbench, inspector, global-settings-bar
  ui/                    radix primitives
  shared/                form / layout / feedback helpers
features/
  builder/               canvas + actions + graph maths
    utils/actions.ts     EVERY project mutation lives here
    utils/graph.ts       analyseGraph (order, entries, cycles) + autoLayout
    utils/views.ts       inView / screensInView / edgesInView
    utils/surfaces.ts    stackFor / structureFor / countsBySurface
    utils/node-geometry.ts  card + well measurements
    components/          flow-canvas, screen-node, module-node, flow-edge,
                         view-switcher, screen-inspector, module-inspector,
                         outline-list
  flow-lang/             the .flow language
    tokenize / parser / serializer
    authoring-prompt.ts  prompt 1 — new flow from requirements
    reverse-prompt.ts    prompt 2 — read an existing repo
    fragment-prompt.ts   prompt 3 — a piece to merge in
    merge.ts             match-by-key graft of a fragment onto a project
  library/data/          templates, layouts, module-kinds, snippets, starters
  prompt/engine/         build-prompt.ts, targets.ts, diff.ts
  stack/data/            stack catalogue, structures, conventions, profiles
    platforms.ts         web / react-native / ios — derived from the framework
  theme/data/            design-languages.ts (8, each with a live preview)
stores/
  use-project-store.ts   persisted; undo/redo, versions, profiles
  use-ui-store.ts        view state — including which screens are expanded
```

**All catalogues are single-sourced.** The authoring prompts list valid ids by
mapping over the same arrays the parser validates against, so the language and
the app cannot drift.

---

## 5. How the pieces fit

**Editing.** Every mutation goes through `features/builder/utils/actions.ts`,
which calls `useProjectStore.update(mutate, opts)`. `opts.coalesce` collapses a
drag into one undo step.

**Canvas.** `flow-canvas.tsx` builds controlled `nodes`/`edges` from the project
each render. An expanded screen becomes an xyflow container (`style.width/height`
set from `expandedHeight()`), and its modules are child nodes (`parentId`,
`extent: "parent"`, `draggable: false` — their order is data, not position).
Module ports are top/bottom because they are a vertical stack; left/right made
every inner arrow loop outside the card.

Which screens are expanded lives in `use-ui-store`, is **not** persisted, and is
**not** in the project — expanding must not dirty undo, the diff or the prompt.

**Views.** `activeViewId` lives in `use-ui-store` (view state, not persisted).
The switcher sits in the canvas toolbar and only appears once a project defines
a view. `viewsBlock` in the prompt engine describes each role's own path and
what only they see.

**Platforms.** `platformOf(stack)` derives web / react-native / ios from the
chosen framework — never stored, so it cannot disagree with the stack. It swaps
the requirements baseline wholesale (safe areas, hardware back, offline,
permissions vs. responsive/keyboard/focus), adds a platform definition-of-done,
drops web-only conventions, and rewords `a11y-baseline` / `tokens-only`. Mobile
screens use the `mobile-*` layouts; `stackWarnings` flags a web-only library
picked for a native build (shadcn, Recharts, Playwright…).

**Prompt.** `build-prompt.ts` composes blocks; `targets.ts` decides order and
format (XML for Claude Code, markdown headings elsewhere). Modules are emitted
under their screen only when they exist. `houseRuleIds` are appended to the
conventions block unconditionally — git ownership, story docs, KT doc, component
reuse — plus `next-proxy` when the framework is Next.

**Merge.** `merge.ts` matches incoming screens by `key`, reuses the existing
screen's id, remaps the fragment's edges and modules onto it, dedupes, and only
ever fills blank fields. It is idempotent — merging the same fragment twice adds
nothing. This is what makes prompt 3 work; blind concatenation would produce a
second copy of every screen it touched.

---

## 6. The `.flow` language

```
app "Product" {
  target claude-code
  creativity 6
  theme { design modern-soft; primary #2563eb; radius md }
}

views {
  super_admin "Super Admin"
  admin       "Org Admin"
}

screen clients "Clients" {
  template table
  layout   table-advanced
  note     "server-driven paging"
  in [admin]                      # omit entirely = every role

  module filters   "Filter bar"   { kind filters; on "page load" }
  module table     "Client table" { kind table }
  module add_modal "Add client"   { kind modal; on "click Add Client" }

  inner {                         # movement with no route change
    filters   -> table     : "on filter change, refetch page 1"
    table     -> add_modal : "click Add Client"
    add_modal -> table     : "on save, close and refetch"
  }
}

flow {                            # movement between screens
  login -> clients : "on successful login"
  login -> orgs    : "as super admin" @super_admin   # role-specific transition
}

landing { section hero "Hero" layout hero-two-column }

stack { framework next-16; styling tailwind4-shadcn }
structure feature-based
conventions [kebab-files, alias-@]
snippets [a11y, states, tables]
requirements """free text"""
```

Braces and semicolons optional. `->` `=>` `→` all connect. `# ` starts a
comment (but `#2563eb` survives). `"""` fences multi-line text.

A fragment is the same grammar with the `app`/`stack`/`theme` blocks left out.

---

## 7. Tests

`pnpm vitest run` — 103 tests, 5 files:

- `flow-lang.test.ts` — round-trip per starter, parser tolerance, modules,
  per-screen key scoping, inner-vs-flow separation, views and `@role` tags.
- `merge.test.ts` — attach by key, edge rewiring, idempotence, no field clobber.
- `prompt-engine.test.ts` — graph maths, prompt blocks, modules, house rules.
- `share-codec.test.ts` — gzip round-trip, and a legacy-persisted-project suite.
- `prompts.test.ts` — every fenced example inside all three prompts is run
  through the real parser: zero errors AND zero fuzzy-match warnings, so a typo
  in an example cannot silently teach the model bad syntax.

Also: `npx tsc --noEmit` and `npx next build` both clean.

---

## 8. Working agreements

- The user commits. Never run `git commit` or `git push`.
- Add a mutation? It goes in `features/builder/utils/actions.ts`, nowhere else.
- Add a field to the schema? Give it a `.default()`, or you break every saved
  project on the next deploy.
- Add a catalogue entry (module kind, layout, convention)? It appears in the
  authoring prompts automatically. Do not hand-maintain a second list. When a
  real run of the reverse prompt invents an id, that is the signal the
  catalogue is short — `list` (template) and `calendar`/`map`/`timeline`
  (kinds) were all added that way.
- Connection labels are read by people. The reverse prompt has a table of
  bad-vs-good examples; keep it, it is what stopped output like
  `redirect() (app/(authenticated)/layout.tsx)` appearing on arrows.
- Update this file at the end of any session that changes the shape of the app.
