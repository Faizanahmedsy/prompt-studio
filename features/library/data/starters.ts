import { parseFlow } from "@/features/flow-lang/parser"
import type { ProjectDoc } from "@/types/project"

export type Starter = {
  id: string
  name: string
  description: string
  source: string
}

/**
 * Starter projects are authored in Flow source rather than as object literals —
 * one representation, and every starter doubles as a parser fixture.
 */
export const starters: Starter[] = [
  {
    id: "blank",
    name: "Blank project",
    description: "Empty canvas — start from nothing.",
    source: `app "Untitled project" {
  target claude-code
  creativity 5
}`,
  },
  {
    id: "saas-dashboard",
    name: "SaaS dashboard",
    description: "Auth, dashboard, records, detail, settings.",
    source: `app "SaaS Dashboard" {
  target claude-code
  creativity 5
  theme { primary #4f46e5; secondary #0ea5e9; radius md; buttons filled }
}

screen login     "Sign In"     { template auth;      layout auth-split }
screen dashboard "Dashboard"   { template dashboard; layout dashboard-sidebar }
screen records   "Records"     { template table;     layout table-advanced }
screen record    "Record"      { template detail;    layout detail-two-column }
screen record_new "New Record" { template form;      layout form-two-column }
screen settings  "Settings"    { template settings;  layout settings-sections }

flow {
  login      -> dashboard  : "on successful login"
  dashboard  -> records    : "click Records"
  records    -> record     : "click a row"
  records    -> record_new : "click New record"
  record_new -> records    : "on save"
  dashboard  -> settings   : "open the account menu"
}

structure feature-based
conventions [kebab-files, barrel-exports, alias-@, states-required, a11y-baseline, tokens-only]
snippets [a11y, states, tables, data-table-shell, api-hooks, pagination]`,
  },
  {
    id: "auth-flow",
    name: "Authentication flow",
    description: "Sign in, sign up, OTP, reset, first run.",
    source: `app "Authentication" {
  target claude-code
  creativity 4
  theme { primary #0f766e; secondary #f59e0b; radius md; buttons filled }
}

screen login    "Sign In"          { template auth; layout auth-split }
screen signup   "Create Account"   { template auth; layout auth-center }
screen otp      "Verify Email"     { template auth; layout auth-otp }
screen forgot   "Forgot Password"  { template auth; layout auth-minimal }
screen reset    "Set New Password" { template auth; layout auth-center }
screen welcome  "Welcome"          { template onboarding; layout onboarding-checklist }

flow {
  login  -> signup  : "click Create account"
  signup -> otp     : "on submit"
  otp    -> welcome : "on code verified"
  login  -> forgot  : "click Forgot password"
  forgot -> reset   : "click the emailed link"
  reset  -> login   : "on password changed"
}

structure feature-based
conventions [kebab-files, alias-@, states-required, a11y-baseline]
snippets [a11y, forms, states]

requirements """
Rate-limit OTP resend to once every 30 seconds and show the countdown.
Never reveal whether an email address exists on the forgot-password screen.
"""`,
  },
  {
    id: "admin-crud",
    name: "Admin CRUD",
    description: "Master/detail, bulk actions, audit.",
    source: `app "Admin Console" {
  target claude-code
  creativity 4
  theme { primary #1d4ed8; secondary #059669; radius sm; buttons filled; density compact }
}

screen login     "Sign In"      { template auth;      layout auth-center }

screen users "Users" {
  template table
  layout   table-master-detail

  module filters   "Filter bar"    { kind filters; on "page load" }
  module table     "User table"    { kind table;   note "server-driven paging, 25 per page" }
  module row_menu  "Row actions"   { kind action;  on "click the row overflow menu" }
  module bulk      "Bulk actions"  { kind action;  on "select one or more rows" }
  module deactivate "Deactivate"   { kind modal;   on "choose Deactivate" }

  inner {
    filters  -> table      : "on filter change, refetch page 1"
    table    -> row_menu   : "click the row overflow menu"
    table    -> bulk       : "select one or more rows"
    row_menu -> deactivate : "choose Deactivate"
    deactivate -> table    : "on confirm, close and refetch"
  }
}

screen user_new  "Invite User"  { template form;      layout form-single }
screen roles     "Roles"        { template admin;     layout table-advanced }
screen audit     "Audit Log"    { template table;     layout table-basic }
screen settings  "Settings"     { template settings;  layout settings-sections }

flow {
  login    -> users    : "on successful login"
  users    -> user_new : "click Invite user"
  user_new -> users    : "on invite sent"
  users    -> roles    : "click Roles"
  roles    -> audit    : "click Audit log"
  users    -> settings : "open settings"
}

structure feature-based
conventions [kebab-files, barrel-exports, no-deep-imports, alias-@, states-required, a11y-baseline]
snippets [a11y, states, tables, data-table-shell, rbac, api-hooks, pagination]

requirements """
Every destructive action names the record in its confirmation and writes an audit entry.
"""`,
  },
  {
    id: "marketing-site",
    name: "Marketing site",
    description: "Full landing page, section by section.",
    source: `app "Marketing Site" {
  target v0
  creativity 8
  theme { primary #7c3aed; secondary #f59e0b; radius lg; buttons rounded; density spacious }
}

screen home    "Home"    { template landing; layout hero-two-column }
screen pricing "Pricing" { template landing; layout hero-center }
screen contact "Contact" { template form;    layout form-single }

flow {
  home    -> pricing : "click Pricing"
  pricing -> contact : "click Talk to sales"
}

landing {
  section navigation   "Header"       layout nav-split
  section hero         "Hero"         layout hero-two-column
  section logos        "Trusted by"   layout logos-strip
  section features     "Features"     layout features-bento
  section stats        "By the numbers" layout stats-row
  section testimonials "Customers"    layout testimonials-cards
  section pricing      "Pricing"      layout pricing-three
  section faq          "FAQ"          layout faq-accordion
  section cta          "Get started"  layout cta-banner
  section footer       "Footer"       layout footer-columns
}

structure route-colocated
conventions [kebab-files, shared-first, tokens-only, a11y-baseline]
snippets [responsive, a11y]`,
  },
  {
    id: "checkout",
    name: "Commerce checkout",
    description: "Product, cart, checkout, confirmation.",
    source: `app "Storefront Checkout" {
  target claude-code
  creativity 6
  theme { primary #db2777; secondary #0ea5e9; radius lg; buttons rounded }
}

screen catalogue "Catalogue"    { template search;   layout search-results }
screen product   "Product"      { template product;  layout product-gallery }
screen cart      "Cart"         { template table;    layout table-basic }
screen checkout  "Checkout"     { template checkout; layout checkout-steps }
screen confirm   "Order Placed" { template empty;    layout empty-first-run }

flow {
  catalogue -> product  : "click a product"
  product   -> cart     : "click Add to cart"
  cart      -> checkout : "click Checkout"
  checkout  -> confirm  : "on payment accepted"
  confirm   -> catalogue: "click Continue shopping"
}

structure feature-based
conventions [kebab-files, alias-@, states-required, a11y-baseline, tokens-only]
snippets [a11y, states, forms, responsive, api-hooks]

requirements """
The order summary stays visible at every checkout step, including on mobile.
Payment failures return to the payment step with the entered details preserved.
"""`,
  },
  {
    id: "mobile-app",
    name: "React Native app",
    description: "Expo Router, tabs, offline-aware.",
    source: `app "Field App" {
  target claude-code
  creativity 6
  theme { design modern-soft; primary #0891b2; secondary #f97316; radius large; buttons rounded }
}

screen onboarding "Get Started" { template onboarding; layout mobile-onboarding; surface mobile }
screen signin     "Sign In"     { template auth;       layout mobile-form; surface mobile }

screen home "Today" {
  template dashboard
  layout   mobile-tabs
  surface  mobile
  module tabs   "Tab bar"      { kind nav }
  module stats  "Today's jobs" { kind stats }
  module list   "Job list"     { kind list; on "screen focus" }
  module offline "Offline banner" { kind panel; on "network drops" }
  inner {
    list -> offline : "request fails while offline"
  }
}

screen job "Job Detail" {
  template detail
  layout   mobile-detail
  surface  mobile
  module summary "Job summary"   { kind panel }
  module actions "Sticky actions" { kind action }
  module sheet   "Update status"  { kind sheet; on "tap Update status" }
  module camera  "Photo proof"    { kind camera; on "tap Add photo" }
  module perms   "Camera permission" { kind permission; on "first photo attempt" }
  inner {
    actions -> sheet  : "tap Update status"
    sheet   -> camera : "choose Add photo"
    camera  -> perms  : "camera permission not granted yet"
    sheet   -> summary : "on save, close and refresh"
  }
}

screen map "Route Map" {
  template dashboard
  layout   mobile-map
  surface  mobile
  module map_view "Map"          { kind map }
  module sheet    "Stops sheet"  { kind sheet }
  module perms    "Location permission" { kind permission; on "screen open" }
  inner {
    perms -> map_view : "permission granted"
    map_view -> sheet : "tap a marker"
  }
}

screen profile "Profile" { template profile; layout mobile-profile; surface mobile }

flow {
  onboarding -> signin  : "tap Get started"
  signin     -> home    : "on successful sign in"
  home       -> job     : "tap a job"
  home       -> map     : "tap the Map tab"
  home       -> profile : "tap the Profile tab"
  job        -> home    : "on job completed"
}

stack {
  framework expo-router
  language  ts-strict
  styling   nativewind
  state     rn-query-zustand
  forms     rhf-zod
  http      axios-instance
  icons     rn-vector-icons
  tables    rn-flashlist
  charts    victory-native
  testing   rn-testing-library
}

structure expo-feature-based
conventions [kebab-files, barrel-exports, alias-@, shared-first, reuse-components, states-required]
snippets [states, api-hooks, forms]

requirements """
Field engineers use this on Android in poor signal. Job data is cached and the
app opens with the last known list; status updates queue and sync when the
network returns.
Permissions: location (background while on a job), camera, notifications.
"""`,
  },
  {
    id: "swift-app",
    name: "SwiftUI app",
    description: "NavigationStack, sheets, Swift Charts.",
    source: `app "Swift Client" {
  target claude-code
  creativity 5
  theme { design minimal-mono; primary #0a84ff; secondary #30d158; radius large; buttons filled }
}

screen signin "Sign In" { template auth; layout mobile-form; surface mobile }

screen home "Overview" {
  template dashboard
  layout   mobile-tabs
  surface  mobile
  module tabs  "Tab view"    { kind nav }
  module cards "Summary"     { kind stats }
  module chart "Trend chart" { kind chart }
}

screen clients "Clients" {
  template list
  layout   mobile-list
  surface  mobile
  module search "Searchable list" { kind filters }
  module list   "Client list"     { kind list }
  module add    "Add client"      { kind sheet; on "tap the plus button" }
  inner {
    search -> list : "on search text change"
    list   -> add  : "tap the plus button"
    add    -> list : "on save, dismiss and refresh"
  }
}

screen client "Client Detail" {
  template detail
  layout   mobile-detail
  surface  mobile
  module header  "Header"      { kind panel }
  module history "Visit history" { kind timeline }
  module edit    "Edit sheet"  { kind sheet; on "tap Edit" }
  inner {
    header -> edit : "tap Edit"
  }
}

screen settings "Settings" { template settings; layout mobile-profile; surface mobile }

flow {
  signin  -> home     : "on successful sign in"
  home    -> clients  : "tap the Clients tab"
  clients -> client   : "tap a client row"
  home    -> settings : "tap the Settings tab"
}

stack {
  framework swiftui
  language  swift
  styling   swiftui-modifiers
  state     swift-observable
  http      swift-urlsession
  icons     sf-symbols
  tables    swift-list
  charts    swift-charts
  testing   swift-testing
  tooling   swiftlint
}

structure swift-features
conventions [shared-first, reuse-components, typed-payloads, small-files, comments-why]

requirements """
Supports the two most recent major iOS versions.
Dynamic Type up to the accessibility sizes; light and dark from the asset catalogue.
Offline reads come from the local store; writes retry when connectivity returns.
"""`,
  },
]

export function starterDoc(id: string): ProjectDoc | null {
  const starter = starters.find((s) => s.id === id)
  if (!starter) return null
  const { doc } = parseFlow(starter.source)
  return { ...doc, name: starter.name }
}
