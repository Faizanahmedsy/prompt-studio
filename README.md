# Prompt Studio

Internal tool. A **visual editor for frontend build prompts** — draw the app's
screens and how a user moves between them, choose the stack and conventions, and
generate a complete build prompt for Claude Code, v0, Cursor or Lovable.

Frontend only: no backend, no accounts, no network calls. Everything lives in
the browser and travels as a file or a link.

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm test       # vitest — parser, engine, graph, share codec
pnpm typecheck
pnpm build
```

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
  graph is an editable outline list.
- **Landing builder** — stack marketing sections in order with live preview.
- **Layout library** — 60+ layouts, each with a wireframe thumbnail rendered from
  a small declarative DSL, tinted with the project's own primary colour.
- **Stack profiles** — technology, folder structure and conventions saved
  together and reusable across projects. Ships an "IntelliWealth house rules"
  profile.
- **Prompt panel** — live preview, char/word/token meter, warnings, diff against
  the last generated version.
- **Projects** — many projects, autosaved; JSON import/export; gzip share links;
  version history with restore; six starter templates.
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
