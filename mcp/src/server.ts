/**
 * Prompt Studio, as an MCP server.
 *
 * The studio's whole point is that a diagram and a prompt are two views of one
 * document, and that the document has a text form — Flow — that a model can
 * read and write. That text form is the API this server exposes: Claude Code
 * asks for the grammar, writes Flow, checks it, and folds it into a real
 * project that everyone else sees in the canvas a moment later.
 *
 * Two decisions worth stating, because both are load-bearing:
 *
 * - **`check_flow` before `write_flow`.** Getting a grammar right costs
 *   iterations, and an iteration should not cost a write. The check needs no
 *   project and touches nothing.
 * - **Merge is the default.** A model asked to add a billing journey writes
 *   the billing journey, not the other eleven — so a write that replaced the
 *   document would delete the rest of the project every single time. `replace`
 *   exists, named plainly, and has to be asked for.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { buildAuthoringPrompt } from "@/features/flow-lang"
import { surfaceValues } from "@/types/project"

import { Api, ApiError, type ProjectDetail, type ProjectSummary } from "./api.js"
import { applyFlow, checkFlow, newDoc, promptFor, readDoc, toFlow } from "./flow.js"

const baseUrl = process.env.PROMPT_STUDIO_API_URL ?? "http://localhost:8010"
const email = process.env.PROMPT_STUDIO_EMAIL ?? ""
const password = process.env.PROMPT_STUDIO_PASSWORD ?? ""

const api = new Api({ baseUrl, email, password })

const server = new McpServer({ name: "prompt-studio", version: "1.0.0" })

/** Every tool answers in this shape; MCP has no error channel worth using. */
function text(body: string) {
  return { content: [{ type: "text" as const, text: body }] }
}

/**
 * A failed tool call is a message, not a crash.
 *
 * An exception out of a tool handler reaches Claude as a transport-level
 * failure with no useful text in it, which reads as "the server is broken" when
 * the truth is usually "that project is not shared with this account".
 */
async function attempt(run: () => Promise<ReturnType<typeof text>>) {
  try {
    return await run()
  } catch (error) {
    if (error instanceof ApiError) {
      const hint =
        error.status === 401
          ? " — check PROMPT_STUDIO_EMAIL and PROMPT_STUDIO_PASSWORD"
          : error.status === 404
            ? " — the project does not exist, or is not shared with this account"
            : error.status === 409
              ? " — someone saved a newer version; read the project again and re-apply"
              : ""
      return text(`Failed (${error.status}): ${error.message}${hint}`)
    }
    return text(`Failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function requireCredentials(): string | null {
  if (email && password) return null
  return (
    "This server has no credentials. Set PROMPT_STUDIO_EMAIL and " +
    "PROMPT_STUDIO_PASSWORD (and PROMPT_STUDIO_API_URL if the API is not on " +
    "http://localhost:8010) in the MCP server's environment."
  )
}

// ── the grammar ──────────────────────────────────────────────────────────────

server.registerTool(
  "flow_language_guide",
  {
    title: "Flow language guide",
    description:
      "The complete Flow grammar with worked examples. Read this before writing " +
      "Flow for the first time in a session — the grammar is small but specific, " +
      "and guessing at it produces source that parses into the wrong shape.",
    inputSchema: {},
  },
  async () => text(buildAuthoringPrompt())
)

// ── reading ──────────────────────────────────────────────────────────────────

server.registerTool(
  "list_projects",
  {
    title: "List projects",
    description: "Every project this account can open, newest activity first.",
    inputSchema: {
      include_archived: z.boolean().optional().describe("Archived projects too."),
    },
  },
  async ({ include_archived }) =>
    attempt(async () => {
      const blocked = requireCredentials()
      if (blocked) return text(blocked)
      const page = await api.request<{ items: ProjectSummary[]; total: number }>(
        "GET",
        `/projects?status=${include_archived ? "all" : "active"}&size=100`
      )
      if (!page.items.length) return text("No projects.")
      const lines = page.items.map(
        (project) =>
          `${project.id}  ${project.name} — ${project.screen_count} screens, ` +
          `v${project.doc_version}, your role ${project.my_role ?? "unknown"}` +
          `${project.is_archived ? " (archived)" : ""}`
      )
      return text(`${page.total} project(s):\n\n${lines.join("\n")}`)
    })
)

server.registerTool(
  "read_project",
  {
    title: "Read a project as Flow",
    description:
      "The project's whole document in Flow source. This is the form to edit and " +
      "hand back to write_flow. Note the version number in the reply — write_flow " +
      "needs it to refuse a save that would overwrite somebody else's work.",
    inputSchema: { project_id: z.string().describe("From list_projects.") },
  },
  async ({ project_id }) =>
    attempt(async () => {
      const blocked = requireCredentials()
      if (blocked) return text(blocked)
      const project = await api.request<ProjectDetail>("GET", `/projects/${project_id}`)
      return text(
        `${project.name} — version ${project.doc_version}\n\n\`\`\`flow\n${toFlow(project.doc)}\n\`\`\``
      )
    })
)

server.registerTool(
  "build_prompt",
  {
    title: "Build the prompt",
    description:
      "The build prompt this project generates — the same text the studio's " +
      "Generate button copies. Use it to see what a change to the Flow actually " +
      "does to the brief a coding agent receives.",
    inputSchema: {
      project_id: z.string(),
      surface: z
        .enum(surfaceValues)
        .optional()
        .describe("web (default), mobile or backend — each is a separate build."),
    },
  },
  async ({ project_id, surface }) =>
    attempt(async () => {
      const blocked = requireCredentials()
      if (blocked) return text(blocked)
      const project = await api.request<ProjectDetail>("GET", `/projects/${project_id}`)
      return text(promptFor(project.doc, surface ?? "web"))
    })
)

// ── writing ──────────────────────────────────────────────────────────────────

server.registerTool(
  "check_flow",
  {
    title: "Check Flow source",
    description:
      "Parse Flow source and report what it describes, or what is wrong with it. " +
      "Touches no project and needs no credentials — use it freely while getting " +
      "the source right, and only then call write_flow.",
    inputSchema: { flow: z.string().describe("Flow source.") },
  },
  async ({ flow }) => {
    const result = checkFlow(flow)
    const warnings = result.warnings.length
      ? `\n\nWarnings (these do not stop a write):\n${result.warnings
          .map((warning) => `- ${warning}`)
          .join("\n")}`
      : ""
    if (!result.ok) {
      return text(
        `Not valid Flow:\n\n${result.errors.map((error) => `- ${error}`).join("\n")}${warnings}`
      )
    }
    return text(`Valid. ${result.summary}${warnings}`)
  }
)

server.registerTool(
  "write_flow",
  {
    title: "Write Flow into a project",
    description:
      "Fold Flow source into a project. Merging (the default) resolves screens " +
      "and journeys by key, fills blanks and adds what is new, leaving anything " +
      "the source does not mention alone — so a fragment about one journey is " +
      "safe to write. Replacing discards the current document entirely and is " +
      "only ever right when the source is the whole project.",
    inputSchema: {
      project_id: z.string(),
      flow: z.string().describe("Flow source. Run check_flow on it first."),
      mode: z
        .enum(["merge", "replace"])
        .optional()
        .describe("merge (default) or replace."),
      label: z
        .string()
        .optional()
        .describe("Names a version snapshot, so the change can be rolled back."),
    },
  },
  async ({ project_id, flow, mode, label }) =>
    attempt(async () => {
      const blocked = requireCredentials()
      if (blocked) return text(blocked)
      const project = await api.request<ProjectDetail>("GET", `/projects/${project_id}`)
      const applied = applyFlow(readDoc(project.doc), flow, mode ?? "merge")
      if (!applied.ok) {
        return text(
          `Nothing was written — the source is not valid Flow:\n\n${applied.issues
            .map((issue) => `- ${issue}`)
            .join("\n")}`
        )
      }
      const saved = await api.request<ProjectSummary>(
        "PUT",
        `/projects/${project_id}/document`,
        {
          doc: applied.doc,
          // Read immediately above, so this is the version we merged onto — a
          // save that would land on top of somebody else's is refused, not
          // silently applied.
          base_version: project.doc_version,
          label: label ?? "Written by Claude Code",
        }
      )
      return text(`${applied.summary}\nSaved as version ${saved.doc_version}.`)
    })
)

server.registerTool(
  "create_project",
  {
    title: "Create a project from Flow",
    description:
      "A new project, optionally with its whole document written in one go. " +
      "The name given here wins over any name inside the source.",
    inputSchema: {
      name: z.string().describe("What to call it."),
      flow: z.string().optional().describe("Flow source for the whole project."),
      description: z.string().optional(),
      member_emails: z
        .array(z.string())
        .optional()
        .describe("Addresses to share it with immediately."),
    },
  },
  async ({ name, flow, description, member_emails }) =>
    attempt(async () => {
      const blocked = requireCredentials()
      if (blocked) return text(blocked)
      const built = newDoc(name, flow ?? null)
      if (!built.ok) {
        return text(
          `Nothing was created — the source is not valid Flow:\n\n${built.issues
            .map((issue) => `- ${issue}`)
            .join("\n")}`
        )
      }
      const project = await api.request<ProjectDetail>("POST", "/projects", {
        name,
        description: description ?? "",
        doc: built.doc,
        member_emails: member_emails ?? [],
      })
      return text(`Created ${project.name} (${project.id}). ${built.summary}`)
    })
)

await server.connect(new StdioServerTransport())
