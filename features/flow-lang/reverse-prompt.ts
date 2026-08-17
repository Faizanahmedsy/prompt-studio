import { allLayouts } from "@/features/library/data/layouts"
import { moduleKinds } from "@/features/library/data/module-kinds"
import { screenTemplates } from "@/features/library/data/templates"

/**
 * The prompt a developer runs *inside an existing repository*, with a coding
 * agent that can read the code. This is the highest-traffic prompt the tool
 * produces — most projects arrive as an existing codebase, not a blank page.
 *
 * Everything here is shaped by one difference from the authoring prompt: that
 * one invents a flow, this one *reports* one. So the agent is given a
 * mechanical discovery procedure with real commands, an enumerate-then-describe
 * order that survives a codebase far larger than its context, a rule that every
 * claim cites the file it came from, and a self-check that compares the file it
 * wrote against the route count it started with. A diagram that looks right but
 * does not match the code is the failure mode worth spending words on: nobody
 * audits a plausible picture.
 */
export function buildReverseEnginePrompt(): string {
  const screenLayoutIds = allLayouts
    .filter((l) => l.scope === "screen")
    .map((l) => l.id)

  return `# Role

You are mapping an **existing codebase** into a Flow file — a small declarative
language describing an application's screens, what lives inside each screen, and
how a user (or a request) moves between them.

The output is pasted into Prompt Studio, which renders it as an editable
diagram. You are writing **source code for a tool**, not documentation for a
human.

# The one rule that matters

**Report what the code does. Never write a line you have not verified by
reading the file.**

A Flow file that looks plausible but does not match the code is worse than no
file at all, because nobody re-checks a diagram that looks finished. If you
cannot confirm something, either leave it out or mark it \`?\` in the note — both
are acceptable. Guessing is not.

Concretely, this means:
- Do not infer a screen's contents from its filename or route name.
- Do not assume a CRUD app has create/edit/delete screens. Look.
- Do not invent a connection because it "must" exist. Find the \`push\`, the
  \`redirect\`, the \`<Link>\`, or leave the screens unconnected.
- Do not normalise what you find. If two screens do the same thing in two
  different ways, that is a finding — record both.

---

# Phase 0 — identify the repository

Read \`package.json\` / \`pyproject.toml\` / \`go.mod\` / \`pom.xml\`, the framework
config, and the top-level folder list. Establish:

- **Frontend or backend?** If the repo contains both (a monorepo, or a
  full-stack framework), map the **frontend** and put
  \`# NOTE: frontend only; backend mapped separately\` as the first line.
  Never mix the two in one file — they are two projects in this tool.
- **Web, mobile or backend?** A React Native or Swift repo is mapped with the
  same grammar but different discovery — see Phase 1b. Tells:
  \`react-native\` / \`expo\` in \`package.json\`, an \`app.json\` / \`app.config.ts\`,
  an \`ios/\` + \`android/\` pair, a \`.xcodeproj\` / \`.xcworkspace\`,
  \`Package.swift\`, or \`.swift\` files under a \`Features/\` or \`Views/\` folder.
- **Which router?** App Router, Pages Router, React Router, Vue Router, Angular
  routes, Expo Router, React Navigation, SwiftUI \`NavigationStack\`, UIKit
  storyboards, or a backend controller registry. Everything downstream depends
  on getting this right.
- **The app root.** \`src/app\`, \`app/\`, \`src/pages\`, \`apps/web/src/app\`, …

Set \`stack { … }\` from what the manifest and config actually show, never from
what you would have chosen. Read the dependency list; do not guess versions.

---

# Phase 1 — enumerate EVERY route first, before describing any of them

This ordering is not optional. Produce the complete list first, then describe
entries one at a time. An agent that starts describing screen 1 in depth runs
out of room and silently stops at screen 12 — enumerating first means you know
the target number and can tell when you have missed some.

Use the search tools. Examples — adapt to the repo:

\`\`\`bash
# Next.js App Router — every route is a page/route file
rg --files -g '**/app/**/page.{tsx,ts,jsx,js}'
rg --files -g '**/app/**/route.{ts,js}'          # API handlers
rg --files -g '**/app/**/{layout,template,loading,error,not-found}.tsx'

# Next.js Pages Router
rg --files -g '**/pages/**/*.{tsx,jsx}' -g '!**/pages/api/**'
rg --files -g '**/pages/api/**/*.{ts,js}'

# React Router / Vue / Angular — routes are declared, not filed
rg -n 'createBrowserRouter|<Route|useRoutes|RouterModule.forRoot|routes\\s*[:=]'

# Backend
rg -n '@(Get|Post|Put|Patch|Delete|Controller)\\('        # Nest
rg -n "(router|app)\\.(get|post|put|patch|delete)\\("      # Express/Koa
rg -n '@(app|router)\\.(get|post|put|patch|delete)'       # FastAPI
rg -n 'path\\(|re_path\\(|urlpatterns'                     # Django
\`\`\`

Write the list down before continuing. **State the count.** You will check
against it at the end.

## Phase 1b — mobile repositories

### React Native — Expo Router (file-based)

Routes are files under \`app/\`, the same idea as Next but with navigator groups.

\`\`\`bash
rg --files -g '**/app/**/*.{tsx,jsx}' -g '!**/app/**/_layout.*'
rg --files -g '**/app/**/_layout.tsx'     # the navigators themselves
\`\`\`

- \`app/(tabs)/clients/index.tsx\` → key \`clients\`. Group folders in parentheses
  are navigators, **not** path segments.
- \`_layout.tsx\` declares a navigator (\`<Tabs>\`, \`<Stack>\`, \`<Drawer>\`) — it is
  **not a screen**. Read it to learn the tab set and the initial route; record
  the tab bar as a module on the screen it belongs to, not on all of them.
- \`app/clients/[id].tsx\` → one screen, \`client_detail\`.
- A route presented as a modal (\`presentation: 'modal'\` in its options, or a
  \`(modals)\` group) is still a screen — the route changed — but say so in the
  note.

### React Native — React Navigation (declared in code)

There is no file tree to read; the navigators are the source of truth.

\`\`\`bash
rg -n 'createNativeStackNavigator|createBottomTabNavigator|createDrawerNavigator'
rg -n '<Stack.Screen|<Tab.Screen|<Drawer.Screen'   # every screen + its name
rg -n 'navigation\.(navigate|push|replace|goBack|popTo)'
\`\`\`

Every \`<Stack.Screen name="...">\` is one screen; the \`component\` prop points at
the file to read.

### Native iOS — SwiftUI

\`\`\`bash
rg -n 'NavigationStack|NavigationSplitView|TabView|navigationDestination'
rg -n '\.sheet\(|\.fullScreenCover\(|\.popover\(|\.alert\(|\.confirmationDialog\('
rg --files -g '**/*View.swift'
\`\`\`

- A screen is a top-level \`View\` pushed by \`navigationDestination\`, held in a
  \`TabView\` tab, or presented by \`fullScreenCover\`.
- **\`.sheet\` and \`.popover\` are \`inner\`, not \`flow\`** — same rule as a web
  modal. \`fullScreenCover\` is a judgement call: treat it as a screen when it has
  its own navigation, otherwise as an \`inner\` module.
- Subviews extracted for readability (a row, a header) are **not** modules
  unless they own real behaviour. A SwiftUI file is full of small \`View\`
  structs; most are markup, not modules.
- Put the \`@Observable\` model or view model in the screen's note.

### Native iOS — UIKit

\`\`\`bash
rg -n ': UIViewController|: UITableViewController|: UICollectionViewController'
rg -n 'pushViewController|present\(|performSegue|instantiateViewController'
rg --files -g '**/*.storyboard'
\`\`\`

One view controller is one screen. \`pushViewController\`/\`performSegue\` are
\`flow\`; \`present(_:animated:)\` of a sheet or alert is \`inner\`.

### Tag the surface

Prompt Studio keeps the web app, the phone app and the backend as separate
**builds** in one project, each with its own stack and its own generated
prompt. Say which one a screen belongs to:

\`\`\`
screen app_home "Today" { template dashboard; layout mobile-tabs; surface mobile }
screen auth_svc "Auth"  { template admin;     surface backend }
screen home     "Home"  { template dashboard }          # no line = web
\`\`\`

One repository is normally one surface, so tag every screen the same way and
say which in the first line's comment. Only a monorepo containing more than one
needs a mix — and even then, never draw a \`flow\` arrow from one surface to
another. A phone screen calling an endpoint is an integration; record it in the
screen's note, not as a transition.

### What changes for mobile

- Use the \`mobile-*\` layouts (\`mobile-tabs\`, \`mobile-list\`, \`mobile-detail\`,
  \`mobile-form\`, \`mobile-sheet\`, \`mobile-onboarding\`, \`mobile-map\`,
  \`mobile-profile\`). A phone screen is never \`dashboard-sidebar\`.
- Extra module kinds that matter here: \`sheet\` (bottom sheet), \`permission\`
  (runtime permission ask), \`camera\`, \`map\`.
- Record in \`requirements\`: which permissions the app requests and where they
  are declared (\`app.json\`, \`Info.plist\`, \`AndroidManifest.xml\`), whether it
  works offline, push notification handling, deep-link scheme, and any
  Android/iOS behaviour that genuinely differs.
- Tag every screen \`surface mobile\`.
- Set \`stack\` from the real manifest — \`expo-router\` vs \`react-native\` vs
  \`swiftui\` vs \`uikit\`, and the native styling/list/chart options rather than
  the web ones.

---

## Turning file paths into screens

- The key is the route path, snake_cased: \`/clients/[id]/edit\` → \`client_edit\`,
  \`/settings/billing\` → \`settings_billing\`. Keys are unique and lowercase.
- **Route groups are not segments.** \`app/(dashboard)/clients/page.tsx\` is
  \`/clients\`, not \`/dashboard/clients\`.
- **A dynamic segment is one screen, not many.** \`[id]\` → one \`client_detail\`.
- **\`layout.tsx\` is not a screen.** Its shared chrome (sidebar, header) belongs
  to no single screen — do not list it as a module on all twelve children.
- **Parallel and intercepting routes** (\`@modal\`, \`(.)photo\`) are usually a
  *module* on the screen that intercepts them, not a screen of their own.
- \`loading.tsx\` / \`error.tsx\` are states of their screen, not screens. Mention
  them in the note.
- API \`route.ts\` files in a frontend repo are **not** screens. Note them on the
  screen that calls them.

---

# Phase 2 — for each screen, read it and record what is inside

Open the page/controller file **and** the components it imports from its own
feature folder. Then write the screen and its modules.

## What is a module

A distinct, separately-implemented piece of a screen — the thing a developer
would open its own file to change:

**Yes:** a data table · its filter/search bar · a create/edit dialog ·
a row-actions menu · a bulk-action bar · a tab set · a details panel · a chart ·
a KPI row · a file-upload drawer · a wizard step · a comments thread.

**No:** every \`<div>\`, \`<Card>\` or \`<Button>\` · the app sidebar, header or
footer that comes from a layout · a design-system primitive · a pure formatting
helper.

Rule of thumb: **3–10 modules on a busy screen, 0 on a simple one.** A login
page usually has none — one form is the screen. If you find yourself writing 25
modules for one screen, you have dropped to component level; go back up.

Set \`kind\` from what it actually is, and \`on\` to what the user does — read the
button label out of the JSX, or describe the moment the effect fires.
\`on "click Add Client"\` and \`on "page load"\` are good; \`on "user interaction"\`
is too vague, and \`on "setOpen('add')"\` is code (see the label rules below).

## \`inner\` vs \`flow\` — the distinction the whole file rests on

- **\`flow\`** = the **route changes**. \`router.push\`, \`redirect()\`,
  \`<Link href>\`, \`navigate()\`, a middleware/proxy redirect, a post-submit
  redirect, an auth guard bouncing to login.
- **\`inner\`** = **no route change**. Opening a modal or drawer, switching a tab,
  a filter refetching a table, a dialog closing and invalidating a query,
  selecting a row to populate a detail pane.

A modal opening is **always** \`inner\`, never \`flow\`. Getting this wrong is the
single most common way these files come out wrong.

Find the real transitions:

\`\`\`bash
rg -n "router\\.(push|replace)|redirect\\(|navigate\\(|permanentRedirect\\("
rg -n '<Link\\s|href=\\{'
rg -n 'proxy\\.ts|middleware\\.ts'          # route guards, auth redirects
rg -n 'useRouter|redirect' --glob '**/actions.ts'   # server actions
\`\`\`

## Connection labels are read by people, not by compilers

A label is what shows on the arrow in the diagram, and it is read by a product
manager as often as by a developer. Write **what a person does, or what happens
to them** — plain English, lower case, no full stop, ideally under six words.

The code is how you *found* the transition; it is not the label. Function names,
file paths, route literals, hook names and error constants belong in the
\`note\`, never on the arrow.

| Bad (what the code says) | Good (what the user experiences) |
|---|---|
| \`redirect() (app/(authenticated)/layout.tsx)\` | \`already signed in\` |
| \`router.push('/leads/all-leads')\` | \`click Leads in the sidebar\` |
| \`isVerificationPendingError(err)\` | \`email not verified yet\` |
| \`onSubmit → mutate() → onSuccess\` | \`on save\` |
| \`setOpen('add-customer')\` | \`click Add Customer\` |
| \`PermissionGate fallback <Navigate to="/403">\` | \`no permission for this page\` |
| \`useEffect guard, token invalid\` | \`reset link expired\` |

If a transition genuinely needs the mechanism recorded, put the label in plain
English and the mechanism in the source screen's \`note\`.

The same rule applies to a module's \`on\`: \`on "click Add Client"\`, not
\`on "useCustomersStore setOpen('add')"\`.

---

# Phase 2b — role views

Most real applications show different screens to different kinds of user. If the
codebase gates routes by role or permission — a \`PermissionGate\`, a guard, a
\`hasAccess(...)\` check, a role enum, a proxy/middleware redirect — capture that,
because it is usually the thing a reader most wants from the diagram.

\`\`\`
views {
  super_admin "Super Admin"
  admin       "Org Admin"
  field_rep   "Field Rep"
}

screen org_directory "Organizations" {
  template table
  in [super_admin]                 # only this role reaches it
}

screen sign_in "Sign In" { template auth }   # no tag = every role

flow {
  sign_in -> org_directory : "on sign in as super admin" @super_admin
  sign_in -> home          : "on sign in"                @admin @field_rep
}
\`\`\`

Rules:
- **Untagged means every role**, so untagged is a claim: "anyone signed in can
  open this". Only leave a screen bare when that is actually true — sign-in,
  the error screens, a settings page everyone has.
- **In a permission-gated app, most screens are tagged.** If a route sits behind
  a \`PermissionGate\`, a \`hasAccess(...)\` check, a role guard or a redirect,
  work out **which roles hold that permission** and tag it with all of them —
  not just the ones where it is exclusive. A screen only admins and managers can
  open is \`in [admin, manager]\`, even though neither is exclusive.
- The failure to avoid: tagging only the super-admin screens and leaving every
  admin screen bare. The reader then selects "Admin" and sees the whole app,
  which makes the view feature useless. If you tag one role's screens, you must
  work through the others.
- Where roles come from: the permission constants or role enum, the seed or
  migration that assigns permissions to roles, the guard decorators, or a
  role-permission matrix in the codebase. If the mapping genuinely is not in the
  repo, say so in \`requirements\` rather than guessing — but look first.
- Derive the roles from the code — the permission constants, the role enum, the
  guard names. Do not invent a role hierarchy the codebase does not have.
- Tag a \`flow\` connection with \`@role\` only when that transition differs by
  role, e.g. sign-in landing somewhere different per role.
- Put the permission constant itself in the screen's \`note\`
  (\`"CUSTOMER_DIRECTORY permission"\`), and keep the tag list to role keys.
- If the app has no role gating, omit the \`views\` block entirely.

---

# Phase 3 — backend repositories

Same grammar, service semantics. Do **not** invent new keywords.

- \`screen\` = a service / domain / module — Auth, Orders, Billing, Notifications.
  Set \`template\` to the nearest fit and **omit \`layout\`** (there is no UI).
- \`module\` = an endpoint, handler, scheduled job, queue consumer or event
  emitter. \`kind api\` for request handlers, \`kind job\` for background work.
  **Put the method and path in the name:** \`"POST /orders"\`, \`"GET /orders/:id"\`.
- \`flow\` = one service calling or depending on another (an HTTP call, an
  injected service from another domain, a published event another consumes).
  Label it with what triggers the call.
- \`inner\` = the sequence within a service: handler → validation → repository →
  emitted event.
- Record auth/roles per endpoint in its note — guards, decorators, middleware.

---

# Phase 4 — very large codebases

If the repository has more than ~40 routes, the answer is still **all of them**.
Do not sample, do not summarise a group into one screen, do not stop at "the
main ones". Instead:

1. Keep the Phase 1 list as your worklist and work through it in order.
2. Emit the file in **route-group batches** (auth, admin, billing, …). Finish
   each batch completely before starting the next.
3. If you genuinely cannot fit everything in one response, output the file for
   the batches you completed, end with
   \`# CONTINUES: <n> routes remaining — <list the keys>\`, and stop. The
   developer pastes each part with **Merge**, which matches screens by key and
   attaches rather than duplicating. A correct half is useful; a fabricated
   whole is not.
4. Depth is what gets cut under pressure, never coverage: a screen with a
   \`template\` and one note is fine, a missing screen is not.

---

# Output format

One fenced code block. No preamble, no closing summary, no "here is the flow
file".

\`\`\`
app "Name from package.json" {
  target claude-code
  creativity 3                # low: this describes real code, not a new design
  theme { design modern-soft; primary #2563eb }
}

screen clients "Clients" {
  template table
  layout   table-advanced
  note     "Server component; useClients() → GET /api/clients, paged. src: app/(app)/clients/page.tsx"

  module filters   "Filter bar"   { kind filters; on "page load"; note "URL-synced. src: features/clients/components/client-filters.tsx" }
  module table     "Client table" { kind table;   note "TanStack Table, server paging. src: features/clients/components/client-table.tsx" }
  module row_menu  "Row actions"  { kind action;  on "click the row overflow menu" }
  module add_modal "Add client"   { kind modal;   on "click Add Client"; note "RHF + zod. src: features/clients/components/add-client-dialog.tsx" }

  inner {
    filters   -> table     : "on filter change, refetch page 1"
    table     -> row_menu  : "click the row overflow menu"
    row_menu  -> add_modal : "choose Edit"
    add_modal -> table     : "on save, close and invalidate the query"
  }
}

screen client_detail "Client Detail" {
  template detail
  layout   detail-two-column
  note     "src: app/(app)/clients/[id]/page.tsx"
  module tabs     "Tabs"     { kind tabs }
  module activity "Activity" { kind list; on "select the Activity tab" }
  inner { tabs -> activity : "select the Activity tab" }
}

flow {
  login   -> clients       : "on successful login"
  clients -> client_detail : "click a client row"
}

stack {
  framework next-16
  styling   tailwind4-shadcn
  state     tanstack-zustand
  forms     rhf-zod
  http      axios-instance
}

structure feature-based

requirements """
Multi-tenant; every query is scoped by organisation id (proxy.ts + server checks).
Roles: admin, manager, agent.
Unmapped: /legacy/* — 4 routes, no longer linked from anywhere.
Known debt: the clients table paginates client-side above 500 rows.
"""
\`\`\`

Syntax: braces and semicolons are optional, \`->\` may be written \`→\`, \`# \`
starts a comment, \`"""\` fences multi-line text. **Module keys are unique within
their screen only** — two screens may each have a \`table\`.

## Citations

Every \`note\` ends with \`src: <path>\` — a path you actually opened. A screen or
module with no note is fine. A note with an invented path is a defect, and it is
the thing a reviewer will spot-check first.

## Valid values

Use only these ids. If nothing fits, pick the nearest — never invent one.
\`layout\` is a rough visual match, not a promise.

### screen templates
${screenTemplates.map((t) => `- ${t.id} — ${t.description}`).join("\n")}

### screen layouts
${screenLayoutIds.map((l) => `- ${l}`).join("\n")}

### module kinds
${moduleKinds.map((k) => `- ${k.id} — ${k.description}`).join("\n")}

---

# Before you output — verify

Check every line. Each is a way these files actually go wrong:

1. **Count.** Does your screen count match the route count from Phase 1? If it
   is lower, name the missing routes in \`requirements\` or go back and add them.
   Do not quietly ship a shorter file.
2. **Citations.** Does every note end in a path you opened?
3. **Evidence.** Is every \`flow\` connection traceable to a specific
   \`push\`/\`redirect\`/\`<Link>\`/guard you read?
4. **Level.** Is every route change in \`flow\` and every same-route change in
   \`inner\`? Search your own output for a modal, drawer or tab in a \`flow\` block —
   that is a bug.
5. **Labels.** Read every connection label and every module \`on\` on its own.
   Does it read as English a non-developer would understand? Any label
   containing \`()\`, a file path, a slash, a hook name or an error constant is
   wrong — move it to the note and write what the user does instead.
6. **Reachability.** Is every screen except the entry point the target of at
   least one connection? If one is unreachable, say so in its note — that is a
   real finding about the codebase, not something to paper over.
7. **Keys.** All lowercase snake_case, unique, derived from real route paths?
   Did route groups leak into any of them?
8. **Invention.** Is there anything in the file you did not read? Delete it.
9. **Roles.** If the codebase gates by role: is there a \`views\` block, and did
   you tag **every** gated screen with the roles that can reach it — not only
   the exclusive ones? Count them. If most screens came out untagged in an app
   that gates almost every route, you have under-tagged, and selecting a role
   will show the whole app. A screen tagged with literally every role is the
   same as untagged — leave that one bare.
10. **Stack.** Does it match the manifest rather than your defaults?

Now read the repository and write the Flow file.`
}
