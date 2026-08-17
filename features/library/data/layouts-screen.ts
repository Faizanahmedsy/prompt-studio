import type { LayoutOption } from "./layout-types"
import {
  avatarRow,
  bar,
  card,
  chart,
  circle,
  col,
  field,
  frame,
  grid,
  heading,
  pill,
  row,
  spacer,
  sub,
  table,
} from "./wire-helpers"

/** Left navigation rail used by most app-shell layouts. */
const rail = (width = 22) =>
  col(
    [
      bar(70, "accentLine", 2),
      spacer(0),
      bar(90, "accentSoft"),
      bar(80, "line"),
      bar(85, "line"),
      bar(60, "line"),
    ],
    { gap: 1, pad: 1, tone: "surface", rounded: true, h: 100, grow: 0, w: width }
  )

const topbar = () =>
  row([bar(18, "strong", 2), spacer(1), bar(10, "line"), circle("sm", "accentLine")], {
    gap: 1,
    pad: 1,
    tone: "surface",
    rounded: true,
  })

const kpis = (n = 3) =>
  grid(
    n,
    (i) =>
      col([bar(52, "line"), bar(38, i === 0 ? "accent" : "strong", 2)], {
        gap: 1,
        pad: 1,
        tone: "surface",
        rounded: true,
        border: true,
      }),
    { gap: 1, h: 32 }
  )

export const screenLayouts: LayoutOption[] = [
  // ---------------------------------------------------------- authentication
  {
    id: "auth-center",
    name: "Centered Auth",
    description: "Single centred card — logo, fields, primary action.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A centred authentication card on a plain background: brand logo, heading, email and password fields, a full-width primary submit button, an inline error slot, and secondary links for forgot-password and sign-up.",
    wire: col(
      [
        spacer(1),
        col(
          [
            circle("md", "accent"),
            heading(56),
            field(),
            field(),
            pill(100),
            bar(48, "line"),
          ],
          { gap: 1, pad: 2, tone: "surface", border: true, rounded: true, align: "center", w: 62 }
        ),
        spacer(1),
      ],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "auth-split",
    name: "Split Screen Auth",
    description: "Form one side, branded panel the other.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A 50/50 split authentication screen: the form (logo, heading, fields, submit, alternate-provider buttons) on the left, and a branded panel with an illustration plus a short value proposition on the right. The branded panel collapses on mobile.",
    wire: row(
      [
        col([circle("sm", "accentLine"), heading(70), field(), field(), pill(60)], {
          gap: 1,
          pad: 1,
          grow: 1,
        }),
        col([heading(70), sub(90), sub(60), spacer(1), bar(40, "accentLine")], {
          gap: 1,
          pad: 2,
          tone: "accentSoft",
          rounded: true,
          grow: 1,
          align: "center",
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "auth-minimal",
    name: "Minimal Auth",
    description: "No card, generous whitespace, one field at a time.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A minimal authentication screen with no card chrome: small wordmark, one large heading, a single email field with an inline continue button, and provider buttons underneath. Generous vertical whitespace.",
    wire: col(
      [spacer(1), heading(50), sub(34), field(false, 70), pill(30), spacer(1)],
      { gap: 1, align: "center" }
    ),
  },
  {
    id: "auth-otp",
    name: "OTP / Verification",
    description: "Code entry boxes with resend timer.",
    category: "Authentication",
    scope: "screen",
    templates: ["auth"],
    promptDetails:
      "A verification screen with six single-character OTP inputs that auto-advance and accept paste, a masked destination line, a resend link with a countdown, and a verify button that is disabled until the code is complete.",
    wire: col(
      [
        spacer(1),
        heading(48),
        sub(62),
        grid(6, bar(100, "surface", 3), { gap: 1, h: 18 }),
        pill(40),
        bar(30, "line"),
        spacer(1),
      ],
      { gap: 1, align: "center" }
    ),
  },

  // -------------------------------------------------------------- dashboards
  {
    id: "dashboard-sidebar",
    name: "Sidebar Dashboard",
    description: "Left nav rail, KPI row, chart and table.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard", "admin", "settings"],
    promptDetails:
      "An app shell with a collapsible left sidebar (grouped nav items, active state, user block at the bottom), a top bar with breadcrumbs and search, then a KPI card row, a primary chart, and a recent-activity table in the content area.",
    wire: row(
      [
        rail(),
        col([topbar(), kpis(3), chart("bars", { grow: 1 }), table({ rows: 2, cols: 4 })], {
          gap: 1,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "dashboard-topnav",
    name: "Top Nav Dashboard",
    description: "Horizontal nav, full-width content.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard", "admin"],
    promptDetails:
      "A dashboard with horizontal top navigation (logo, primary links, search, notifications, avatar menu) and full-width content below: a filter bar, a KPI row, and two charts side by side.",
    wire: frame(
      col(
        [
          row([bar(16, "strong", 2), spacer(1), bar(8, "line"), bar(8, "line"), circle("sm")], {
            gap: 1,
          }),
          kpis(4),
          row([chart("line", { grow: 2 }), chart("donut", { grow: 1 })], { gap: 1, grow: 1 }),
        ],
        { gap: 1 }
      ),
      "browser"
    ),
  },
  {
    id: "dashboard-cards",
    name: "Card Grid Dashboard",
    description: "Equal-weight metric cards in a grid.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard"],
    promptDetails:
      "A card-grid dashboard: a responsive grid of equally weighted metric cards, each with a label, a large value, a delta chip and a sparkline. Cards reflow 4 → 2 → 1 across breakpoints.",
    wire: col(
      [
        row([bar(24, "strong", 2), spacer(1), pill(14)], { gap: 1 }),
        grid(
          3,
          (i) =>
            col([bar(50, "line"), bar(40, "strong", 2), bar(70, i % 2 ? "accentLine" : "accent")], {
              gap: 1,
              pad: 1,
              tone: "surface",
              border: true,
              rounded: true,
            }),
          { cols: 3, rows: 2, gap: 1, grow: 1 }
        ),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "dashboard-analytics",
    name: "Analytics Dashboard",
    description: "Chart-first with a filter rail.",
    category: "Dashboard",
    scope: "screen",
    templates: ["dashboard"],
    promptDetails:
      "An analytics-first dashboard: a date-range and segment filter bar pinned at the top, one large primary chart, a legend with toggleable series, and a breakdown table beneath it.",
    wire: col(
      [
        row([pill(16, "accentSoft"), pill(16, "accentSoft"), spacer(1), bar(12, "line")], {
          gap: 1,
        }),
        chart("line", { grow: 2 }),
        row([table({ cols: 3, rows: 3, grow: 2 }), chart("donut", { grow: 1 })], { gap: 1, grow: 2 }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------- forms
  {
    id: "form-single",
    name: "Single Column Form",
    description: "One field per row, sticky actions.",
    category: "Forms",
    scope: "screen",
    templates: ["form"],
    promptDetails:
      "A single-column form on a centred content column: section heading, labelled fields stacked one per row with inline validation messages, a helper text slot, and a sticky footer with cancel and save actions.",
    wire: col(
      [heading(40), field(), field(), field(), spacer(1), row([spacer(1), pill(18, "accentSoft"), pill(18)], { gap: 1 })],
      { gap: 1 }
    ),
  },
  {
    id: "form-two-column",
    name: "Two Column Form",
    description: "Paired fields, full-width for long inputs.",
    category: "Forms",
    scope: "screen",
    templates: ["form", "onboarding"],
    promptDetails:
      "A two-column form: related short fields sit side by side (first/last name, city/postcode) while long inputs (email, address, notes) span the full width. Fields collapse to one column below the medium breakpoint.",
    wire: col(
      [
        heading(38),
        row([field(), field()], { gap: 1 }),
        row([field(), field()], { gap: 1 }),
        field(),
        row([spacer(1), pill(20)], { gap: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "form-wizard",
    name: "Multi-Step Wizard",
    description: "Numbered steps with progress and draft save.",
    category: "Forms",
    scope: "screen",
    templates: ["form", "onboarding", "checkout"],
    promptDetails:
      "A multi-step wizard: a numbered step indicator with completed/current/upcoming states, one step's fields visible at a time, per-step validation before advancing, back/next actions, and a saved-draft banner on return.",
    wire: col(
      [
        row([circle("sm", "accent"), bar(20, "accentLine"), circle("sm", "line"), bar(20, "line"), circle("sm", "line")], {
          gap: 1,
        }),
        field(),
        field(),
        spacer(1),
        row([pill(16, "accentSoft"), spacer(1), pill(16)], { gap: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "form-sidebar-summary",
    name: "Form + Summary Rail",
    description: "Fields left, live summary right.",
    category: "Forms",
    scope: "screen",
    templates: ["form", "checkout"],
    promptDetails:
      "A form with a sticky summary rail: inputs on the left, and a right-hand panel that mirrors the entered values live (totals, selections) and holds the primary submit button. The rail moves below the form on mobile.",
    wire: row(
      [
        col([heading(46), field(), field(), field()], { gap: 1, grow: 2 }),
        col([bar(60, "strong"), bar(90), bar(70), spacer(1), pill(100)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------ tables
  {
    id: "table-basic",
    name: "Basic Data Table",
    description: "Sortable columns, simple pagination.",
    category: "Tables",
    scope: "screen",
    templates: ["table"],
    promptDetails:
      "A straightforward data table: sortable column headers, zebra-free bordered rows, a row count, and simple previous/next pagination. Includes explicit loading skeleton and empty states.",
    wire: col([row([bar(22, "strong", 2), spacer(1), pill(14)], { gap: 1 }), table({ rows: 5, cols: 4, grow: 1 })], {
      gap: 1,
    }),
  },
  {
    id: "table-advanced",
    name: "Advanced Data Table",
    description: "Filters, column toggles, bulk actions.",
    category: "Tables",
    scope: "screen",
    templates: ["table", "admin"],
    promptDetails:
      "A full data grid: search plus faceted filter chips, column visibility toggle, sticky header, row selection with a bulk-action bar, per-row overflow menu (view/edit/delete), server-style pagination with page size, and CSV export.",
    wire: col(
      [
        row([pill(20, "accentSoft"), pill(12, "accentSoft"), spacer(1), pill(12), pill(10)], { gap: 1 }),
        table({ rows: 5, cols: 5, grow: 1 }),
        row([bar(18, "line"), spacer(1), bar(10, "accentLine"), bar(6, "line")], { gap: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "table-master-detail",
    name: "Master / Detail",
    description: "List on the left, record on the right.",
    category: "Tables",
    scope: "screen",
    templates: ["table", "detail", "admin"],
    promptDetails:
      "A master/detail screen: a searchable list of records on the left with the selected row highlighted, and the full record on the right with tabs for its sub-sections. On mobile the detail opens as a full-screen view with a back action.",
    wire: row(
      [
        col([field(false), bar(100, "accentSoft", 3), bar(100, "surface", 3), bar(100, "surface", 3), bar(100, "surface", 3)], {
          gap: 1,
          grow: 1,
        }),
        col([heading(50), row([bar(14, "accentLine"), bar(14, "line"), bar(14, "line")], { gap: 1 }), table({ rows: 3, cols: 3, grow: 1 })], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "board-kanban",
    name: "Kanban Board",
    description: "Draggable cards across status columns.",
    category: "Tables",
    scope: "screen",
    templates: ["table", "admin"],
    promptDetails:
      "A kanban board: horizontally scrolling status columns with counts, draggable cards showing title, tags and assignee avatar, an add-card affordance per column, and keyboard-accessible move actions as a drag alternative.",
    wire: grid(
      4,
      (i) =>
        col(
          i === 1
            ? [bar(60, "accentLine"), card(), card()]
            : [bar(60, "line"), card(), card()],
          { gap: 1, pad: 1, tone: "surface", rounded: true }
        ),
      { gap: 1, grow: 1 }
    ),
  },

  // ------------------------------------------------------- profile & settings
  {
    id: "profile-sidebar",
    name: "Profile with Side Nav",
    description: "Section nav left, content right.",
    category: "Profile",
    scope: "screen",
    templates: ["profile", "settings"],
    promptDetails:
      "A profile screen with a left section navigation (Overview, Security, Notifications, Billing), and the selected section on the right with a header block showing avatar, name and role.",
    wire: row(
      [
        col([bar(80, "accentSoft"), bar(70, "line"), bar(75, "line"), bar(60, "line")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 1,
        }),
        col([avatarRow(), field(), field(), row([spacer(1), pill(22)], { gap: 1 })], { gap: 1, grow: 2 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "profile-tabs",
    name: "Tabbed Profile",
    description: "Hero header with tabbed sections.",
    category: "Profile",
    scope: "screen",
    templates: ["profile", "detail"],
    promptDetails:
      "A profile with a hero header (large avatar, name, role, key stats, primary action) and tabbed sections below it that keep the tab in the URL so a tab can be linked to directly.",
    wire: col(
      [
        row([circle("lg", "accentLine"), col([heading(60), sub(40)], { gap: 1, grow: 1 }), pill(18)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
        }),
        row([bar(14, "accentLine"), bar(14, "line"), bar(14, "line"), spacer(1)], { gap: 1 }),
        grid(2, card(), { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "settings-sections",
    name: "Settings Sections",
    description: "Stacked cards, one concern each.",
    category: "Profile",
    scope: "screen",
    templates: ["settings"],
    promptDetails:
      "A settings page built from stacked cards, one concern per card (profile, security, notifications, danger zone), each with its own description, controls and save button so a change saves independently.",
    wire: col(
      [
        heading(30),
        row([col([bar(50, "strong"), bar(80)], { gap: 1, grow: 2 }), pill(20, "accentSoft")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        row([col([bar(45, "strong"), bar(75)], { gap: 1, grow: 2 }), pill(20, "accentSoft")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
        row([col([bar(40, "strong"), bar(65)], { gap: 1, grow: 2 }), pill(20)], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------ detail
  {
    id: "detail-hero",
    name: "Detail with Hero",
    description: "Header summary, then content blocks.",
    category: "Detail",
    scope: "screen",
    templates: ["detail", "product"],
    promptDetails:
      "A record detail screen: a hero summary strip (title, status chip, key facts, primary and overflow actions) followed by content blocks — description, related records table, and an activity timeline.",
    wire: col(
      [
        row([col([heading(50), sub(34)], { gap: 1, grow: 1 }), pill(16, "accentSoft"), pill(16)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
        }),
        row([col([bar(90), bar(80), bar(60)], { gap: 1, grow: 2 }), card()], { gap: 1, grow: 1 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "detail-two-column",
    name: "Detail Two Column",
    description: "Main content left, meta rail right.",
    category: "Detail",
    scope: "screen",
    templates: ["detail"],
    promptDetails:
      "A two-column detail view: primary content on the left (description, tabs, comments) and a sticky metadata rail on the right (status, owner, dates, quick actions). The rail stacks under the content on mobile.",
    wire: row(
      [
        col([heading(56), bar(95), bar(88), bar(70), table({ rows: 2, cols: 3, grow: 1 })], { gap: 1, grow: 2 }),
        col([bar(70, "strong"), bar(90), bar(60), pill(100, "accentSoft"), pill(100)], {
          gap: 1,
          pad: 1,
          tone: "surface",
          border: true,
          rounded: true,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ---------------------------------------------------------------- commerce
  {
    id: "product-gallery",
    name: "Product Page",
    description: "Gallery left, buy box right.",
    category: "Commerce",
    scope: "screen",
    templates: ["product"],
    promptDetails:
      "A product page: image gallery with thumbnails on the left, and a buy box on the right holding title, price, rating, variant selectors, quantity, add-to-cart and delivery info. Specs and reviews follow below.",
    wire: row(
      [
        col([bar(100, "surface", 3), grid(4, bar(100, "line", 2), { gap: 1, h: 22 })], { gap: 1, grow: 3 }),
        col([heading(80), bar(40, "accent", 2), bar(60), row([pill(30, "accentSoft"), pill(30, "accentSoft")], { gap: 1 }), pill(100)], {
          gap: 1,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "checkout-steps",
    name: "Checkout Flow",
    description: "Steps left, order summary right.",
    category: "Commerce",
    scope: "screen",
    templates: ["checkout"],
    promptDetails:
      "A checkout screen: address, delivery and payment as collapsible steps on the left with the active step expanded, and a sticky order summary on the right showing line items, discounts, taxes and total with the pay action.",
    wire: row(
      [
        col([bar(100, "surface", 3), field(), field(), pill(30)], { gap: 1, grow: 2 }),
        col([bar(60, "strong"), bar(90), bar(85), bar(50, "accentLine"), spacer(1), pill(100)], {
          gap: 1,
          pad: 1,
          tone: "accentSoft",
          rounded: true,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },

  // ------------------------------------------------------------------- misc
  {
    id: "onboarding-checklist",
    name: "Onboarding Checklist",
    description: "Progress + guided task list.",
    category: "Onboarding",
    scope: "screen",
    templates: ["onboarding"],
    promptDetails:
      "A first-run onboarding screen: a progress ring with completion percentage, a checklist of setup tasks each with a description and action button, completed items visibly struck through, and a dismiss-for-now option.",
    wire: row(
      [
        col([chart("donut", { h: 60 }), bar(60, "line")], { gap: 1, pad: 1, tone: "surface", rounded: true, grow: 1, align: "center" }),
        col([row([circle("sm", "accent"), bar(70, "line")], { gap: 1 }), row([circle("sm", "accent"), bar(60, "line")], { gap: 1 }), row([circle("sm", "line"), bar(75, "line")], { gap: 1 }), row([circle("sm", "line"), bar(55, "line")], { gap: 1 })], {
          gap: 1,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "chat-split",
    name: "Conversation Split",
    description: "Thread list left, messages right.",
    category: "Communication",
    scope: "screen",
    templates: ["chat"],
    promptDetails:
      "A conversation screen: thread list on the left with unread indicators and search, message pane on the right with day separators, own/other message alignment, and a composer pinned to the bottom.",
    wire: row(
      [
        col([field(false), avatarRow(), avatarRow(), avatarRow()], { gap: 1, grow: 1 }),
        col([bar(55, "surface", 3), bar(70, "accentSoft", 3), bar(45, "surface", 3), spacer(1), row([field(false, 80), pill(18)], { gap: 1 })], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 2,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "calendar-month",
    name: "Calendar Month",
    description: "Month grid with events.",
    category: "Communication",
    scope: "screen",
    templates: ["calendar"],
    promptDetails:
      "A month calendar: weekday header, a 7-column day grid with out-of-month days dimmed, up to three event chips per day plus a +N overflow, and a toolbar to switch month/week/day and create an event.",
    wire: col(
      [
        row([bar(20, "strong", 2), spacer(1), pill(10, "accentSoft"), pill(10, "accentSoft")], { gap: 1 }),
        grid(7, (i) => (i % 5 === 2 ? bar(100, "accentSoft", 3) : bar(100, "surface", 3)), {
          cols: 7,
          rows: 4,
          gap: 1,
          grow: 1,
        }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "search-results",
    name: "Search & Filters",
    description: "Filter rail with result list.",
    category: "Communication",
    scope: "screen",
    templates: ["search", "table"],
    promptDetails:
      "A search results screen: a filter rail (checkbox facets, range, clear-all) on the left, a result count with sort control, and result cards with highlighted matches. Filters become a bottom sheet on mobile.",
    wire: row(
      [
        col([bar(60, "strong"), bar(80, "line"), bar(70, "line"), bar(75, "line"), bar(50, "accentLine")], {
          gap: 1,
          pad: 1,
          tone: "surface",
          rounded: true,
          grow: 1,
        }),
        col([row([field(false, 70), pill(20, "accentSoft")], { gap: 1 }), card(), card()], { gap: 1, grow: 2 }),
      ],
      { gap: 1 }
    ),
  },
  {
    id: "mobile-first",
    name: "Mobile First Screen",
    description: "Designed for a phone viewport.",
    category: "Onboarding",
    scope: "screen",
    templates: ["mobile", "onboarding", "auth"],
    promptDetails:
      "A mobile-first screen: single column, sticky bottom action bar, thumb-reachable primary control, large tap targets (min 44px) and a bottom tab bar for navigation. Scales up gracefully to a centred column on desktop.",
    wire: frame(
      col([heading(70), sub(50), card(), card(), spacer(1), pill(100)], { gap: 1 }),
      "phone"
    ),
  },
  {
    id: "empty-first-run",
    name: "Empty / First Run",
    description: "Illustration, explanation, one action.",
    category: "Onboarding",
    scope: "screen",
    templates: ["empty", "onboarding"],
    promptDetails:
      "An empty state screen: a centred illustration, a heading explaining what belongs here, one sentence of guidance, a single primary action and a secondary link to documentation.",
    wire: col([spacer(1), circle("lg", "accentSoft"), heading(46), sub(60), pill(26), spacer(1)], {
      gap: 1,
      align: "center",
    }),
  },
  // ------------------------------------------------------------------ mobile
  // Native screens are a different shape from web ones: one column, a fixed
  // chrome top and bottom, and everything reachable by thumb. Reusing
  // `dashboard-sidebar` for a phone screen would describe a layout that cannot
  // exist, so these are separate rather than a responsive note on the web ones.
  {
    id: "mobile-tabs",
    name: "Tab Bar Home",
    description: "Bottom tabs, scrolling content.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "dashboard", "list"],
    promptDetails:
      "A phone screen inside a bottom tab bar: a large title header that collapses on scroll, a single scrolling column of content, and 3–5 bottom tabs with icon plus label. The tab bar respects the home-indicator safe area and the active tab is visually obvious.",
    wire: frame(
      col(
        [
          heading(55),
          card(),
          card(),
          spacer(1),
          row([pill(20), pill(20), pill(20), pill(20)], { gap: 1, align: "between" }),
        ],
        { gap: 1 }
      ),
      "phone"
    ),
  },
  {
    id: "mobile-list",
    name: "Scrolling List",
    description: "Search, pull to refresh, rows.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "table", "list", "search"],
    promptDetails:
      "A phone list screen: a search field pinned under the header, a virtualised scrolling list of rows (never a table), pull-to-refresh, infinite scroll with a footer spinner, swipe actions on a row where they apply, and an illustrated empty state.",
    wire: frame(
      col([heading(50), pill(100, "surface"), card(), card(), card(), card()], { gap: 1 }),
      "phone"
    ),
  },
  {
    id: "mobile-detail",
    name: "Detail with Hero",
    description: "Image header, content, sticky action.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "detail", "product"],
    promptDetails:
      "A phone detail screen: a hero image or coloured header that parallaxes away on scroll, a back control overlaid top-left, the record's fields in a single scrolling column, and a sticky bottom action bar holding the primary action above the safe area.",
    wire: frame(
      col([bar(100, "accentSoft", 3), heading(60), sub(80), sub(70), spacer(1), pill(100)], {
        gap: 1,
      }),
      "phone"
    ),
  },
  {
    id: "mobile-form",
    name: "Form Screen",
    description: "Stacked fields, keyboard aware.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "form"],
    promptDetails:
      "A phone form: full-width stacked fields with labels above them, the keyboard never covering the focused field (keyboard-avoiding scroll), Next/Done keyboard actions moving between fields, inline validation under each field, and a submit button pinned above the keyboard.",
    wire: frame(
      col([heading(45), field(), field(), field(), spacer(1), pill(100)], { gap: 1 }),
      "phone"
    ),
  },
  {
    id: "mobile-sheet",
    name: "Bottom Sheet",
    description: "Modal sheet over a screen.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "form", "detail"],
    promptDetails:
      "Content presented as a bottom sheet over the screen beneath: a drag handle, detents (half and full height), dismissal by swipe-down and by backdrop tap, and the underlying screen dimmed but still visible. Never used for content the user must not lose.",
    wire: frame(
      col([spacer(1), card([bar(18, "line", 1), heading(55), sub(70), pill(100)])], { gap: 1 }),
      "phone"
    ),
  },
  {
    id: "mobile-onboarding",
    name: "Onboarding Slides",
    description: "Paged intro, dots, skip.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "onboarding"],
    promptDetails:
      "A paged onboarding flow: full-bleed illustration per page, a heading and one line of copy, page dots showing position, a Skip control top-right, and a primary button that becomes Get Started on the final page.",
    wire: frame(
      col(
        [
          spacer(1),
          circle("lg", "accentSoft"),
          heading(60),
          sub(75),
          row([circle("sm"), circle("sm"), circle("sm")], { gap: 1, align: "center" }),
          pill(100),
        ],
        { gap: 1, align: "center" }
      ),
      "phone"
    ),
  },
  {
    id: "mobile-map",
    name: "Map Screen",
    description: "Full-bleed map, sheet over it.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "dashboard"],
    promptDetails:
      "A full-bleed map filling the screen with markers, a floating recentre control, and a bottom sheet listing what is on the map that expands to full height. Handles location permission denied and location unavailable as visible states, not silence.",
    wire: frame(
      col([bar(100, "accentSoft", 3), spacer(1), card([heading(50), sub(70)])], { gap: 1 }),
      "phone"
    ),
  },
  {
    id: "mobile-profile",
    name: "Profile / Settings List",
    description: "Avatar header, grouped rows.",
    category: "Mobile",
    scope: "screen",
    templates: ["mobile", "profile", "settings"],
    promptDetails:
      "A phone profile or settings screen: an avatar and name header, then grouped rows with section headings, each row a label with a chevron, a value or a switch. Destructive actions sit in their own group at the bottom and confirm before running.",
    wire: frame(
      col([circle("md", "accentSoft"), heading(40), card(), card(), card()], {
        gap: 1,
        align: "center",
      }),
      "phone"
    ),
  },
]
