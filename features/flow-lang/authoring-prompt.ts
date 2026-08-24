import { allLayouts } from "@/features/library/data/layouts"
import { moduleKinds } from "@/features/library/data/module-kinds"
import { sectionTypes } from "@/features/library/data/section-types"
import { snippets } from "@/features/library/data/snippets"
import { screenTemplates } from "@/features/library/data/templates"
import { promptTargets } from "@/features/prompt/engine/targets"
import { conventions } from "@/features/stack/data/conventions"
import { stackGroups } from "@/features/stack/data/stack-catalogue"
import { structurePresets } from "@/features/stack/data/structures"
import { designLanguages } from "@/features/theme/data/design-languages"

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

One file, **two diagrams**. The same screens are read two ways:

- the **whole-app** diagram — every screen and every transition between them;
- the **flow-wise** diagram — those same screens grouped into named user
  journeys ("Authentication", "Invite a user", "Checkout"), each with its own
  user story.

Nothing is drawn twice. The transitions are written once in \`flow { … }\`, and a
screen's \`flows [ … ]\` tag is what the second diagram reads. **You must produce
both**, and a story for every screen and every flow.

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
5a. **Name the journeys before you name the screens.** Read the requirements and
   decide what the real user journeys are — signing in and recovering an
   account, first-run onboarding, the create path, the day-to-day path, billing,
   administration — and write the \`flows { … }\` block first. Aim for **3–8
   flows**: one flow per screen is just the screen list renamed, and two flows
   for forty screens groups nothing.
5b. **Every screen carries at least one \`flows [ … ]\` tag.** This is the one
   place to be strict: an untagged screen is a screen nobody could say why they
   built. Tag generously — a screen used in three journeys gets three tags, and a
   dashboard that several journeys return to belongs to all of them. That is
   correct, not a mistake to tidy up.
5c. **A flow is a journey, never a role.** "Admin" is a \`views\` entry — who can
   reach a screen. "Invite a user" is a flow — what someone is trying to get
   done. If a name would fit in \`views\`, it is not a flow.
5d. **Write a \`story { … }\` for every screen and every flow.** One line each for
   \`as\`, \`want\` and \`so\`, then **3–6 acceptance criteria** under \`accept\`.
   Details that matter:
   - criteria must be **checkable** — a rule about what the screen does, not a
     restatement of its layout. "Clearing a filter returns to page 1" is a
     criterion; "has a filter bar" is not.
   - write them in the **client's language, not the framework's**: "an empty
     result says what to change", never "render the EmptyState component".
   - cover what happens when it **goes wrong** — the wrong password, the expired
     link, the half-filled form abandoned and returned to.
   - a flow's story covers the journey **end to end**; a screen's covers only
     that screen. Do not repeat one inside the other.
   - do not repeat the scaffolding: write \`as "a billing admin"\`, not
     \`as "As a billing admin"\`.
6. Screen keys are lowercase snake_case and unique. Titles are human labels.
7. Include a \`landing { ... }\` block only if the requirements mention a public
   marketing site.
8. Add a \`views { … }\` block only when the requirements describe more than one
   kind of user. Then tag a screen with \`in [admin]\` **only when it is
   restricted** — an untagged screen belongs to every role, which is what most
   screens are.
9. Modules are **optional**. Add them to a screen that carries real behaviour —
   a list screen with filters and a create dialog, a detail screen with tabs —
   and leave them off a screen that is genuinely one thing. A modal opening is
   an \`inner\` connection, never a \`flow\` one: \`flow\` means the route changed.
10. **Decide which builds the product needs, and say so.** A product ships as
    some combination of a **web** app, a **mobile** app, a public **landing**
    page and a **backend**. Read the requirements and pick:
    - "internal admin tool", "dashboard", "portal" → web
    - "app", "on their phone", "iOS/Android", "offline in the field",
      "push notifications", "camera", "scan", "GPS" → mobile
    - "marketing site", "public page", "sign-ups from the website" → landing
    - "API", "service", "webhook", "scheduled job", "integration" → backend

    Most real products need **more than one**. A field-service product is a
    mobile app for the engineer *and* a web console for the dispatcher — write
    both, in one file. Tag every screen with the build it belongs to:
    \`surface mobile\`, \`surface backend\`; a screen with no \`surface\` line is a
    web screen. Give each build its own \`stack\` block (see Grammar).

    Never draw a \`flow\` arrow from one build to another — a phone screen
    calling an endpoint is an integration, and belongs in a note or in
    \`requirements\`, not as a transition.

11. **Mobile screens are not web screens.** Use the \`mobile-*\` layouts — a
    phone screen is never \`dashboard-sidebar\` or \`table-advanced\`. Reach for
    \`mobile-auth\`, \`mobile-onboarding\`, \`mobile-tabs\` (or
    \`mobile-floating-tabs\` / \`mobile-tabs-fab\`), \`mobile-list\`,
    \`mobile-detail\`, \`mobile-form\`, \`mobile-sheet\`, \`mobile-profile\`.
    Useful module kinds there: \`sheet\`, \`permission\`, \`camera\`, \`map\`. In the
    mobile \`stack\`, pick the native options (\`expo-router\`/\`swiftui\`,
    \`nativewind\`, \`rn-flashlist\`, \`victory-native\`) — the web ones do not
    exist on a phone.
12. Put anything that does not fit the grammar into the \`requirements """..."""\`
   block in plain English — business rules, roles, integrations, edge cases.

# Grammar

\`\`\`
app "Product name" {
  target claude-code          # who will build it
  creativity 6                # 0 = follow spec literally, 10 = free rein
  theme { design modern-soft; primary #2563eb; secondary #10b981; radius md; buttons filled; density comfortable }
}

# OPTIONAL — only if the product has more than one kind of user.
# A screen with no "in [...]" line belongs to every one of them.
views { admin "Admin"; rep "Sales Rep" }

# REQUIRED — the named user journeys. This is the flow-wise diagram.
# A flow declares itself and its story; which screens are in it is a tag on
# the screen, below.
flows {
  flow auth "Authentication" {
    story {
      as     "a returning user"
      want   "get into the console, and back in when I have lost my password"
      so     "I can start work without asking anyone for help"
      accept [
        "a wrong password says so without revealing which field was wrong"
        "a reset link expires 30 minutes after it is issued"
        "signing in lands on the dashboard, not back on the form"
      ]
    }
  }
  flow client_admin "Managing clients" {
    story { as "an operations admin"; want "keep the client list accurate"; so "the team is never working from stale records" }
  }
}

screen login "Sign In" {
  template auth               # what kind of screen it is
  layout   auth-split         # how it is laid out
  flows    [auth]             # which journeys it is part of — one or many
  story {
    as     "a signed-out user"
    want   "sign in with my email and password"
    so     "I can reach my work"
    accept [
      "the submit button stays disabled until both fields have something in them"
      "a failed attempt keeps the email filled in"
      "five failed attempts in a row locks the form for a minute"
    ]
  }
  note     "email + OTP, Google SSO"   # anything else specific to this screen
}

screen clients "Clients" {
  template table
  layout   table-advanced
  flows    [client_admin]
  story {
    as     "an operations admin"
    want   "see every client in one filterable table"
    so     "I can reach the right record without hunting through pages"
    accept [
      "the table paginates and never loads more than 50 rows at once"
      "clearing a filter returns to page 1 rather than an empty page 7"
      "an empty result says what to change, not 'no data'"
    ]
  }

  # OPTIONAL — the pieces inside the screen. Add them where a screen carries
  # real behaviour; leave them off for simple screens.
  module filters   "Filter bar"   { kind filters; on "page load" }
  module table     "Client table" { kind table }
  module add_modal "Add client"   { kind modal; on "click Add Client" }

  # movement *inside* the screen, with no route change
  inner {
    filters   -> table : "on filter change, refetch page 1"
    table     -> add_modal : "click Add Client"
    add_modal -> table : "on save, close and refetch"
  }
}

screen dashboard "Dashboard" { template dashboard; layout dashboard-sidebar; flows [auth, client_admin] }
screen team      "Team"      { template admin; layout table-basic; in [admin]; flows [client_admin] }

# A phone screen. No "surface" line means web; the "landing" block is the
# public marketing page; "surface backend" is a service rather than a UI.
screen app_home "Today" { template dashboard; layout mobile-tabs; surface mobile; flows [client_admin] }

# Every screen a \`flow\` line mentions must be declared, and tagged.
screen client_new "New Client" { template form; layout form-sidebar-summary; flows [client_admin] }

# movement *between* screens — a real route change
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
\`→\`, and \`# \` starts a comment. Multi-line text uses \`"""\` fences. Inside a
\`story\`, \`accept [ … ]\` may run over several lines with one quoted criterion
per line, and a short story fits on one line with semicolons between its parts.

# Valid values

## targets
${promptTargets.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## design languages (theme \`design\`)
${designLanguages.map((d) => `- ${d.id} — ${d.tagline}`).join("\n")}

## screen templates
${screenTemplates.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

## screen layouts
${screenLayoutIds.map((l) => `- ${l}`).join("\n")}

## module kinds
${moduleKinds.map((k) => `- ${k.id} — ${k.description}`).join("\n")}

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

# Worked example — one product, two builds

\`\`\`
app "FieldOps" {
  target claude-code
  creativity 5
  theme { design modern-soft; primary #0891b2; secondary #f97316; radius large }
}

views { dispatcher "Dispatcher"; engineer "Field Engineer" }

flows {
  flow access "Getting in" {
    story {
      as     "anyone on the team"
      want   "sign in on whichever device I am holding"
      so     "I can start work without finding a laptop"
      accept [
        "the same credentials work on the phone app and the web console"
        "a failed sign in says what to do next, not just that it failed"
      ]
    }
  }
  flow dispatching "Dispatching work" {
    story {
      as     "a dispatcher"
      want   "see every open job and put the right engineer on each one"
      so     "nobody is sent across the county for a ten minute call"
      accept [
        "an unassigned job is visible without filtering for it"
        "assigning a job reaches the engineer's phone without them refreshing"
      ]
    }
  }
  flow on_site "Doing the job" {
    story {
      as     "a field engineer"
      want   "update a job and attach proof while I am standing in front of it"
      so     "I never write the same thing twice in the van afterwards"
      accept [
        "a status change made with no signal is kept and sent when signal returns"
        "the app says plainly when something is queued rather than saved"
        "declining the camera permission leaves a way to finish without a photo"
      ]
    }
  }
}

# ---- web console (no surface line = web) ----
screen login     "Sign In"    { template auth;      layout auth-split;        flows [access] }
screen board     "Dispatch"   { template dashboard; layout dashboard-sidebar; in [dispatcher]; flows [dispatching] }
screen jobs      "All Jobs"   { template table;     layout table-advanced;    in [dispatcher]; flows [dispatching] }

# ---- phone app ----
screen app_signin "Sign In"  { template auth;      layout mobile-auth;   surface mobile; flows [access] }
screen app_today  "Today"    { template dashboard; layout mobile-tabs;   surface mobile; in [engineer]; flows [on_site] }
screen app_job    "Job"      {
  template detail
  layout   mobile-detail
  surface  mobile
  in [engineer]
  flows [on_site]
  story {
    as     "a field engineer standing on site"
    want   "change the job status and add a photo in a few taps"
    so     "the office knows where things are without me phoning them"
    accept [
      "the status sheet opens over the job without losing my place"
      "a photo taken with no signal is queued, and the screen says so"
      "the sticky actions stay reachable one-handed on a small phone"
    ]
  }
  module actions "Sticky actions" { kind action }
  module sheet   "Update status"  { kind sheet;      on "tap Update status" }
  module camera  "Photo proof"    { kind camera;     on "tap Add photo" }
  module perms   "Camera access"  { kind permission; on "first photo attempt" }
  inner {
    actions -> sheet  : "tap Update status"
    sheet   -> camera : "choose Add photo"
    camera  -> perms  : "permission not granted yet"
  }
}

flow {
  login      -> board    : "on successful sign in" @dispatcher
  board      -> jobs     : "click All jobs"
  app_signin -> app_today : "on successful sign in" @engineer
  app_today  -> app_job   : "tap a job"
}

stack { framework next-16; styling tailwind4-shadcn; state tanstack-zustand }
structure feature-based

requirements """
Two builds, one product. Engineers use the phone app offline in poor signal;
dispatchers use the web console. The phone app's mobile stack is Expo Router +
NativeWind (set it on the Mobile tab in Prompt Studio after importing).
Job status updates queue on the device and sync when the network returns.
"""
\`\`\`

# Worked example — internal admin app

\`\`\`
app "Acme Ops Console" {
  target claude-code
  creativity 5
  theme { primary #2563eb; secondary #10b981; radius md; buttons filled }
}

flows {
  flow auth "Authentication" {
    story {
      as     "an agent starting a shift"
      want   "sign in and land where I left off"
      so     "I am not clicking through menus before I can take the first call"
      accept [
        "signing in goes straight to Operations"
        "a wrong password does not say whether the address exists"
      ]
    }
  }
  flow order_handling "Handling an order" {
    story {
      as     "a support agent"
      want   "find an order and see everything that has happened to it"
      so     "I can answer the customer on the first call"
      accept [
        "an order is findable by its number, the customer's email, or both"
        "the detail screen shows the full history, newest first"
      ]
    }
  }
  flow refunds "Issuing a refund" {
    story {
      as     "a supervisor"
      want   "refund a charge and have it recorded against the order"
      so     "the next person to open it can see what was done and by whom"
      accept [
        "an agent who is not a supervisor sees the button disabled with the reason"
        "a refund cannot be submitted twice by double-clicking"
        "every refund writes an audit entry visible on the order detail screen"
      ]
    }
  }
}

screen login     "Sign In"        { template auth;      layout auth-split;         flows [auth] }
screen dashboard "Operations"     { template dashboard; layout dashboard-sidebar;  flows [auth, order_handling] }
screen orders    "Orders"         { template table;     layout table-advanced;     flows [order_handling] }
screen order     "Order Detail"   { template detail;    layout detail-two-column;  flows [order_handling, refunds] }
screen refund    "Issue Refund"   { template form;      layout form-sidebar-summary; flows [refunds] }
screen settings  "Settings"       { template settings;  layout settings-sections;  flows [order_handling] }

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

flows {
  flow convert "Starting a trial" {
    story {
      as     "someone who arrived from a search result"
      want   "understand what this is and start using it"
      so     "I can judge it myself instead of booking a call"
      accept [
        "the first screen states what the product does without scrolling"
        "the trial can be started without entering card details"
        "pricing is reachable from anywhere on the page"
      ]
    }
  }
}

screen home "Home" {
  template landing
  layout   hero-two-column
  flows    [convert]
  story {
    as     "a first-time visitor"
    want   "see what this does and what it costs"
    so     "I can decide in under a minute"
    accept [
      "there is one obvious next action above the fold"
      "no pricing claim appears that the pricing section contradicts"
    ]
  }
}

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

Now write the Flow file for the requirements provided. Both diagrams — the whole
app, and the flows — and a story on every screen and every flow.`
}
