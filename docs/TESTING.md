# Testing this by hand

A walkthrough of everything built, in the order that makes sense to try it.
Each section says **what to do**, **what should happen**, and — where it
matters — **why it was built that way**, so a surprise reads as a bug rather
than a mystery.

## What is running

| | Where | |
| --- | --- | --- |
| App | <http://localhost:3000> | Next.js |
| API | <http://localhost:8010> | FastAPI |
| **Admin panel** | <http://localhost:8010/admin> | served by the API |
| API docs | <http://localhost:8010/docs> · <http://localhost:8010/scalar> | Swagger / Scalar |
| Postgres | `127.0.0.1:5442` | `intelliwealth` / `root`, db `prompt_studio` |
| Redis | `127.0.0.1:6382` | password `root` |

**Superadmin:** `faizan@promptstudio.app` / `superadmin@2026`

### Two things to know first

**Email goes to the log, not to an inbox.** `EMAIL_TRANSPORT=console`, so
invitations, reset links and issued passwords are printed by the API. Keep this
open in a terminal:

```bash
cd ../prompt-studio-backend && docker compose logs -f api
```

Outside production `POST /auth/forgot-password` also returns the reset token in
the response body, so you never have to dig for it.

**Use a real-looking domain.** `@example.com` is fine; `@something.local` is
rejected — `.local` is reserved for mDNS and the email validator refuses it.
That bit me while building the seed.

---

# 1 · The app is behind the login

**Do:** open <http://localhost:3000> in a fresh window (or a private one).

**Expect:** a brief "Signing you in…", then a redirect to `/login`. You cannot
reach the editor signed out.

> The redirect is a convenience, not the boundary. The boundary is the API,
> which refuses every request without a token. Turning JavaScript off gets you
> an empty shell and no data, not a way in.

**Also try:** `/print`, `/register`, `/forgot-password` — the auth screens
render signed out; the studio does not.

---

# 2 · Sign up

**Do:** *Create one* → name, an `@example.com` address, a password.

**Expect:** the studio opens immediately — no second login form. Within a
second or two the toolbar shows a small cloud icon and **Synced**.

**Try the password rules** (all rejected, with the reason under the field):

| Input | Why |
| --- | --- |
| `short1` | under 8 characters |
| `alllettersnodigits` | no digit |
| `12345678` | no letter |
| 100 `x`s | over bcrypt's real 72-**byte** limit — beyond that it silently truncates, so two different long passwords would verify against each other |

**Try a duplicate address:** register the same email twice → *"An account with
that email already exists"*.

**Check it reached the database:**

```bash
PGPASSWORD=root psql -h 127.0.0.1 -p 5442 -U intelliwealth -d prompt_studio \
  -c "select email, role, created_at from users order by created_at desc limit 3"
```

---

# 3 · The project is really in Postgres

**Do:** draw something — *Add screen*, pick a template, drag it, connect two
screens.

**Expect:** the **Synced** badge stays. Saves are debounced, so give it a second.

**Verify:**

```bash
PGPASSWORD=root psql -h 127.0.0.1 -p 5442 -U intelliwealth -d prompt_studio \
  -c "select name, screen_count, module_count, doc_version from projects order by updated_at desc limit 3"
```

`screen_count` should match what is on your canvas, and `doc_version` should
climb as you edit.

**Then:** hard-refresh. The canvas comes back. Now open the same URL in a
**different browser profile** and sign in with the same account — your project
is there too. That is the whole point of v2: it followed the account, not the
browser.

---

# 4 · Sharing by email — including an address with no account

This is the feature the product is built around, so it is worth doing slowly.

**Do:** press **Share** (the icon in the toolbar) → type an address nobody has
registered, e.g. `colleague@example.com` → **Editor** → *Add*.

**Expect:** the row appears as **Invited**, with a mail icon. In the API log you
will see the invitation printed, with a link.

> The address does not need an account. Storing only a user id would mean an
> invitation could not be written until the invitee signed up — which inverts
> the whole flow, because the person inviting knows an email address and
> nothing else.

**Now claim it:** open a private window → `/register` → sign up **with that
exact address**.

**Expect:** the studio opens and the shared project is already there — the
invitation was claimed at registration. A toast says how many projects loaded.

**Try the case-insensitivity:** invite `Mixed.Case@Example.com`, register as
`mixed.case@example.com`. Still works — addresses are normalised on the way in,
or an invitation would strand on a capital letter.

**Try inviting twice:** *"That email is already on this project"*.

---

# 5 · Live collaboration — the headline

You need **two browsers** (or one normal + one private window), each signed in
as a **different** account, both on the **same** project.

**Set up:** from account A, share the project with account B as **Editor**.
Sign in as B in the second window and open that project.

**Expect, in this order:**

1. Each window shows a coloured avatar for the other in the toolbar. The
   colour is derived from the address, so the same person is the same colour
   everywhere.
2. **A adds a screen → it appears in B's canvas within a moment.** No refresh.
3. B moves a node → A sees it move.
4. Close B's window → B's avatar disappears from A's toolbar.

**Check the server agrees:**

```bash
PGPASSWORD=root psql -h 127.0.0.1 -p 5442 -U intelliwealth -d prompt_studio \
  -c "select name, screen_count, doc_version from projects order by updated_at desc limit 1"
```

> Concurrency is last-write-wins guarded by a version number, not a CRDT. The
> editor holds one document and rewrites it whole, so there are no
> character-level operations to transform — a CRDT would mean reshaping the
> client's entire state model to earn a guarantee this product does not need.

## 5b · A conflict

**Do:** in B's window, open DevTools → Network → **Offline**. Edit something in
B. Now edit something *different* in A. Put B back **Online**.

**Expect:** B reloads to the server's version and a toast says so. B's own
unpushed edit is not silently thrown away — check the **versions** dialog and
you will find a *"Before sync"* snapshot holding it.

> That snapshot exists because the reconnect path replaces the document
> silently and skips the undo stack. Without it, a day's offline work vanished
> with no trace and no Ctrl+Z. An audit found that; now it is recoverable.

---

# 6 · Roles on a project

From account A's **Share** dialog, change B's role and watch what B can do.

| Role | Read | Comment | Save | Invite / delete |
| --- | :-: | :-: | :-: | :-: |
| Viewer | ✓ | | | |
| Commenter | ✓ | ✓ | | |
| Editor | ✓ | ✓ | ✓ | |
| Owner | ✓ | ✓ | ✓ | ✓ |

**Demote B to Viewer while B has the project open.**

**Expect:** B's socket closes — their editor stops receiving updates. This is
deliberate and was a real bug: membership is resolved once, at the handshake,
so nothing used to reach a connection that was already open, and a *removed*
member kept receiving the whole document while the REST API correctly answered
404.

**Promote B back to Editor while they watch.** Their next edit saves — no
reconnect needed.

**Remove B entirely.** Their window loses access; refreshing shows the project
is gone from their list.

---

# 7 · The rule: nobody else can see it

**Do:** register a third account, C, that has **not** been added to anything.

**Expect:** C's project list is empty. C cannot open the project even with the
id — try it directly:

```bash
# get C's token from the browser: localStorage["prompt-studio.access_token"]
curl -s http://127.0.0.1:8010/api/v1/projects/<PROJECT_ID> \
  -H "Authorization: Bearer <C_TOKEN>" | head -c 200
```

**Expect `404`, not `403`.** Answering "forbidden" would confirm a project with
that id exists, which is a fact only its members are entitled to.

**Now the important one — the superadmin cannot read it either:**

```bash
TOKEN=$(curl -s -X POST http://127.0.0.1:8010/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"faizan@promptstudio.app","password":"superadmin@2026"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

curl -s http://127.0.0.1:8010/api/v1/projects/<PROJECT_ID> \
  -H "Authorization: Bearer $TOKEN" | head -c 200
```

**Expect `404`.** Administering accounts and reading people's work are different
jobs. The admin surface sees that a project exists, how big it is and who owns
it — never its contents.

---

# 8 · Signing out leaves nothing behind

**Do:** note your project names → account menu (top right) → **Sign out** →
register or sign in as a *different* account in the same window.

**Expect:** the second account sees only its own projects. Nothing of the first
remains.

**Check the disk yourself** — DevTools → Application → Local Storage, right
after signing out. `ps:v1` and `ps:sync` should be gone, along with both tokens.

> Both halves of this were broken and are now tested. The stores persist under
> fixed keys, so they outlived the session and the next person to sign in on
> that browser opened the previous person's diagrams. And the tokens were
> cleared *before* the logout request, so it went out unauthenticated, 401'd,
> and the refresh token stayed mintable for thirty days while you were told you
> had signed out.

---

# 9 · The app still works with the API down

**Do:** while signed in and editing, stop the API:

```bash
cd ../prompt-studio-backend && docker compose stop api
```

**Expect:** you stay in the editor. The badge changes to **Offline**. You can
still add screens, undo, redo, generate a prompt — and a refresh keeps your
work.

**Then bring it back:** `docker compose start api`. The badge returns to
**Synced** and your offline edits go up.

> This is the design, not a fallback. The editor is local-first: everything the
> canvas reads is one document in `localStorage`, and syncing sits on top. An
> unreachable API used to bounce you to `/login` and put your own work out of
> reach, because "could not ask" was treated the same as "the server said no".

---

# 10 · Passwords and sessions

## Reset

**Do:** sign out → *Forgot your password?* → your address.

**Expect:** the same "if that email has an account…" message **whether or not
it does** — otherwise the form is a way to test which addresses are registered.

**Get the token** from the API log, or straight from the response:

```bash
curl -s -X POST http://127.0.0.1:8010/api/v1/auth/forgot-password \
  -H 'content-type: application/json' -d '{"email":"you@example.com"}'
```

Open `http://localhost:3000/reset-password?token=<TOKEN>`, set a new password.

**Expect:** it works once. Reusing the same link fails. And **every session on
that account ends** — if you were signed in elsewhere, you are not any more.
A reset is exactly the moment to assume someone unwelcome is holding a token.

## Devices

```bash
curl -s http://127.0.0.1:8010/api/v1/auth/sessions -H "Authorization: Bearer <TOKEN>"
```

Sign in from two browsers and you will see two rows; exactly one has
`is_current: true`. Delete the other one:

```bash
curl -s -X DELETE http://127.0.0.1:8010/api/v1/auth/sessions/<SESSION_ID> \
  -H "Authorization: Bearer <TOKEN>"
```

**Expect:** that browser is signed out **immediately** — not in an hour. The
session row records the id of the access token it minted, so revoking one
reaches both tokens.

## Lockout

Get the password wrong 8 times in a row.

**Expect:** *"Too many failed attempts. Try again in a few minutes."* — and the
**correct** password stops working too, for 15 minutes. A password reset clears
it, or the recovery path would leave you locked out of the account you just
recovered.

---

# 11 · The admin panel

Open <http://localhost:8010/admin> and sign in as the superadmin.

It is served by the API, not the Next app, so it keeps working when the
frontend is down — which is exactly when an operator needs it.

**Dashboard** — user and project counters, signups this week, active today.

**Users** — search (debounced), filter by role and status, paginate.

- **New user** with no password → one is **generated** and shown **once**, with
  a copy button. Try signing in as them: it works, and then *every other route
  answers 403* until they set their own password. The frontend sends them to
  `/set-password`. That wall is the security boundary, not the redirect — a
  working token exists while an emailed credential is still live.
- **Edit** → change name, role, activate/deactivate, or re-issue a password.
  Deactivating signs that account out **immediately**, everywhere.

**Projects** — every project on the platform, **metadata only**. There is a note
on the tab saying so. There is no way to open one from here, by design.

**Audit** — sign-ins, registrations, role changes, deletions. Filter `action`
by a namespace prefix like `auth` or `admin`.

**Roles** — the permission matrix, served by the API so the panel renders the
real thing rather than a second copy that drifts.

## The privilege boundary

Worth proving, because it was a real hole:

1. As the superadmin, create a user with role **ADMIN**.
2. Sign in as that admin (set their password when prompted).
3. In *their* admin panel, find the **superadmin** and try to re-issue its
   password.

**Expect: 403 — "Only a superadmin can manage another admin account".**

> Before this, an ADMIN could reset a SUPERADMIN's password, read the plaintext
> out of the response, sign in as them, and hold the whole platform — with the
> audit log recording it as routine user management. The ADMIN/SUPERADMIN split
> was decorative until it was fixed.

The same admin *can* still manage ordinary members — that is the job the role
exists for.

---

# 12 · Versions, activity, comments

With a project open:

- **Save a version** (project menu → Versions) with a label. Change the canvas.
  **Restore** it. The canvas goes back — and restoring is itself undoable,
  because the live document is snapshotted first.
- **Activity** shows who did what: created, renamed, invited, saved a version.
  The actor's address is copied in, so the feed still reads correctly after an
  account is deleted.
- **Comments** can be pinned to the canvas or a screen. A **Viewer** cannot
  comment; a **Commenter** can. Anyone on the project may resolve a thread; only
  the author may reword it.

---

# 13 · The print view

**Do:** open <http://localhost:3000/print> with a project active.

**Expect:** the prompt rendered as **prose** — headings, bullet lists, code
blocks — not a wall of monospace. Toggle **Raw markdown** to get the copyable
source back. **Print** gives a paper-friendly page.

Check that no literal `**stars**` or stray ``` fences leak through, and that a
wide code block scrolls inside itself rather than making the page scroll
sideways.

---

# 14 · Rate limiting

The unauthenticated routes are throttled per IP. On this machine the limits are
deliberately loose (`.env` says why — everything here shares one address), so to
see it work, tighten them:

```bash
cd ../prompt-studio-backend
# in .env:  RATE_LIMIT_REGISTER=3/3600
docker compose restart api

for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://127.0.0.1:8010/api/v1/auth/register \
    -H 'content-type: application/json' \
    -d "{\"email\":\"rl$i@example.com\",\"password\":\"Password123\"}"
done; echo
```

**Expect:** `201 201 201 429 429`.

> Account lockout protects one account from being guessed. These protect what
> lockout cannot see: spraying one password across thousands of addresses,
> registration floods, and reset floods — where the thing being attacked is
> somebody else's inbox.

Put the limits back afterwards.

---

# 15 · Running the automated suites

Everything above is covered by tests, if you would rather watch than click.

```bash
# API — 134 tests against a real throwaway Postgres
cd ../prompt-studio-backend && uv run pytest -q

# App — 133 unit tests
cd ../prompt-studio && pnpm test

# Five real-browser suites: sign-up and sharing, two browsers editing live,
# sign-out, the print view, offline. Needs the API and the app running.
APP=http://localhost:3000 pnpm test:browser
```

The browser suites drive headless Chrome over the DevTools Protocol with no
dependencies at all — `tests/browser/cdp.mjs` is the whole driver.

**They write real rows.** Point them at a throwaway environment.

---

# Housekeeping

**A clean slate.** After a lot of testing the database fills with accounts. To
start over — *this destroys everything, including the superadmin, which the
seed then recreates*:

```bash
cd ../prompt-studio-backend && make reset
```

**Clear the rate-limit counters** without restarting anything:

```bash
docker compose exec redis sh -c \
  'redis-cli -a root --no-auth-warning --scan --pattern "prompt-studio:rate:*" | xargs -r redis-cli -a root --no-auth-warning del'
```

**Watch the API log** (invitations, reset links, issued passwords, every request):

```bash
docker compose logs -f api
```

**Stop everything:**

```bash
cd ../prompt-studio-backend && docker compose down     # add -v to delete the data too
```
