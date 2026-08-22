# Browser tests

Two things only a real browser can answer:

- **`signup-and-share.mjs`** — the app is behind the login, signing up opens the
  studio, the project reaches the database, and an address that has no account
  can be invited and finds the project waiting when it registers.
- **`collaboration.mjs`** — two browsers, two accounts, one project. One adds a
  screen; the other sees it; the database agrees.
- **`sign-out.mjs`** — signing out leaves nothing of that account on the
  machine, and actually reaches the server. Both halves were broken: the stores
  persist under fixed keys and outlived the session, so the next person to sign
  in on that browser opened the previous person's diagrams; and the tokens were
  cleared before the logout request, so it went out unauthenticated, 401'd, and
  the refresh token stayed mintable for a month.
- **`print-view.mjs`** — `/print` renders the prompt as prose: lists are lists,
  fences are code, no `**stars**` leak through, and a wide code block scrolls
  inside itself instead of making the page scroll sideways.
- **`offline.mjs`** — the editor keeps working when the API does not. Blocks the
  API at the browser level (so nothing else on the machine is disturbed), then
  checks the studio still loads, still edits, still undoes, still persists across
  a reload, and says it is offline rather than pretending. This one found a real
  bug: an unreachable API used to bounce a signed-in person to `/login` and put
  their local work out of reach.

They drive headless Chrome over the DevTools Protocol using Node's built-in
`WebSocket`. **No dependencies at all** — no Playwright, no Puppeteer, nothing
in `package.json`. `cdp.mjs` is the whole driver, about 120 lines.

## Running them

They need three things up: the API, the Next app, and Chrome.

```bash
# terminal 1 — the API (see ../../prompt-studio-backend)
cd ../prompt-studio-backend && docker compose up -d db redis && uv run uvicorn app.main:app --port 8010

# terminal 2 — the app
pnpm dev -p 3002

# terminal 3
node tests/browser/signup-and-share.mjs
node tests/browser/collaboration.mjs
node tests/browser/sign-out.mjs
node tests/browser/print-view.mjs
node tests/browser/offline.mjs
```

Override with `APP=http://localhost:3000 API=http://127.0.0.1:8010`.

## What to know before you edit them

- **They write real rows.** Every run registers two accounts and creates
  projects. Point them at a throwaway environment.
- **The API rate-limits registration per IP** (10/hour by default). A dev `.env`
  that keeps the production numbers will throttle the second or third run, and
  the failure reads as "Too many accounts created from here" — which is the
  limiter working, not a broken test.
- **`waitFor` takes an expression, not statements.** It wraps the argument in
  `Boolean(...)`. Anything with a `const` or a `return` needs `evaluate` in a
  poll loop — `waitForCount` in `collaboration.mjs` is the pattern.
- **Radix opens on `pointerdown`, not `click`.** A bare `.click()` on a
  dropdown trigger does nothing; dispatch the pointer sequence.
- **Radix popovers are not menus.** The template picker is plain buttons inside
  `[data-radix-popper-content-wrapper]`, with no `role="menuitem"`.
- **Chrome is found, not hardcoded.** `cdp.mjs` checks the usual paths and
  honours `CHROME_PATH`.
- **Switching the active project is done through localStorage**, not the project
  menu. The menu is not what those tests are about, and driving it would make
  them fail for reasons unrelated to collaboration.
