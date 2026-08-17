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
export function buildFragmentPrompt(doc: ProjectDoc): string {
  const inventory = doc.screens.length
    ? doc.screens
        .map((screen) => {
          const modules = doc.modules
            .filter((m) => m.screenId === screen.id)
            .sort((a, b) => a.order - b.order)
          const line = `- \`${screen.key}\` — ${screen.title}${screen.template ? ` (${screen.template})` : ""}`
          if (!modules.length) return line
          return `${line}\n  modules: ${modules.map((m) => `\`${m.key}\` (${m.kind})`).join(", ")}`
        })
        .join("\n")
    : "_(this project has no screens yet — your fragment will be the first)_"

  const anchorExample = doc.screens[0]?.key ?? "dashboard"
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
6. Label every connection with what causes it.
7. New screen keys are lowercase snake_case and must not collide with the list
   above unless you mean to attach to that screen.

# Grammar

\`\`\`
# --- adds two modules to a screen that already exists ---
screen ${anchorExample} {
  module export_menu "Export"      { kind action; on "click Export" }
  module date_range  "Date range"  { kind filters }
  inner {
    date_range -> export_menu : "range applied, export reflects it"
  }
}

# --- a brand new screen the feature needs ---
screen invoice_new "New Invoice" {
  template form
  layout   form-sidebar-summary
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

Now write the fragment for the feature described.`
}
