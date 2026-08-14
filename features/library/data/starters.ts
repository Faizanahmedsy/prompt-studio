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
snippets [a11y, states, tables, api-hooks, pagination]`,
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
screen users     "Users"        { template table;     layout table-master-detail }
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
snippets [a11y, states, tables, rbac, api-hooks, pagination]

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
    name: "Mobile-first app",
    description: "Phone-shaped screens with a tab bar.",
    source: `app "Mobile App" {
  target claude-code
  creativity 7
  theme { primary #0891b2; secondary #f97316; radius full; buttons rounded }
}

screen onboarding "Get Started" { template onboarding; layout mobile-first }
screen signin     "Sign In"     { template auth;       layout auth-minimal }
screen feed       "Home"        { template dashboard;  layout dashboard-cards }
screen detail     "Item"        { template detail;     layout detail-hero }
screen profile    "Profile"     { template profile;    layout profile-tabs }

flow {
  onboarding -> signin  : "tap Get started"
  signin     -> feed    : "on successful login"
  feed       -> detail  : "tap a card"
  feed       -> profile : "tap the profile tab"
}

structure feature-based
conventions [kebab-files, alias-@, a11y-baseline, tokens-only]
snippets [responsive, a11y, states]`,
  },
]

export function starterDoc(id: string): ProjectDoc | null {
  const starter = starters.find((s) => s.id === id)
  if (!starter) return null
  const { doc } = parseFlow(starter.source)
  return { ...doc, name: starter.name }
}
