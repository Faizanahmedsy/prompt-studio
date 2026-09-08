# Prompt Studio

Internal tool. A **visual editor for frontend build prompts** — draw the app's
screens and how a user moves between them, choose the stack and conventions, and
generate a complete build prompt for Claude Code, v0, Cursor or Lovable.

The editor is local-first — every change lands in the browser and a project
still travels as a file or a link. Behind that it now signs in against
[`../prompt-studio-backend`](../prompt-studio-backend), keeps projects in a
database, and lets several people edit the same diagram at once. With the API
down it degrades to exactly what it was before: a browser-only tool.

```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # vitest — parser, engine, graph, share codec
pnpm test:browser   # headless Chrome: sign-up, sharing, a live edit across two browsers
pnpm typecheck
pnpm build
```

Sign-in needs the API running — see [Accounts and collaboration](#accounts-and-collaboration).

> **Picking this up cold?** Read [`docs/kt.md`](docs/kt.md) — the full
> knowledge transfer: architecture, routes, the traps, what is half-done, and
> the working agreements.

## The loop it is built for

1. **Copy prompt for diagram syntax** → paste into ChatGPT with the client's
   requirements.
2. ChatGPT answers with a `.flow` file — a small language describing screens,
   layouts, navigation and stack.
3. **Paste Flow** back here → the diagram appears, editable, with warnings for
   anything the model got wrong.
4. **Generate prompt** → the full build prompt, copied and saved as a version.

## What's in it

- **Flow canvas** — drag screens, drag port-to-port to connect them, label each
  transition ("on submit", "click Add Client"), auto-arrange. On phones the same
  graph is an editable outline list. Two ways to read it: the **whole app**, and
  **one journey at a time**.
- **User journeys** — screens are tagged into named journeys ("Authentication",
  "Invite a user", "Checkout"). A second axis, independent of role views: a
  screen has one role set and belongs to several journeys at once.
- **User stories** — every screen and every journey carries *as a… / I want… /
  so that…* plus acceptance criteria. Normally written by the model as it
  generates the diagram, and corrected here; the generated build prompt carries
  them and asks the agent to write one for anything still blank.
- **Landing builder** — stack marketing sections in order with live preview.
- **Layout library** — 60+ layouts, each with a wireframe thumbnail rendered from
  a small declarative DSL, tinted with the project's own primary colour.
- **Design tab** — nine design languages including **Basic**, which tells the
  agent not to design at all; typeface character, type scale, icon style,
  elevation, motion and theme settings; and an **Import from Figma** prompt that
  hands Claude Code your screenshots and gets back a finished stylesheet written
  against this project's own token names.
- **Stack profiles** — technology, folder structure and conventions saved
  together and reusable across projects. Ships a "House rules"
  profile.
- **Prompt panel** — live preview, char/word/token meter, warnings, diff against
  the last generated version.
- **Projects** — many projects, autosaved; JSON import/export; gzip share links;
  version history with restore; eight starter templates, each grouped into
  journeys with stories.
- **Keyboard** — ⌘K palette, undo/redo, single-key shortcuts, `?` for the list.
- Dark mode, responsive to 360px, print view at `/print`.

## Layout

```
app/              routes (workbench, print) + globals.css
components/       ui/ primitives, shared/ reuse layer, layout/ shell, icons/
features/         builder landing library flow-lang prompt projects stack theme palette
stores/           zustand (projects + undo/redo, ui)
lib/  types/      utils, share codec, zod schemas
tests/            vitest
docs/kt.md        full context and design decisions
```

Conventions follow `../frontend/CLAUDE.md`: kebab-case files, one barrel per
feature, no cross-feature deep imports, `@/` alias, shared components before new
markup, tokens instead of hardcoded colour.

---

## Accounts and collaboration

Prompt Studio now sits behind a login and keeps your projects in a database, so
they follow you between machines and can be shared with other people.

The backend is a separate repository: [`../prompt-studio-backend`](../prompt-studio-backend).
Start it first — the app needs it to sign in.

```bash
cd ../prompt-studio-backend
docker compose up -d          # Postgres, Redis and the API on :8010
```

Then point the app at it:

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8010   # ORIGIN ONLY — the client appends /api/v1
NEXT_PUBLIC_WS_URL=ws://localhost:8010
```

### How it fits together

The editor stays **local-first**. Every change lands in the Zustand store and
`localStorage` exactly as it did before, so undo, the canvas and the prompt
engine are unchanged and the app keeps working with the API down. On top of that:

- `features/cloud/use-project-sync.ts` pulls everything the account can see on
  sign-in, uploads anything local the server has not got, and pushes document
  changes over HTTP, debounced.
- `features/cloud/use-live-project.ts` holds one websocket — for the project on
  screen — so another person's edits arrive as they happen. The server never
  echoes your own save back to you, which is what makes it safe to apply every
  incoming document straight into the store.
- `stores/use-sync-store.ts` remembers which local project is which server row.
  Deliberately *not* a field on `Project`: a server id is not part of the
  document, and would end up in every `.json` export and share link.

### Sharing

Press **Share** and add an email address. The address does not need an account —
the invitation waits, and is claimed the moment someone registers with it. Only
the addresses on a project can open it; that is true of platform administrators
too.

### Tests

`pnpm test` is the unit suite. `pnpm test:browser` drives two headless Chrome
instances through sign-up, sharing, and a live edit crossing from one browser to
the other — see [`tests/browser/README.md`](tests/browser/README.md). It needs
the API and the app running, and it writes real rows.
