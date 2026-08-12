import { allLayouts } from "@/features/library/data/layouts"
import { sectionTypes } from "@/features/library/data/section-types"
import { snippets } from "@/features/library/data/snippets"
import { screenTemplates } from "@/features/library/data/templates"
import { promptTargets } from "@/features/prompt/engine/targets"
import { conventions } from "@/features/stack/data/conventions"
import { stackGroups } from "@/features/stack/data/stack-catalogue"
import { structurePresets } from "@/features/stack/data/structures"

/**
 * The prompt a developer copies into ChatGPT alongside the client's
 * requirements. It is generated from the same catalogues the app uses, so the
 * list of valid ids can never drift from the code.
 */
export function buildAuthoringPrompt(): string {
  const screenLayoutIds = allLayouts
    .filter((l) => l.scope === "screen")
    .map((l) => `${l.id} (${l.name})`)

  const sectionLayoutsByType = sectionTypes
    .map((type) => {
      const ids = allLayouts
        .filter((l) => l.sectionType === type.id)
        .map((l) => l.id)
      return ids.length ? `- ${type.id}: ${ids.join(", ")}` : ""
    })
    .filter(Boolean)

  const stackLines = stackGroups.map(
    (group) => `- ${group.key}: ${group.options.map((o) => o.id).join(", ")}`
  )

  return `# Task

You are turning a client's requirements into a **Flow** file — a small
declarative language that describes a frontend application: its screens, how the
user moves between them, the marketing sections of its landing page, and the
technology it should be built with.

The Flow file will be pasted into **Prompt Studio**, an internal tool that
renders it as an editable flow diagram and then generates a full build prompt
for a coding agent. Your output is therefore not documentation — it is source
code for that tool.

Alongside this prompt you will be given the client's requirements. Read them,
decide what screens the product needs, and write the Flow file.

# Output rules

1. Output **one fenced code block** and nothing else. No preamble, no
   explanation, no bullet summary.
2. Use **only** the ids listed under "Valid values" below. Do not invent ids.
   If nothing fits, pick the closest listed id — never make one up.
3. Every screen must be reachable: each screen except the entry point must be
   the target of at least one connection.
4. **Label every connection** with what causes it, e.g. \`: "on successful login"\`,
   \`: "click Add Client"\`, \`: "on save"\`. Unlabelled connections are useless.
5. Prefer 6–15 screens. Cover the real flows the requirements imply, including
   create/edit paths and empty or error screens where they matter.
6. Screen keys are lowercase snake_case and unique. Titles are human labels.
7. Include a \`landing { ... }\` block only if the requirements mention a public
   marketing site.
8. Put anything that does not fit the grammar into the \`requirements """..."""\`
   block in plain English — business rules, roles, integrations, edge cases.

# Grammar

\`\`\`
app "Product name" {
  target claude-code          # who will build it
  creativity 6                # 0 = follow spec literally, 10 = free rein
  theme { primary #2563eb; secondary #10b981; radius md; buttons filled; density comfortable }
}

screen login "Sign In" {
  template auth               # what kind of screen it is
  layout   auth-split         # how it is laid out
  note     "email + OTP, Google SSO"   # anything specific to this screen
}

screen dashboard "Dashboard" { template dashboard; layout dashboard-sidebar }

flow {
  login      -> dashboard  : "on successful login"
  dashboard  -> clients    : "click Clients in the sidebar"
  clients    -> client_new : "click Add Client"
  client_new -> clients    : "on save"
}

landing {
  section hero     "Hero"     layout hero-two-column
  section features "Features" layout features-grid-3
  section pricing  "Pricing"  layout pricing-three
}

stack {
  framework next-16
  language  ts-strict
  styling   tailwind4-shadcn
  state     tanstack-zustand
  forms     rhf-zod
  http      axios-instance
  extras    "socket.io for live updates"
}

structure feature-based
conventions [kebab-files, barrel-exports, alias-@, a11y-baseline]
snippets [a11y, states, tables]

requirements """
Multi-tenant. Admin actions gated by role.
Clients import from CSV; duplicates are merged, never overwritten.
"""
\`\`\`

Notes on syntax: braces and semicolons are optional, \`->\` may also be written
\`→\`, and \`# \` starts a comment. Multi-line text uses \`"""\` fences.

# Valid values

## targets
${promptTargets.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## screen templates
${screenTemplates.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## screen layouts
${screenLayoutIds.map((l) => `- ${l}`).join("\n")}

## section types
${sectionTypes.map((s) => `- ${s.id} — ${s.description}`).join("\n")}

## section layouts (by section type)
${sectionLayoutsByType.join("\n")}

## stack options
${stackLines.join("\n")}

## folder structures
${structurePresets.map((s) => `- ${s.id} — ${s.description}`).join("\n")}

## conventions
${conventions.map((c) => `- ${c.id} — ${c.label}`).join("\n")}

## requirement snippets
${snippets.map((s) => `- ${s.id} — ${s.description}`).join("\n")}

# Worked example — internal admin app

\`\`\`
app "Acme Ops Console" {
  target claude-code
  creativity 5
  theme { primary #2563eb; secondary #10b981; radius md; buttons filled }
}

screen login     "Sign In"        { template auth;      layout auth-split }
screen dashboard "Operations"     { template dashboard; layout dashboard-sidebar }
screen orders    "Orders"         { template table;     layout table-advanced }
screen order     "Order Detail"   { template detail;    layout detail-two-column }
screen refund    "Issue Refund"   { template form;      layout form-sidebar-summary }
screen settings  "Settings"       { template settings;  layout settings-sections }

flow {
  login     -> dashboard : "on successful login"
  dashboard -> orders    : "click Orders"
  orders    -> order     : "click an order row"
  order     -> refund    : "click Issue refund"
  refund    -> order     : "on refund submitted"
  dashboard -> settings  : "open the settings menu"
}

stack { framework next-16; styling tailwind4-shadcn; state tanstack-zustand; forms rhf-zod }
structure feature-based
conventions [kebab-files, barrel-exports, alias-@, states-required, a11y-baseline]
snippets [a11y, states, tables]

requirements """
Only supervisors can issue refunds; agents see the button disabled with a tooltip.
Every refund writes an audit entry visible on the order detail screen.
"""
\`\`\`

# Worked example — marketing site

\`\`\`
app "Northwind Launch" {
  target v0
  creativity 8
  theme { primary #7c3aed; secondary #f59e0b; radius lg; buttons rounded }
}

screen home "Home" { template landing; layout hero-two-column }

landing {
  section navigation   "Header"      layout nav-split
  section hero         "Hero"        layout hero-two-column
  section logos        "Trusted by"  layout logos-strip
  section features     "Features"    layout features-bento
  section testimonials "Loved by"    layout testimonials-cards
  section pricing      "Pricing"     layout pricing-three
  section faq          "Questions"   layout faq-accordion
  section cta          "Get started" layout cta-banner
  section footer       "Footer"      layout footer-columns
}

structure route-colocated
conventions [kebab-files, tokens-only, a11y-baseline]
snippets [responsive, a11y]

requirements """
Single conversion goal: start a free trial. No credit card copy above the fold.
"""
\`\`\`

Now write the Flow file for the requirements provided.`
}
