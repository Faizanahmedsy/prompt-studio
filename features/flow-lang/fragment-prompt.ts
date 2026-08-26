import { allLayouts } from "@/features/library/data/layouts"
import { moduleKinds } from "@/features/library/data/module-kinds"
import { screenTemplates } from "@/features/library/data/templates"
import type { ProjectDoc } from "@/types/project"

/**
 * The prompt for growing a diagram that already exists.
 *
 * The whole difficulty of merging is anchoring: a fragment is only useful if it
 * attaches to screens the project already has, which means the model must know
 * their keys. So the current project's screens — and the modules of each — are
 * embedded in the prompt, and the model is told to reuse those keys verbatim.
 * Merge then matches on key, and the fragment lands on the real screens instead
 * of creating a second copy of each.
 */
/** The builds this project ships, in words, for the fragment prompt. */
function buildWords(doc: ProjectDoc): string {
  const names: string[] = []
  if (doc.builds.web) names.push("a web app")
  if (doc.builds.mobile) names.push("a mobile app")
  if (doc.builds.backend) names.push("a backend service")
  if (!names.length) return "a web app"
  if (names.length === 1) return names[0]
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

export function buildFragmentPrompt(doc: ProjectDoc): string {
  const flowKeyOf = new Map(doc.flows.map((f) => [f.id, f.key]))
  const inventory = doc.screens.length
    ? doc.screens
        .map((screen) => {
          const modules = doc.modules
            .filter((m) => m.screenId === screen.id)
            .sort((a, b) => a.order - b.order)
          const tags = screen.flows
            .map((id) => flowKeyOf.get(id))
            .filter(Boolean)
          const inFlows = tags.length ? ` · flows: ${tags.join(", ")}` : ""
          const line = `- \`${screen.key}\` — ${screen.title}${screen.template ? ` (${screen.template})` : ""} · ${screen.surface}${inFlows}`
          if (!modules.length) return line
          return `${line}\n  modules: ${modules.map((m) => `\`${m.key}\` (${m.kind})`).join(", ")}`
        })
        .join("\n")
    : "_(this project has no screens yet — your fragment will be the first)_"

  const flowInventory = doc.flows.length
    ? doc.flows
        .map((flow) => {
          const members = doc.screens
            .filter((s) => s.flows.includes(flow.id))
            .map((s) => `\`${s.key}\``)
          return `- \`${flow.key}\` — ${flow.name}${members.length ? ` · ${members.join(", ")}` : " · _(no screens yet)_"}`
        })
        .join("\n")
    : "_(this project has no flows yet — name the ones your feature needs)_"

  const anchorExample = doc.screens[0]?.key ?? "dashboard"
  const anchorFlows = doc.screens[0]?.flows.map((id) => flowKeyOf.get(id)).filter(Boolean) ?? []
  const flowExample = doc.flows[0]?.key ?? "billing"
  const screenLayoutIds = allLayouts
    .filter((l) => l.scope === "screen")
    .map((l) => l.id)

  return `# Task

You are writing a **Flow fragment** — a piece of a flow diagram that will be
merged into a project that already exists.

The fragment is pasted into **Prompt Studio**, which matches your screens
against the current project **by key**: a key that already exists updates that
screen and adds whatever is new to it; a key that does not exist creates a new
screen. Your output is source code for that tool, not documentation.

Alongside this prompt you will be given the feature to add. Read it, then write
only the screens, modules and connections that feature needs.

# The project as it stands

Reuse these keys **exactly** when your feature touches an existing screen —
same spelling, same underscores. A misspelled key silently creates a duplicate
screen instead of attaching to the real one, which is the single most common
way this goes wrong.

${inventory}

## The journeys it already has

Reuse these keys too. A feature that belongs to an existing journey joins it;
inventing \`authentication\` beside an existing \`auth\` splits one flow into two
that can never be looked at together.

${flowInventory}

# Output rules

1. Output **one fenced code block** and nothing else.
2. **Fragment only.** Do not emit \`app\`, \`theme\`, \`stack\`, \`structure\`,
   \`conventions\`, \`snippets\` or \`requirements\` blocks — the project already has
   those and your version would fight them. Only \`screen\`, \`module\`, \`inner\`
   and \`flow\`.
3. **Anchor the fragment.** At least one connection in your \`flow\` block must
   start from an existing key above, so the new work is reachable from the app
   that already exists. An unanchored fragment lands as an island.
4. To add modules to an existing screen, redeclare the screen with only the new
   modules inside it. Do not restate its \`template\`, \`layout\` or existing
   modules — anything you leave out is left alone.
5. Keep it tight: the feature asked for, and nothing else. Do not redesign
   neighbouring screens, and do not "improve" what is already there.
5a. **Tag every new screen with \`flows [ … ]\`.** Reuse a key from the list
   above where the feature belongs to a journey that exists. Declare a new flow
   in a \`flows { … }\` block only when the feature genuinely is a new journey —
   and then give it a story.
5b. **Write a \`story { … }\` for every new screen**: one line each for \`as\`,
   \`want\` and \`so\`, then 3–6 checkable acceptance criteria in the language of
   the person using it, not the framework's. Include what happens when it goes
   wrong. Do not write a story for a screen you are only redeclaring to add a
   module to — it already has one, and a thinner one would not replace it
   anyway.
6. Label every connection with what causes it.
7. New screen keys are lowercase snake_case and must not collide with the list
   above unless you mean to attach to that screen.
8. **Say which build each new screen belongs to.** \`surface mobile\` for a phone
   screen (and then a \`mobile-*\` layout), \`surface backend\` for a service; no
   \`surface\` line means the web app. The list above shows each existing screen's
   build, so match it when you extend one. Never connect a screen on one build
   to a screen on another.

   This project ships: **${buildWords(doc)}**. A fragment for a build that is
   not on that list is a fragment nobody asked for — if the feature genuinely
   needs one, say so in a note rather than inventing the build.${
     doc.builds.backend
       ? `

   On \`surface backend\` a screen is a service area, not a page: no
   \`layout\`, modules named for their endpoints (\`"POST /jobs/{id}/status"\`),
   and criteria about what the service rejects, what it tolerates being sent
   twice, and what it never returns.`
       : ""
   }

9. **Do not touch the stack.** A fragment adds screens, modules and connections.
   It never contains \`stack\`, \`structure\`, \`theme\` or \`builds\` — those belong
   to the project, are already set, and a fragment that restates them will
   quietly reset a decision somebody made.

# Grammar

\`\`\`
# --- adds two modules to a screen that already exists ---
screen ${anchorExample} {${anchorFlows.length ? `\n  # already in: ${anchorFlows.join(", ")} — leave its flows and story alone` : ""}
  module export_menu "Export"      { kind action; on "click Export" }
  module date_range  "Date range"  { kind filters }
  inner {
    date_range -> export_menu : "range applied, export reflects it"
  }
}

# --- only if the feature really is a new journey ---
flows {
  flow ${flowExample} "Invoicing" {
    story {
      as     "someone who bills clients"
      want   "raise an invoice and send it without leaving the app"
      so     "I am not rebuilding the same numbers in a spreadsheet"
      accept [
        "an invoice cannot be sent twice"
        "a draft survives closing the tab"
      ]
    }
  }
}

# --- a brand new screen the feature needs ---
screen invoice_new "New Invoice" {
  template form
  layout   form-sidebar-summary
  flows    [${flowExample}]
  story {
    as     "someone raising an invoice"
    want   "add line items and see the total before I send it"
    so     "the client never gets a figure I have not checked"
    accept [
      "the total recalculates as a line item changes, with no Save first"
      "sending is blocked, with a reason, while any line item is incomplete"
      "leaving the screen with unsent changes asks before discarding them"
    ]
  }
  note     "Line items, tax, and a preview before send"
  module line_items "Line items" { kind list }
  module totals     "Totals"     { kind panel }
  module send_modal "Send"       { kind modal; on "click Send invoice" }
  inner {
    line_items -> totals     : "recalculate on change"
    totals     -> send_modal : "click Send invoice"
  }
}

# --- anchor it to the existing app ---
flow {
  ${anchorExample} -> invoice_new : "click New Invoice"
  invoice_new -> ${anchorExample} : "on send"
}
\`\`\`

Syntax notes: braces and semicolons are optional, \`->\` may be written \`→\`, and
\`# \` starts a comment. Module keys are unique within their screen only.

# Valid values

## screen templates
${screenTemplates.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## screen layouts
${screenLayoutIds.map((l) => `- ${l}`).join("\n")}

## module kinds
${moduleKinds.map((k) => `- ${k.id} — ${k.description}`).join("\n")}

Now write the fragment for the feature described — tagged into a journey, and
with a story on every new screen.`
}
