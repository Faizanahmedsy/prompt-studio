import type { LibraryPrompt } from "./types"

/**
 * The design prompts, and where they come from.
 *
 * These are not invented. A team was shown five full builds of the same
 * university site and asked which looked best; two won, and these prompts are
 * the difference between those two and the three that lost — written as
 * instructions rather than as a description of either winner.
 *
 * The two winners looked nothing alike. One was near-black with a single
 * high-chroma green; the other was white with a navy blue. What they shared
 * was that both looked like a working product rather than a poster about one:
 * real numbers with units, a live-looking artefact in the hero, monospace
 * reserved for machine readings, an uneven grid, and exactly one accent doing
 * all the emphasis. The three that lost were *decorated* — a saturated colour
 * field with hard offset shadows, a serif editorial layout, a cream-and-amber
 * page with emoji section markers. Each was competent. None looked like
 * software you could operate.
 *
 * So the shared prompt is the one to reach for, and the two flavour prompts
 * below it are the same principles committed to a ground.
 */

const INSTRUMENT_PRINCIPLES = `You are designing the interface for a real product. Before you write any code, read these principles and then follow them. They come from a head-to-head test where five complete designs of the same site were shown to a team and two were picked; this is what the two winners had in common and the three losers did not.

## The one idea

A good interface looks like a working instrument, not a poster about one. Everything below is a way of doing that.

## Colour

Pick one calm ground and hold it. Either near-black (a neutral around #09090b to #101012, never navy-black or a gradient) or white with an off-white second surface for banded sections. Do not use both as equals; choose one and let the other appear once.

Pick exactly one accent, and let it carry every piece of emphasis on the page — the primary button, the active nav item, the live figure, the eyebrow label. One accent used ten times reads as a system; three accents used three times each reads as indecision. A second colour is allowed only when it carries meaning rather than variety: green for healthy, amber for pending, red for failed. Those are semantic and do not count as a second accent.

Saturation is a scarce resource. In the winning designs the accent occupied under five percent of the pixels. The designs that lost flooded whole sections with saturated colour, which left nothing for emphasis to do.

## Type

Two families, three at most, each with a job:

- a sans for everything a person says — headings, body, buttons, labels;
- a monospace for everything a machine says — identifiers, timestamps, status codes, units, eyebrow labels, table figures, receipt lines.

The monospace is the single most useful signal you have. It is what makes a number look like a reading off a system rather than a claim in an advert. Use it for small uppercase eyebrows with wide letter-spacing above section headings, and for anything that looks like it came out of a database.

Headings carry weight, not size alone: go heavy — 800 or 900 — and tighten the tracking as they get bigger. Body stays at a normal weight, generous line height, and roughly 65 characters wide. Never letterspace body text.

## Content

Never ship placeholder content. Not lorem, not "Feature One", not "Card Title", not a fake logo row.

Every number is specific, carries its unit, and looks like it came from somewhere: "25,480 students", "98.4% uptime", "₹35.0 LPA highest package", "750+ recruiters". Attach a change to it where a change would exist — a small pill reading "+6 new" or "Top 5%". A number with a unit and a delta is believable; a round number alone is decoration.

Write the copy from the reader's side. Name things the way the person using them would.

## Structure

Use an uneven grid. Cards of two, three and six columns in the same twelve- or six-column grid, each sized to how much its content deserves, beats a row of three identical cards — which is the single most common signature of a generated design.

Give every card the same skeleton and different data:

1. a small monospace uppercase eyebrow in the accent colour;
2. a short bold heading;
3. one line of plain explanation;
4. the figure itself — a big number, a six-bar micro chart, a sparkline, a progress bar, a status pill;
5. one affordance at the bottom saying what happens if you click it.

Repeating the skeleton is what makes it a system. Varying the figure is what stops it being a template.

## The hero

The hero shows the product working. Not a screenshot, not a floating device mockup, not a centred headline over a gradient.

Build a real, honest-looking artefact: a status card with a health pill, two stat tiles, a sparkline and a real action; or an interactive map of the system with one node emphasised; or a terminal panel with live-looking readings. Put a small secondary card overlapping its corner so it sits in space. Give it a border, one shadow, and no glow.

Alongside it, on the left: a monospace eyebrow, a heading of two lines where the first is high-contrast and the second is muted, one paragraph, and two buttons — one solid, one outlined. Not three buttons.

## Shape and depth

Choose a radius set and step it down as you nest: large on outer cards, medium on tiles inside them, full on buttons and pills. Never invent a fourth radius for one component.

One elevation level, on things that genuinely float — the hero card, a dropdown, a modal. Everything else is separated by a hairline border and a change of surface. No shadow on a section, no glow, no frosted glass where nothing overlaps.

## Motion

Pick one signature move and apply it everywhere, then stop.

Good ones, each used alone: heading words rising into place from a clipped line with a 60–80ms stagger; figures counting up once when their section scrolls into view; a card lifting a few pixels on hover while a thin accent bar wipes in across its top edge. All of them are fast — 200ms for interaction, under 800ms for entrances — and all of them respect prefers-reduced-motion.

No fade-and-slide on every section, no hover transition on every element, no parallax, no ambient looping background.

## The inversion

Put exactly one panel in the opposite ground from the page: a dark terminal or console block inside a light page, or a white document or card inside a dark page. One inversion makes the ground read as a deliberate choice. Two make it read as an accident.

## Documents look like documents

Where the content actually is a document — a receipt, an invoice, a certificate, a ticket — draw it as paper. A thick coloured top border, a dashed tear line, monospace line items with the figures right-aligned, a total rule, and a rotated stamp at low opacity. Tilt it a degree or two and straighten it on hover. This works because it is honest about what the thing is; do not apply it to anything that is not a document.

## Never do these

- A centred hero: headline, subheading, two buttons, device mockup, all stacked on the centre line.
- A row of three or six identical feature cards, each an icon in a tinted rounded square above a heading and two lines.
- A purple-to-blue or any decorative gradient. A gradient is allowed only where it encodes data.
- Emoji as icons, bullets or section markers.
- Everything centred. Body copy is left-aligned.
- Identical vertical padding on every section, so the page has no rhythm.
- Hard offset shadows on flat saturated blocks.
- Uppercase eyebrow labels used as texture, where the label carries no information.
- Numbered section eyebrows on content that is not an ordered sequence.
- A light/dark toggle nobody asked for.
- Abstract filler shapes: gradient circles, blurred blobs, floating polygons used as decoration.

## Before you finish

Answer these about what you built, and fix what fails:

1. Is there exactly one accent colour, and does it appear on fewer than one in twenty pixels?
2. Is every number on the page specific enough that someone could ask where it came from?
3. Does the hero contain something that behaves, or only something that describes?
4. Is the monospace used only for machine output?
5. Are any two sections the same shape? If the grid is regular, make it uneven.
6. Is there exactly one motion idea, and one inversion?

Report which of these you had to fix.`

export const designPrompts: LibraryPrompt[] = [
  {
    id: "instrument-ui",
    title: "The instrument look",
    blurb:
      "Design principles taken from a five-way test — what the two winning designs shared, written as instructions.",
    category: "Design",
    tags: [
      "design",
      "ui",
      "landing page",
      "web app",
      "visual",
      "principles",
      "tested",
    ],
    howToUse:
      "Paste this above your own description of what you are building. It sets the visual direction and leaves the product to you. Works with any framework — nothing here names one.",
    body: `${INSTRUMENT_PRINCIPLES}

---

Now build this:

[describe your product in two or three sentences — what it is, who opens it, and the one thing they came to do]`,
  },

  {
    id: "dark-console",
    title: "Dark console",
    blurb:
      "The same principles committed to a near-black ground with one high-chroma accent — the developer-portal look.",
    category: "Design",
    tags: ["design", "dark", "developer", "portal", "bento", "dashboard"],
    howToUse:
      "Reach for this when the product is a tool people work inside — a platform, a console, a developer product. Replace the accent hue if you have a brand colour; keep everything else.",
    body: `${INSTRUMENT_PRINCIPLES}

---

Commit those principles to this specific ground:

## The ground

Near-black. A neutral around #09090b for the page, one step up around #18181b for card surfaces, and hairline borders at about 30% opacity of a #3f3f46 grey. No pure black, no navy tint, no gradient anywhere.

## The accent

One high-chroma colour used sparingly against that black — a saturated green, cyan or amber sits well on this ground; a mid blue does not, it disappears. Use it for eyebrow labels, the live figure in a card, the hover state of a nav link, and the small "explore" affordance at the bottom of each card. The primary button is white with near-black text, and turns the accent colour on hover.

## The navigation

A floating pill: fixed a short distance from the top, inset from both edges, its own rounded surface with a blurred translucent background and a hairline border, sitting over the page rather than attached to it. The logo mark is a white rounded square — that white block is your one inversion. Nav links are semibold, small, and change to the accent on hover.

## The body

A bento grid, six columns, rows at least 320px, cards at spans of two, three and six. The six-span card is horizontal: text on the left half, a graphic on the right. Every card is a button — the whole thing, not a link inside it — with a visible focus ring.

Draw the card graphics yourself in inline SVG or with positioned elements. Do not use stock illustrations or an icon at four times its size. A miniature of what the module actually does — a node graph, a table with one row highlighted, a stack of documents, a waveform — is what makes the grid worth looking at.

## The hero

Two columns. On the left, the monospace eyebrow, the two-line heading with words rising into place on a stagger, a paragraph, and the two buttons. On the right, an interactive map of the system: absolutely positioned tiles of differing sizes filling the space, one larger and highlighted in the accent, each showing an icon, a name and a category. Hovering a tile promotes it.

## The rhythm

Between the hero and the grid, a logo marquee scrolling slowly and infinitely, pausing on hover. After the grid, a set of three big numbers that count up once when scrolled into view, each with a monospace label above it. Then news or activity, then one high-contrast call to action.

Build this for:

[describe your product in two or three sentences]`,
  },

  {
    id: "light-saas",
    title: "Light product page",
    blurb:
      "The same principles on white — a single brand colour, colour-coded modules, and a live status card in the hero.",
    category: "Design",
    tags: ["design", "light", "saas", "landing page", "marketing", "cards"],
    howToUse:
      "Reach for this when the page has to explain the product to someone who has not used it — a marketing site, a pitch, an onboarding page. Swap the blue for your brand colour.",
    body: `${INSTRUMENT_PRINCIPLES}

---

Commit those principles to this specific ground:

## The ground

White for the page, with a very light neutral for banded sections so the page alternates white, light, white, light. Hairline borders in the lightest neutral. Bordered white cards sit on the light bands; on the white sections the cards get a soft shadow instead of a band.

## The accent

One deep saturated blue for the brand — a navy-leaning blue, not a bright one — used for the primary button, links, the active nav item, icons in their tinted square, and one word of the heading. A second colour, a strong green, is reserved for anything meaning go, verified or positive: the scholarship figure, the success stamp, the progress fill. Nothing else is coloured.

## The type

Very heavy headings — 800 to 900 — at large sizes with tight tracking, over a medium-weight grey body at a comfortable size. The contrast between a black heading and a grey paragraph is doing most of the work; do not weaken it by making the paragraph darker.

## The hero

Two columns, generous top padding.

Left: a small rounded pill with an icon and one line naming the category of product; a heading of two lines where the second line is the accent; a paragraph; two large fully rounded buttons — one solid accent with a shadow in the accent's own hue, one white with a border.

Right: a live status card. A bordered white card with a large soft shadow, containing a header row with an icon in a tinted rounded square, a product name, a monospace node identifier beneath it, and a status pill on the right reading healthy with a percentage. Below that, two stat tiles on a light inner surface, each with a small uppercase label, a big number with its unit in a lighter weight beside it, and a figure underneath — a hand-drawn sparkline path in one, a progress bar in the other. At the bottom, one dark full-width action button and a square icon button beside it. Then a small second card overlapping the top-right corner, showing one more fact.

Behind all of it, two large very soft blurred colour circles at low opacity — one in the accent hue, one in the green — bleeding off the edges. This is the one place a blur is allowed.

## The modules

A three-column grid of cards on the light band. Each card takes its own hue from a small set — violet, blue, sky, amber, emerald, rose — used for its icon square, its bar chart and its hover border, while the card itself stays white and the type stays neutral. The hue identifies the module; it is not decoration.

Each card: an icon in a tinted rounded square beside a bold heading; then a tiny uppercase label, a big number with a small delta pill beside it; a hairline rule; then a six-bar micro chart in the card's hue with a circular arrow button on the right. On hover the card lifts a few pixels, its shadow deepens, and a thin bar in its hue wipes in across the top edge from the left.

## The inversion

One section with a dark panel: a heavy-bordered dark frame around a black inner surface, monospace throughout, showing three live readings in different accent colours, each a label, a big figure and a small sparkline or bar, with status chips along the bottom. Put explanatory text and a checklist beside it in the light column.

## The documents

Where the product produces a document, draw the document. A receipt with a thick dark top border, a dashed rule under the header, monospace line items with right-aligned figures, one line in green for a discount, a heavy rule and a total in a very large weight, and a rotated stamp at low opacity across it. Tilt it slightly and straighten it on hover.

Build this for:

[describe your product in two or three sentences]`,
  },

  {
    id: "design-critique",
    title: "Critique a design you already have",
    blurb:
      "Hand it a screenshot or the markup and get a specific list of what is generic and what to change.",
    category: "Design",
    tags: ["design", "critique", "review", "feedback", "audit"],
    howToUse:
      "Attach a screenshot, or paste the component's markup and CSS. Works best on one screen at a time.",
    body: `Critique the interface below as a design lead would in a working review — specific, unsentimental, and about this screen rather than about design in general.

Judge it against these, in this order:

1. **Accent discipline.** How many colours carry emphasis? Name them. If more than one is doing emphasis rather than meaning, say which to cut.
2. **Evidence.** Is every number specific, with a unit, and plausibly from somewhere? Quote any that read as placeholder.
3. **Hierarchy.** Squint at it. What reads first? Is that the thing that should read first?
4. **Rhythm.** Do sections have different vertical padding, or is every band the same height? Is the grid uneven, or is it a row of identical cards?
5. **Voice.** Is monospace reserved for machine output? Is any body copy letterspaced, centred, or written in marketing language — empower, unlock, seamless, elevate?
6. **Depth.** Count the elevation levels and the corner radii in use. More than one shadow level or more than three radii is a finding.
7. **Motion.** Is there one idea applied consistently, or several scattered?
8. **Generic signatures.** Name any of these you find: centred hero with a device mockup, three identical feature cards, decorative gradient, emoji as icons, abstract blurred blobs, a link with an arrow appended to its text, metadata joined by middle dots, numbered eyebrows on unordered content.

Then give me:

- **The three changes with the highest ratio of improvement to effort**, each as a concrete instruction — which element, what to change it to, and why that is better. Not "improve contrast"; "the grey on the card subtitle is too light against the card surface — take it two steps darker so it clears a comfortable reading contrast".
- **One thing that is already working**, and why, so I do not break it.
- **The single riskiest change** — the one that would most improve it if it lands and most damage it if it does not.

Do not rewrite the whole thing. Do not compliment it before the critique. If a section is fine, say nothing about it.

Here is the design:

[paste the markup, or attach the screenshot]`,
  },

  {
    id: "first-screen",
    title: "Decide what the home screen is",
    blurb:
      "Stops an assistant putting a dashboard of metric tiles on the home page of a product nobody operates.",
    category: "Design",
    tags: ["design", "product", "home", "entry", "information architecture"],
    howToUse:
      "Use this before asking anything to build the app, or on its own to settle an argument about the home page.",
    body: `I am going to describe a product. Before you design or build anything, decide what its first screen is, and defend the decision.

Answer these two questions first, out loud:

1. **Who opens this?** Someone paid to operate it — staff, an admin, a dispatcher, a back office — or someone who chose to use it, a customer or a member of the public?
2. **What single thing did they come to do?** One verb and one noun, in their words rather than the operator's. "Pin a place I want to go", not "manage bucket lists". "Find a plumber near me", not "browse service providers".

Then apply this rule: **the first screen renders that one thing, at full size, as the first thing on the page.** Not a summary of it. Not a set of cards leading to it.

- If the answer is a place, a map fills the screen with search over it.
- If the answer is something to read or watch, the collection itself fills the screen.
- If the answer is something to find, the search field is the largest element on the page.
- If the answer is something to capture, the composer or the camera is already open.

Metric cards, KPI tiles, activity feeds and a grid of tiles linking to the other screens belong to operators. Put them on the first screen only if the person genuinely opened the product to monitor or report on something. For a product members of the public choose to open, a dashboard home screen is wrong even when every screen behind it is right.

Then check yourself before you answer:

- Someone opens this for the first time, having been told one sentence about what it does. Can they do that thing immediately, or does the screen describe the product to them first?
- Is the largest element the thing they came for, or is it navigation?
- Would this same first screen fit a different product in the same industry? If yes it is generic, and generic here means a dashboard.

Give me: the two answers, the first screen in a short paragraph, the three or four screens behind it, and one sentence on what you deliberately left off the first screen.

The product:

[describe it in two or three sentences]`,
  },
]
