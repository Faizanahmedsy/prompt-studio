# Prompt Studio — knowledge transfer

Read this once and you can pick the project up cold. It describes what is on
disk and working, not a plan. Where something is half-done or known-broken it
says so, because the alternative is you finding out at the worst moment.

Last verified: 8 September 2026, against `sprint-2` at `2753276` plus the
uncommitted work described in §14.

---

## 1. What this is

An internal tool that turns a product idea — or an existing codebase — into a
**build prompt for a coding agent**, by way of an editable flow diagram.

The diagram is the interface. The prompt is the deliverable. **Nothing in this
app calls an AI.** It composes text. That is the single most important thing to
understand before changing anything: every "generate" button in this product is
a pure function from a document to a string.

The loop it is built for:

1. Copy the **authoring prompt** → paste into any assistant with a client's
   requirements → it answers with a `.flow` file.
2. **Paste Flow** back here → the diagram appears, editable, with warnings for
   anything the model got wrong.
3. Edit on the canvas: screens, journeys, stories, data model, stack, design.
4. **Generate prompt** → one build prompt per surface → paste into Claude Code,
   Cursor, v0, Lovable.

There is a second, newer product inside the same app: a **public prompt
library** of hand-written prompts that have nothing to do with any project
(§10). It needs no account.

---

## 2. The three repositories

| Path | What it is |
|---|---|
| `prompt-studio` | This repo. Next.js 16 frontend. The whole product surface. |
| `prompt-studio-backend` | FastAPI + Postgres. Accounts, projects, sharing, live collaboration. Its own `docs/kt.md`. |
| `prompt-studio-mcp` | MCP server exposing the studio to a coding agent. Contains a **vendored copy** of this repo's engine under `src/studio/`. |

There is also a stale second MCP server at `prompt-studio/mcp/` in this repo.
It predates `prompt-studio-mcp` and nothing uses it. Do not develop against it;
deleting it is a good small task nobody has done.

**The vendoring trap.** `prompt-studio-mcp/scripts/sync-studio.mjs ../prompt-studio`
copies ~50 files out of this repo into the MCP's `src/studio/`. If you change
the prompt engine, the flow language, the layout catalogue or `types/project.ts`
and do not re-run it, the MCP server keeps writing documents against last
sprint's schema and **silently strips fields it does not know about**. That has
happened once and cost eleven design fields on every MCP write.
`prompt-studio-mcp/tests/vendor.test.ts` is the guard.

---

## 3. Running it

`pnpm` is broken on this machine. **Use `npx`.**

```bash
npx next dev                 # http://localhost:3000
npx vitest run               # 36 files, 1078 tests, ~3s
npx tsc --noEmit             # must be clean
npx biome check --write .    # lint + format + import order
npx next build               # must be clean before you push
```

The backend must be running for sign-in. From `../prompt-studio-backend`:

```bash
docker compose up -d db redis api
```

Ports on this machine, all deliberately non-default because other stacks own
the usual ones:

| Port | What |
|---|---|
| 3000 | `next dev` |
| 3002 | `next start`, used by the browser tests |
| 8010 | the API |
| 5442 | Postgres |
| 6382 | Redis |

Frontend env: `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`. Both are inlined
at build time by Next, so a Vercel build that ships without them **looks
deployed and is not** — the app silently falls back to localhost.

---

## 4. Routes

Changed recently (§14). The public web and the app are now separate.

| Route | Auth | What |
|---|---|---|
| `/` | public | Landing page. `features/marketing/components/landing-page.tsx`. |
| `/prompts` | public | The prompt library. Needs no account and no project. |
| `/[...view]` | **behind `AuthGate`** | The studio, one path per tab: `/web`, `/mobile`, `/backend`, `/landing`, `/data`, `/code`, `/design`. |
| `/login` `/register` `/forgot-password` `/reset-password` `/set-password` `/verify-email` | public | Auth. |
| `/print` | behind auth | The generated prompt as printable prose. |
| `/v/[token]` | public | A read-only published project. |

`lib/view-url.ts` owns the mapping. Two things live there:

- `VIEW_SLUGS` — `WorkMode` → path segment. The tab is called `theme`
  internally and `design` in the URL; that is deliberate, nobody in the product
  says "theme".
- `STUDIO_HOME = "/web"` — where a signed-in person goes. **Every post-auth
  redirect must use this**, not `"/"`, because `/` is marketing now. Getting
  this wrong sends someone who just signed in to a page inviting them to sign
  up.

The catch-all is `[...view]` (required), not `[[...view]]` (optional), so `/`
is free for `app/page.tsx`. The route validates its segment and calls
`notFound()` — without that, every unknown path would render the whole app and
answer 200, so nothing on the site could ever 404.

`components/layout/use-view-url.ts` keeps the URL and the store in step. It
reads **once on mount** and writes with `history.replaceState`. Do not make it
read continuously: every tab click writes the URL, and a watcher would read
its own write back as an instruction. Do not switch it to `router.replace`
either — that remounts the workbench and drops the canvas viewport.

---

## 5. State

Four Zustand stores, all persisted to `localStorage` with `skipHydration`, all
rehydrated in `app/providers.tsx` after mount so the server and first client
render match.

| Store | Key | Holds |
|---|---|---|
| `use-project-store` | `ps:v1` | Every project document. The undo/redo stack. |
| `use-ui-store` | `ps:ui` | Current tab, panel open/closed, selection, experience level. |
| `use-sync-store` | `ps:sync` | local project id → server row id, and last-synced times. |
| `use-prompt-draft-store` | — | Hand-edits to a generated prompt, so a rewritten paragraph survives F5. |

`use-auth-store` is **not persisted, on purpose**. Tokens live in
`lib/api/token-store.ts`; the user object is re-derived from the server by
`bootstrap()` on every page load. A cached user object outliving the account it
described is a bug you cannot see.

**Every write to a project goes through `useProjectStore.update`.** That is
where the read-only guard lives — the one that stops a public viewer editing a
stranger's project. Nothing calls `setState` on the project store directly.

---

## 6. The document — `types/project.ts`

Zod is the trust boundary. Anything arriving from storage, a `.json` import, a
share link, a `.flow` paste, the API or the websocket is parsed through
`projectDocSchema` first. The store's `merge` re-parses on rehydrate, which is
what stops a field added this sprint from crashing a project saved last sprint.
**Do not remove it.**

Shape, roughly:

- `screens[]` — key, title, template, layout, `surface` (`web` | `mobile` |
  `backend`), `views[]` (roles), `flows[]` (journeys), `story`.
- `modules[]` — things inside a screen, with their own edges.
- `edges[]` / `moduleEdges[]` — transitions, each with a trigger label.
- `views[]` — who can reach a screen. A role.
- `flows[]` — a named user journey. Orthogonal to views: a screen has one role
  set and belongs to several journeys.
- `entities[]` — the data model, shared by every surface.
- `landing` — marketing sections.
- `stack`, `conventions`, `structure`, `boilerplate`, `deployment`.
- `theme` — see §9.
- `builds` — which of web / mobile / landing / backend this product ships.

Surfaces are separate builds of one product. `buildPrompt(doc, {surface})`
narrows the document to one surface and generates one prompt. A prompt covering
all three would describe an app nobody is writing.

---

## 7. The prompt engine — `features/prompt/engine/`

Pure functions, heavily tested, no I/O.

| File | Job |
|---|---|
| `build-prompt.ts` | The whole thing. Block ids, per-target ordering, assembly. |
| `design-brief.ts` | The "let the agent decide" block, when `theme.designMode === "auto"`. |
| `tokens-block.ts` | The CSS custom properties, when the design is chosen here. |
| `ui-conventions.ts` | Craft rules and the banned-signature list. |
| `screen-prompt.ts` | One screen, for a focused follow-up. |
| `data-model.ts`, `security.ts`, `deployment.ts`, `boilerplate.ts`, `monorepo.ts`, `diff.ts` | The named sections. |
| `targets.ts` | Per-target block order — claude-code, v0, cursor, lovable, generic. |

Two rules that were learned the hard way:

- **Blocks whose body is empty are dropped**, not rendered as a heading with
  nothing under it. `list()` filters empty entries.
- **The design block derives from the resolved theme**, never from the legacy
  option fields. There was a period when the prompt contained two design
  systems arguing: legacy fields the editor no longer wrote, sitting directly
  above a stylesheet that said otherwise.

`navigationBlock` names the entry screen and then tells the agent what belongs
on it — that its own content is the first and largest thing on the page, not a
welcome panel or a grid of tiles. That rule exists because a bucket-list app
came back with a metric dashboard for a home screen.

---

## 8. The `.flow` language — `features/flow-lang/`

Hand-written tokenizer → parser → serializer → merge. No parser generator.

- Unknown ids are **fuzzy-matched and warned about, never dropped**.
- `parseFlow(serializeFlow(doc))` must equal `doc`. There is a test per starter.
- Four prompts are generated from the same catalogues the app uses, so the list
  of valid ids can never drift from the code:
  - `authoring-prompt.ts` — requirements → a whole `.flow` file.
  - `fragment-prompt.ts` — a feature to merge into an existing project.
  - `reverse-prompt.ts` — run inside a repo; *reports* the flow that is there.
  - `theme/design-prompt.ts` — design only, no flow.

`authoring-prompt.ts` opens by making the model decide **who opens the product
and what single thing they came to do**, before any rule about screens, and
closes with a self-check on the entry screen. That section is load-bearing;
without it the model reaches for `dashboard-cards` for everything.

---

## 9. Design — `features/theme/`

- `data/presets.ts` — 25 presets. **Every light-mode preset has a white ground**
  (`background` 0.99, `card` 1.0, chroma ≤ 0.003). A tinted light ground was a
  bug, not a style.
- `tokens/resolve.ts` — the resolver. `applyBrand()` derives primary / ring /
  chart / sidebar from one colour and picks a readable label with APCA.
  `readableFill()` walks lightness until the label clears `LC_FLOORS.body`.
  There is a legacy fallback layer with precedence: modern field moved →
  legacy field moved → preset → default.
- Dials apply **only when they deviate from the schema default**. A vividness
  default of 60 against a preset's 58 silently re-chromatised every preset once.
- `color/apca.ts` — APCA-W3 contrast. Body floor Lc 75, secondary 60. Avoid the
  dead zone L 0.68–0.76.
- Presets must stay **inside sRGB**. Three shipped outside it and had to be
  pulled back (brass, orange, teal).
- `components/theme-forge.tsx` — the full-page design editor. This is the *only*
  place design is edited. A second editor once existed in the inspector and the
  floating bar, writing an overlapping set of fields, which is how a project
  ended up describing one design in its prompt and rendering another in its
  preview.

`theme.designMode` is `"preset"` or `"auto"`. In `auto` the right-hand pane
shows **the brief the agent will get**, read straight out of `designBriefBlock`
rather than restated, so the two cannot drift.

---

## 10. The prompt library — `features/prompt-library/`

Public, project-free, hand-written prompts. Ten of them across Design, Build,
Debug, Review and Plan.

| File | Holds |
|---|---|
| `data/master-design-prompt.ts` | The master design brief. ~35KB of prompt. |
| `data/design-prompts.ts` | Master, critique, entry-screen. |
| `data/work-prompts.ts` | Debug, review, spec, codebase, tests, refactor, decide. |
| `data/prompts.ts` | The index, the category order, and `searchPrompts`. |
| `components/prompt-library.tsx` | Master/detail reader. Renders markdown; **copies the raw source**. |

The master design brief has a history worth knowing, because it is the same
mistake twice:

1. It began as three prompts each describing one look, with no way to choose
   between them. A school website came back built as a telemetry console —
   monospaced navigation, a live attendance counter in the hero. Fixed by
   forcing a classification and a named direction (Part 0) and offering eight
   directions with the signals that rule each in *and out* (Part 2).
2. Monospace was described as "the most useful signal you have", with six
   permitted roles, no cap and no never-list. The model maximised it. Now it is
   **off by default**, allowed in three of eight directions, two roles maximum,
   with a never-list and a five-percent word count checked in the audit.

The lesson generalises: **any treatment asserted as universal will be applied
universally.** Part 4 (illustration) was written with that in mind and says
explicitly which directions take it and which take none.

---

## 11. Cloud and collaboration — `features/cloud/`, `features/collab/`

The editor is local-first. With the API down it degrades to exactly what it was
before the backend existed: a browser-only tool. Do not break that.

- `use-project-sync.ts` — everything the account can see, over HTTP.
- `use-live-project.ts` — the one project on screen, over a websocket.
- `use-collaboration.ts` — the socket itself. `flushDoc` sends
  `base_version: pendingBaseRef.current ?? docVersionRef.current ?? null`.

Two writers existed for one document — the socket and the debounced HTTP push
— and they raced, so a person dragging a node was told "someone else saved a
newer version" every few seconds. The someone else was their own other code
path. If you touch either writer, re-run `tests/browser/solo-editing.mjs`.

`presence-stack.tsx` — the sync badge's label precedence is **linked first**
(Offline / Connecting…), *then* signed-in, then "On this device". It used to
check signed-in first and reported "On this device" while genuinely offline,
because `/users/me` fails offline.

`prompt-studio-backend/docs/frontend/collab/use-collaboration.ts` is a **copy**
of the collab client kept in the backend repo, and `test_client_drift.py` fails
if the two diverge. If you edit the hook, sync that file (its imports differ:
`@/lib/api/` → `../api/`).

---

## 12. Tests

**Never use Playwright.** The user has said so twice. Browser tests are a
hand-rolled Chrome DevTools Protocol harness in `tests/browser/cdp.mjs`.

- **36 unit files, 1078 tests.** `npx vitest run`, ~3 seconds.
- **18 browser scripts.** `tests/browser/README.md` says what each one proves.
  Run one at a time: `node tests/browser/<name>.mjs`.

Browser-harness lore, all of it earned:

- `node.click()` does not trigger some controls. Dispatch a real
  `Input.dispatchMouseEvent` at the element's centre.
- `navigator.clipboard.readText` throws "Document is not focused" in a headless
  tab. Wrap `writeText` and read a global instead.
- Toasts sit above the controls and eat clicks. **Wait for them to disappear.**
  Removing them from the DOM throws — they belong to React, and the next render
  fails with `insertBefore`.
- Headings render uppercase via CSS, so `innerText` assertions must be
  case-insensitive.
- A stale `next start` on 3002 serves an old bundle and produces phantom
  failures. `fuser -k 3002/tcp` before restarting.
- Two "Copy prompt" buttons can exist on one screen (the top bar's and the
  library's). Click by `aria-label`.

---

## 13. Shipping

Branches: **`sprint-2` → `develop` → `main`.** All three are kept identical;
`main` is what deploys. `sprint-1` is a frozen v1.

```bash
git push origin sprint-2
git push origin sprint-2:develop
git push origin sprint-2:main
```

Refspec pushes rather than checkout-and-merge — the checkout is sometimes
blocked by the tool sandbox, and the result is the same fast-forward.

**Commit authorship matters.** Author as `faizanahmed.s@devstree.in` or Vercel's
Hobby plan blocks the deploy as an unrecognised committer.

**The Vercel CLI on this machine is signed into the wrong account**
(`faizanahmedsys-projects`). It lists a different, older project. Do not trust
it to tell you whether a deploy landed. The Vercel MCP connector is the right
tool and currently needs re-authorising — `/mcp` in an interactive session.

**Render** deploys the API. `render.yaml` says `branch: main`, but the service
was hand-created and therefore ignores the blueprint; the dashboard still has
it on `feat/backend`. Someone must change it in **Settings → Build & Deploy →
Branch**. Until then a finished sprint deploys nothing and the repo gives no
clue why.

---

## 14. State right now — read this before you start

**There is uncommitted work in the tree.** `git status` will show it. It is
finished and verified, not half-done:

- `/` became the public landing page; the studio moved to `/[...view]`.
- `/prompts` became a public route; the in-app Prompts tab was removed.
- `STUDIO_HOME` introduced and every post-auth redirect repointed.
- 14 browser tests updated from `${APP}/` to `${APP}/web`.
- Part 4 (illustration) added to the master design prompt.

Verified: 1078 unit tests, 33/33 in `tests/browser/prompt-library.mjs`,
typecheck, Biome, `next build`.

**`tests/browser/signup-and-share.mjs` cannot complete on this machine.** It
reads the invite link out of `docker logs prompt-studio-api`, and that
container's log stream is frozen at 7 Sep 14:24 while the API serves requests
normally. It is a container logging problem, not a product problem — the API
calls inside the same test succeed. Restart the container and it should pass.

### The master design brief — how it got here, and the loop that shaped it

The user runs this loop, and it is how every design-prompt change happens:

> 1. I give them a prompt. 2. They run it through an LLM. 3. They check the
> output. 4. They list what is wrong with the UI. 5. I find the line in our
> prompt responsible. 6. I brainstorm the fix. 7. I fix it. 8. They check
> locally. 9. **Only after they approve do I push.**

Three rounds have run. Each is recorded in the header comment of
`features/prompt-library/data/master-design-prompt.ts`, and the current brief
is the accumulated result: a scene-first Part 0 with a Decision Record emitted
as a code comment (because build-first products have no chat), a three-tier
stack with control specs and keyless-map rules, a token system read out of
the IntelliWealth and FieldTrack frontends with real numbers, nine directions
including a rebuilt D and a new I, a maps component spec, and a forty-item
never-list whose first five are the things that actually shipped.

**When the next round comes back**, ask for the `DIRECTION` and `AUDIT` lines
from the record before anything else. If the model did not emit a record, that
is itself the first finding.

**Where the numbers came from.** `../frontend/app/globals.css` and
`/home/faizan/devstree_projects/field-track-nextjs/FrontendNew/src/index.css`
share one design system, and its authors wrote the reason beside every value.
`components/shared/display/surface.ts` in the IntelliWealth repo is the single
best page of design reasoning in either codebase — the card recipe, the
stack-owns-the-gap rule, and `[&>*]:min-w-0` — and is worth reading before
touching Part 2.

Open items from the last brainstorm, deliberately not done:

- A ~6KB **compact variant** for products with small prompt fields. Wait until
  the master is stable across one more round.
- A **re-pick snippet** — a short prompt to paste when the direction came out
  wrong, so 54KB is not re-sent.

---

## 15. Working agreements

- **Never commit or push unless asked.** The user commits their own work. The
  exception is this repo and the other two prompt-studio repos, where they do
  ask for commit / push / deploy — but wait to be asked.
- **Never edit `../backend`.** Different team, different product.
- **Never Playwright.**
- Match the surrounding code: comments explain *why*, in prose, and often name
  the bug that made the line necessary. Read a neighbouring file before writing
  a new one.
- Run `npx tsc --noEmit`, `npx vitest run`, `npx biome check` and `npx next
  build` before claiming anything is done. Report failures with the output.

---

## 16. Known issues nobody has fixed

Reported, acknowledged, not scheduled:

- HTTP saves and version restores do not notify open sockets.
- `restore_version` takes no `base_version`.
- `X-Forwarded-For` trusts the first hop.
- `/auth/register` enumerates accounts.
- A platform ADMIN can reset a member's password and impersonate them.
- Redis presence can ghost — the TTL is key-level.
- The COMMENTER role exists with no comment UI.
- MCP `build_prompt` requires `project_id` though its description says
  "linked"; `sync_status` returns `""` for an unknown id; `VERSION` is
  hardcoded `"1.0.0"`.
- The stale MCP server at `prompt-studio/mcp/`.
- Version-history delete is local-only.
