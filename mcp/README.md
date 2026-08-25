# Prompt Studio as an MCP server

Claude Code writes the diagram directly.

The studio's document has a text form — Flow — and that text form is the whole
interface here. Claude reads the grammar, writes Flow, checks it, and folds it
into a real project. Anyone with the project open watches the screens appear on
the canvas as it goes.

## Setting it up

Build it once:

```bash
pnpm install
pnpm build:mcp
```

Then register it with Claude Code, from anywhere:

```bash
claude mcp add prompt-studio \
  --env PROMPT_STUDIO_API_URL=https://prompt-studio-backend.onrender.com \
  --env PROMPT_STUDIO_EMAIL=you@example.com \
  --env PROMPT_STUDIO_PASSWORD='your password' \
  -- node /absolute/path/to/prompt-studio/mcp/dist/server.mjs
```

`PROMPT_STUDIO_API_URL` defaults to `http://localhost:8010`, which is where
`make dev` in the backend repo puts it.

It signs in with your own account, so it can reach exactly the projects you can
reach and every change is attributed to you in the activity feed — there is no
service account and no shared credential.

## The tools

| Tool | What it does |
| --- | --- |
| `flow_language_guide` | The complete grammar, with worked examples. Read it before writing Flow for the first time. |
| `list_projects` | Every project the account can open. |
| `read_project` | The project's document as Flow source, plus its version number. |
| `check_flow` | Parse Flow without touching anything. Free, and the right way to iterate. |
| `write_flow` | Fold Flow into a project. Merges by default. |
| `create_project` | A new project, optionally written in one go. |
| `build_prompt` | The build prompt the project generates, per surface. |

## Two things worth knowing

**Merge is the default, and it matters.** A model asked to add a billing journey
writes the billing journey — not the other eleven. Merging resolves screens and
journeys by key, fills blanks and adds what is new, and leaves everything the
source did not mention alone. `replace` exists for when the source really is the
whole project, and has to be asked for by name.

**Saves are refused, not merged, when they would overwrite.** `write_flow` reads
the project, applies the source to what it read, and sends the version it read
as the base. If somebody saved in between, the write comes back as a conflict
and says to read again — it never lands on top of their work.

## Working on it

`mcp/src/flow.ts` is where the behaviour lives, and it is pure — no transport,
no network — so `tests/mcp.test.ts` covers it directly. `mcp/src/server.ts` is
the wiring, and `mcp/src/api.ts` is the small slice of the HTTP API this needs.

The build is a bundle rather than plain `tsc` output because the server imports
the studio's own parser, serializer and prompt engine through the same `@/`
alias the app uses. Re-run `pnpm build:mcp` after changing any of them — the
bundle is a build artifact and is not committed.
