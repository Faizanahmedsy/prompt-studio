# Versions

Three lines of this app are maintained at once. They are not stages of one
migration — each is a shippable answer to a different question, and none of them
is going away.

| | Branch | Tag | Needs a backend? | Moves? |
| --- | --- | --- | --- | --- |
| **v1 — frontend only** | `archive/v1-frontend-only` | `v1.0.0` | No | **Never** |
| **v2 — backend connected** | `v2-backend-connected` | `v2.0.0` | Yes | Fixes only |
| **v3 — enhanced** | `v3-enhanced` | *(unreleased)* | Yes | Active |

## `main` is not one of them

`main` is the **deployed** branch. What sits on it is a deployment decision and
will change; it is a pointer at whatever is live, not a version of the product.

So it is deliberately absent from the table above. Never treat `main` as "the
v1 line" just because v1 happens to be on it today — the moment a different
version is deployed, anyone who assumed that has lost v1 entirely. That is what
`archive/v1-frontend-only` exists to prevent.

---

## v1 — frontend only

`archive/v1-frontend-only` · `v1.0.0`

The browser-only editor. No accounts, no network calls: a project lives in
`localStorage` and travels as a `.json` file or a share link.

**Frozen.** The branch is a snapshot and does not move. It is worth keeping
because it needs nothing running to be useful — open the page and it works,
which is the right answer for a laptop, a demo on a train, or anyone who does
not want to stand up Postgres to draw a flow chart.

If v1 ever genuinely needs a fix, branch from the tag, fix, and cut `v1.0.1`
rather than moving this one.

## v2 — backend connected

`v2-backend-connected` · `v2.0.0`

v1 plus accounts, projects stored in Postgres, sharing by email address, and
live collaboration over a websocket. Needs
[`prompt-studio-backend`](https://github.com/faizanahmed-sy-devstree/prompt-studio-backend)
running.

Still local-first underneath: the editor reads and writes one Zustand document
in `localStorage` exactly as v1 does, and syncing sits on top. With the API
unreachable it degrades to what v1 is — `tests/browser/offline.mjs` asserts
that, so it stays true.

Fixes land here. Features go to v3.

## v3 — enhanced

`v3-enhanced`

Where new work goes. Branched from v2, so everything above is already in it.

Tag it when it ships:

```bash
git tag -a v3.0.0 -m "v3.0.0 — <what changed>"
git push origin v3.0.0
```

---

## Moving a change between lines

A fix that belongs in more than one line goes into the **oldest** line it
applies to, then forward — never the other way round, or the older line quietly
falls behind on bugs that were fixed once.

```bash
git switch v2-backend-connected   # fix it where it starts
# ... commit ...
git switch v3-enhanced && git cherry-pick <sha>
```

Cherry-pick rather than merge: v3 carries files v2 has never had, and a merge
drags the whole diff along with the fix.

## Releasing

Tags are annotated, and the message says what changed and why someone would
want that version, so `git tag -l -n9` reads as a changelog.

```bash
git tag -a v2.1.0 <sha> -m "v2.1.0 — <what changed>"
git push origin v2.1.0
```

## Deploying

Point `main` at whichever line is going live, and say so in the merge:

```bash
git switch main
git merge --no-ff v3-enhanced -m "deploy: v3"
git push origin main
```

The version lines themselves are never merged into each other.

## Which one am I on?

```bash
git branch --show-current
git describe --tags --always
```
