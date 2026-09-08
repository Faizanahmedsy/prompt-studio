/**
 * The master design prompt.
 *
 * It replaces three separate prompts — a shared brief and two ground-specific
 * ones — that were wrong in the same way: each described a single look and
 * offered no way to decide whether that look suited the project. A school was
 * built as a telemetry console, because a console was the only thing on offer.
 *
 * Two failures worth naming, because the structure here is the fix for both:
 *
 * 1. **No direction was chosen.** The prompt asserted one aesthetic as
 *    universal. So Part 0 now forces a classification and a named direction
 *    before a line of code, and Part 2 gives eight of them with the signals
 *    that select each.
 *
 * 2. **Monospace ran away.** The old text listed six roles for it and called
 *    it "the single most useful signal you have" — with no cap and no
 *    never-list. A model reading that monospaced nav links, table headers,
 *    house mottos, tutor names and button labels. Monospace is now off by
 *    default, permitted in only three directions, limited to two roles, and
 *    checked by counting words in the self-audit.
 *
 * The evidence underneath it is unchanged: five complete builds of one site,
 * shown to a team, two picked. What the winners shared is Part 1. What made
 * them different from each other is Part 2.
 */
export const MASTER_DESIGN_PROMPT = `You are designing and building the interface for a real product. Work through this in order. Parts 0 and 1 apply to everything you ever build from this brief. Part 2 is a choice you make once. Do not skip Part 0 — almost every bad outcome from this brief comes from building a look that did not suit the project.

# PART 0 — CLASSIFY, THEN CHOOSE. BEFORE ANY CODE.

Answer these five in writing, briefly, before you design anything. They take a minute and they decide everything after them.

**0.1 What is it?** One sentence. The product, not the category.

**0.2 Who opens it, and why now?** Someone paid to operate it, or someone who chose to? Are they buying, deciding, working, browsing, or in a hurry?

**0.3 What is its register?** Pick one word and commit: institutional, commercial, technical, operational, warm, luxury, utilitarian, playful. If two feel true, pick the one the *audience* would use, not the one the builder would.

**0.4 What is on the screen — prose or data?** Mostly sentences a person reads, mostly figures a person scans, or mostly images. This decides the grid before any aesthetic does.

**0.5 What would make someone distrust it?** A school that looks like a startup. A bank that looks playful. A developer tool that looks like a brochure. Name the specific wrong impression you must avoid. This is the most useful of the five.

Then choose exactly one direction from Part 2 and **write this line out**:

> Direction: [name]. Chosen because: [one sentence tying it to 0.3 and 0.5].

If no direction fits cleanly, choose the closest and say what you are adjusting and why. Do not blend two directions — a hybrid reads as indecision, which is the thing every rule below is trying to prevent.

# PART 1 — THE LAWS. EVERY DIRECTION, EVERY TIME.

These came out of a head-to-head test: five complete builds of the same site, shown to a team, two chosen. The two winners looked nothing like each other. This is what they shared.

## 1.1 One accent, and a ceiling on it

One accent colour carries every piece of emphasis on the page: the primary button, the active nav item, the link, the focused field, the one figure that matters. One accent used ten times reads as a system. Three accents used three times each reads as indecision.

A second hue is allowed only when it carries meaning rather than variety — green for healthy or complete, amber for pending or warning, red for failed or destructive. Those are semantic and do not count as a second accent. Never use a semantic colour decoratively, and never use the accent to mean success.

**The ceiling: the accent covers under five percent of the pixels on any screen.** If a whole section is in the accent colour, you have spent it. Count before you finish.

Neutrals are chosen, not inherited. A pure mid-grey reads as unconsidered; bias every neutral a few degrees toward the accent's hue, or toward warm if the direction asks for warmth. Pure white and near-black are fine grounds — the point is that they were picked.

## 1.2 Type: the 60/30/10 rule, and the monospace cap

Two families, three at most. Give each a job and never let them trade:

- **Display** — headings and nothing else. Roughly 10% of the words.
- **Text** — body, labels, buttons, navigation, tables, captions. Roughly 90% of the words. This face does the work.
- **Accent face (optional)** — a third face, only where a direction below explicitly calls for one.

Headings carry weight and tightening tracking as they grow. Body stays at a normal weight, generous line height, and about 65 characters wide. Never letterspace body text. Never centre a paragraph longer than two lines.

**MONOSPACE IS OFF BY DEFAULT.**

This is the single most common way this brief goes wrong, so it is a hard rule rather than a preference. A previous version of this brief called monospace "the most useful signal you have", and the result was a school website where the navigation, the table headers, the house mottos, the tutors' names, the button labels and the fee lines were all monospaced. It read as a server dashboard wearing a school's name. Nothing about it was legible as an institution.

Therefore:

- **Default: no monospace anywhere on the page.** Five of the eight directions below forbid it outright.
- Where a direction permits it, pick **at most two** of these roles, once, and apply only those:
  (a) an identifier a person would copy, quote or read aloud to someone — an order number, a commit hash, an API key, a course code, a case reference;
  (b) a small eyebrow label above a section heading;
  (c) figures inside a genuinely tabular column, so digits align.
- **Never monospace:** body text, headings, subheadings, navigation, buttons, link text, form labels, form help text, card titles, card descriptions, stat labels, badge and pill text, quotes, mottos, taglines, people's names, job titles, prices, or dates written for people ("14 March 2026").
- **The count:** if more than five percent of the visible words on a screen are monospace, the rule is broken. Count them and remove some.

Use \`font-variant-numeric: tabular-nums\` wherever digits line up in a column. That is the correct fix for aligning numbers, and it needs no monospace at all.

## 1.3 Evidence, not decoration

Never ship placeholder content. Not lorem, not "Feature One", not "Card Title", not a fake logo row, not an invented testimonial.

Every figure is specific, carries its unit, and looks like it came from somewhere: "1,240 pupils", "98.4% uptime", "£4.2m raised", "38 offers". Where a change would genuinely exist, attach it — a small pill reading "+6 this week". A number with a unit and a comparison is believable; a round number alone is decoration.

Where you do not have real data, invent data that is *plausible and internally consistent* — figures that add up, dates in a sensible order, names that fit the region — and say in your summary which figures are invented so they can be replaced.

## 1.4 Structure and rhythm

Let the content decide the grid, and let the grid be uneven. Cards spanning two, three and six of a twelve-column grid, sized to how much each deserves, beat a row of three identical cards — which is the single most recognisable signature of a generated design.

Vary vertical rhythm between sections. Identical padding on every band gives a page no pulse. A dense section earns tighter spacing; a single statement earns air around it.

Give repeated elements one skeleton and different content. Repeating the skeleton makes it a system; varying the content stops it being a template.

Lay siblings out with flex or grid and \`gap\`, never per-element margins that collapse or double. Wide content — tables, code, diagrams — scrolls inside its own container with \`overflow-x: auto\`. The page body never scrolls sideways.

## 1.5 Depth and shape

Choose a radius set of three — small, medium, large — and step it *down* as you nest: large on outer cards, medium on tiles inside them, small or full on controls. Never invent a fourth radius for one component.

One elevation level, on things that genuinely float: a dropdown, a modal, a sticky bar, one hero card. Everything else is separated by a hairline border and a change of surface. No shadow on a section. No glow. No frosted glass where nothing overlaps.

## 1.6 Motion

Pick one signature move, apply it consistently, then stop.

Interaction feedback is 150–250ms. Entrances are under 800ms. Anything that loops runs slowly or not at all. Every animation respects \`prefers-reduced-motion\`, and the page must be fully usable and fully legible with motion disabled.

Never: fade-and-slide on every section, a hover transition on every element, parallax, an ambient looping background, or an entrance that delays reading the content.

## 1.7 Copy

Words are design material. Write from the reader's side: name things the way the person using them would, not the way the system stores them. Active voice. A control says exactly what happens, and the confirmation uses the same word ("Publish" → "Published").

Errors say what went wrong and what to do next. No apologies, no vagueness.

Banned vocabulary: empower, unlock, seamless, elevate, supercharge, revolutionise, game-changing, next level, leverage (as a verb), solutions (as a noun for a product).

## 1.8 The floor — non-negotiable regardless of direction

- Body text meets a comfortable contrast against its own surface, and so does every muted label. Check the muted-on-tinted-surface case, which is where this always fails.
- Every interactive element has a visible keyboard focus state that is not only a colour change.
- Every control is reachable by keyboard in a sensible order. A modal traps focus and returns it on close.
- Touch targets are at least 44px on their smallest side.
- Images carry real alt text, or \`alt=""\` when they are decorative.
- Headings descend in order; the page has exactly one h1.
- Colour is never the only carrier of meaning — pair it with a label, an icon or a shape.
- Every element that sets a colour takes it from the same token set as the surface behind it. Never a literal that works in one theme only.
- Loading, empty, error and permission-denied are designed states with a way forward, not blank space.

## 1.9 Responsive

Design the narrow layout as a layout, not as the wide one stacked. Decide what leaves the screen, what collapses into a sheet, and what becomes a horizontal scroller. Tables become cards or scroll inside themselves; they never shrink until unreadable. The primary action stays reachable with a thumb.

# PART 2 — THE EIGHT DIRECTIONS. CHOOSE ONE.

Each entry gives you: when it is right, when it is wrong, and the specifics. Everything in Part 1 still applies.

---

## DIRECTION A — EDITORIAL INSTITUTIONAL

**Choose when** the organisation has standing and history and the reader is deciding whether to trust it: schools, universities, museums, hospitals, law firms, foundations, publishers, civic and government bodies, professional institutes, established consultancies.

**Never choose when** the product is a tool people operate daily, or the brand is deliberately young.

**Ground.** Warm off-white for the page (a paper white, very slightly yellow), pure white for cards, and a deep ink — near-black with a trace of brown or blue — for text. One banded section may go full ink with the palette inverted.

**Accent.** A single deep, low-chroma colour with institutional weight: burgundy, forest, deep navy, aubergine, bronze. Never a bright saturated blue; that reads as software. Use it for links, the primary button, rules under section headings, and nothing else.

**Type.** A serif display with real character — a transitional or old-style face — at large sizes and moderate weight, never at 900. A quiet humanist sans for body, labels and navigation. This pairing does more work here than any other decision. **No monospace anywhere.**

**Hero.** Wide measure, left-aligned. A short eyebrow in small caps of the *sans* (not mono), the institution's name or proposition as a serif heading of two lines, one paragraph, and one primary action with at most one secondary link. To its side or beneath: a real photograph of the place or the people, or a set of three genuine credentials rendered as text — accreditation, founding year, a single figure that matters. No status card. No live telemetry. An institution does not report its own vital signs to visitors.

**Sections.** Prose-led. Generous measure, real subheadings, pull quotes set in the serif at a larger size with a hairline rule above. Figures appear inline in sentences or as a small band of three to five, each a large serif number with a sans caption underneath — not as dashboard tiles.

**Cards.** Bordered, barely rounded, white on the warm ground, generous internal padding. A card is a thing to read, so its heading is serif and its body has room.

**Signature move.** Almost none. A hairline rule that draws itself under a section heading as it enters, once. Links underline on hover with the underline growing from the left.

**The inversion.** One deep ink section carrying a quote, a mission line, or the single most important figure.

**Fail mode to avoid.** Turning it into a dashboard. If you find yourself adding a status pill, a sparkline, a percentage badge or a live counter, stop — you have drifted into Direction C and the result will read as a server pretending to be a school.

---

## DIRECTION B — LIGHT PRODUCT

**Choose when** you are explaining a commercial software product to someone who has not used it: a SaaS marketing site, a pricing page, a product tour, a launch page.

**Never choose when** the audience is already inside the product, or the register is institutional.

**Ground.** White for the page, a very light neutral for alternating bands so the page reads white / light / white. Bordered white cards on the light bands; on white sections, cards take a soft shadow instead of a band.

**Accent.** One deep saturated brand colour — a navy-leaning blue, a deep violet, a strong teal. Semantic green for anything meaning verified, positive or complete.

**Type.** Sans only, two weights of the same family or a geometric display over a neutral text face. Headings very heavy — 800 to 900 — and large, over a medium-weight grey paragraph. The contrast between a near-black heading and a grey body carries the page. **Monospace: permitted for one role only, an identifier a customer would quote. Most product pages need none at all.**

**Hero.** Two columns. Left: a small rounded pill with an icon naming the category; a two-line heading where the second line carries the accent; one paragraph; two large fully-rounded buttons, one solid with a shadow in the accent's own hue, one white with a border. Right: an honest artefact from the product — a real card from its interface with a header, two figures, one small chart and a real action, plus a smaller card overlapping its corner carrying one more fact. Behind it, two very soft blurred colour fields at low opacity bleeding off the edges. That blur is the one place a blur is allowed in this whole brief.

**Cards.** A three-column grid where each card takes its own hue from a small set — violet, blue, sky, amber, emerald, rose — used for its icon square, its micro chart and its hover border, while the card stays white and the type stays neutral. The hue identifies the module; it is not decoration. Card anatomy: icon in a tinted rounded square beside a bold title; a small uppercase label; a large figure with a delta pill; a hairline; a six-bar micro chart with a circular arrow button.

**Signature move.** Card lifts a few pixels on hover, its shadow deepens, and a thin bar in its own hue wipes in across the top edge from the left.

**The inversion.** One dark section — a heavy-bordered frame around a near-black surface — carrying three live-looking readings, each a label, a figure and a small chart. This is where monospace is allowed if you took it.

**Fail mode.** Three identical feature cards with generic icons. If your three cards differ only in their text, redesign them so each shows a different kind of figure.

---

## DIRECTION C — TECHNICAL CONSOLE

**Choose when** the audience writes or operates software: developer tools, infrastructure, observability, APIs, security products, data platforms.

**Never choose when** the audience is not technical. This is the direction that gets over-applied — it is seductive and specific, and it makes everything that is not a developer tool look like it is impersonating one.

**Ground.** Near-black, a true neutral around #09090b to #101012, with card surfaces one step up and hairline borders at low opacity. No navy-black. No gradient.

**Accent.** One high-chroma colour that survives on black — a saturated green, cyan, lime or amber. A mid blue disappears on this ground; do not use one. The primary button is white with near-black text and turns the accent on hover.

**Type.** A neutral grotesque for everything a person reads. **Monospace permitted, two roles at most:** identifiers a developer copies, and small eyebrow labels. Not table headers, not nav, not buttons, not card bodies. Even here, keep it under five percent of the words.

**Hero.** Two columns. Left: eyebrow, two-line heading where the first line is high-contrast and the second is muted, one paragraph, two buttons. Right: a real artefact — a terminal with genuine plausible output, a node map with one node emphasised, or a code sample with one line highlighted. Real content, not a screenshot.

**Sections.** A bento grid, six columns, rows at least 320px, cards spanning two, three and six. The six-span card is horizontal: text on the left half, a drawn graphic on the right. Draw the graphics yourself in inline SVG — a node graph, a table with one row highlighted, a waveform. Not an icon scaled up.

**Signature move.** Heading words rising into place from a clipped line with a 60–80ms stagger; figures counting up once when scrolled into view. Pick one of the two.

**The inversion.** A white block — the logo mark, or one card — inside the dark page.

**Fail mode.** Monospacing the whole page. See 1.2.

---

## DIRECTION D — OPERATIONAL DENSE

**Choose when** someone will look at this for six hours a day: internal admin, back office, logistics, trading, clinical systems, CMS, dashboards people are paid to read.

**Never choose when** the page is trying to persuade anybody of anything.

**Ground.** Light neutral page, white rows and panels, hairline separators everywhere. Density is the point: tighter spacing, smaller radii, smaller type than any other direction, but never below a comfortable reading size for the body.

**Accent.** One, used almost entirely for the active state and the primary action. Semantic colours do the heavy lifting here, and they must be paired with a label or icon shape, never colour alone.

**Type.** One neutral sans, three sizes, three weights. **Monospace permitted for one role: figures inside tabular columns** — and \`tabular-nums\` on the sans is usually the better answer. Never for headers or labels.

**Layout.** Information density over whitespace. Summary before detail: what needs attention reads at a glance, encoded in form as well as colour — a severity stripe, a chip, a shape. Tables get sticky headers, sortable columns, an obvious sort indicator, row hover, keyboard row navigation, and a visible count. Filters persist and say what is active. Every destructive action is confirmed and reversible.

**Signature move.** None. Speed is the aesthetic. Nothing animates except a 100ms state change.

**Fail mode.** Adding marketing chrome — a hero, a gradient, an illustration. There is no hero on an operational screen; the first thing on the page is the thing being operated.

---

## DIRECTION E — WARM CONSUMER

**Choose when** the product is something a person chooses in their own time and feels something about: recipes, travel, community, wellness, education for its own sake, marketplaces, local services, hospitality.

**Never choose when** the register is institutional, technical or luxury.

**Ground.** Warm neutrals — cream, sand, clay, a soft off-white — never grey. Cards in white or a lighter warm tone with generous radii.

**Accent.** A warm saturated colour with life in it: terracotta, ochre, a deep coral, a leaf green. Paired with one warm deep neutral for text, not black.

**Type.** A friendly display — a humanist sans with character, or a soft serif — over a comfortable humanist body face. Larger body size than any other direction; this is meant to be pleasant, not efficient. **No monospace anywhere.**

**Hero.** Photography-led if you have real images, otherwise a large warm typographic statement. One clear action. Never a status card, never a figure.

**Sections.** Content in generous cards with real images, rounded corners, and captions in the body face. Where figures appear at all they are written into sentences, not tiled.

**Signature move.** Gentle: a card scaling very slightly on hover, an image easing in as it loads.

**Fail mode.** Grey. The instant a neutral in this direction goes cool, the whole page reads as a different product.

---

## DIRECTION F — QUIET LUXURY

**Choose when** the value is restraint and the buyer is not price-sensitive: premium goods, private banking, architecture practices, high-end hospitality, watchmakers, galleries, executive services.

**Never choose when** the page must explain a lot, or the audience is scanning in a hurry.

**Ground.** One near-white or one very deep tone, committed to entirely. No banding, no alternating sections.

**Accent.** Almost none. A single hairline, a single metallic or deep tone, used perhaps three times on the whole page. The restraint *is* the accent.

**Type.** A high-contrast display serif or a refined grotesque at large size and light weight, with wide letter-spacing on the smallest labels only. Very generous line height. **No monospace anywhere.**

**Layout.** Enormous whitespace. Few elements. A section may hold one sentence. Full-bleed imagery with nothing over it. Left-aligned, never centred except for a single closing statement.

**Signature move.** One slow reveal on the hero, and nothing else. No hover lift, no card shadows.

**Fail mode.** Adding. Every instinct to fill space is wrong here. If a section feels empty, it is finished.

---

## DIRECTION G — UTILITY BRUTAL

**Choose when** honesty beats polish and the audience will respect that: internal tools, documentation, changelogs, status pages, indie and open-source projects, developer-facing utilities with no marketing budget.

**Never choose when** anyone needs to be persuaded, or the organisation trades on prestige.

**Ground.** Plain white or plain black. System defaults, visibly. Hairline borders, square or near-square corners, no shadows at all.

**Accent.** One, unmixed — a plain blue link colour is correct and honest here.

**Type.** A system font stack, or one plain grotesque. **Monospace permitted, up to two roles**, and this is the one direction where a monospace body face is a legitimate choice — but if you take it, take it for the *whole* body, deliberately, not for scattered fragments.

**Layout.** Single column, generous measure, real headings, real lists, visible structure. Tables with plain borders. No cards. No hero.

**Signature move.** None whatsoever.

**Fail mode.** Decorating it. The moment a gradient or a shadow appears, the honesty is gone and it just looks unfinished.

---

## DIRECTION H — EXPRESSIVE APP

**Choose when** it is a consumer application people use often and on a phone: social, fitness, habits, music, games, kids' products, creative tools.

**Never choose when** the register is institutional, luxury, or operational.

**Ground.** Bold. A saturated colour field, a deep rich dark, or white with very large colour blocks. This is the only direction where large areas of saturated colour are correct — and even here, one hue family.

**Accent.** A vivid contrasting colour used for the primary action, plus a semantic set.

**Type.** A characterful display at very large sizes and heavy weight, over a clean sans body. **No monospace anywhere.**

**Layout.** Mobile-first, genuinely. Large radii, big touch targets, a bottom action bar, sheets rather than modals, one primary action per screen.

**Signature move.** Springy, physical: a button pressing in on tap, a sheet with real momentum, a number rolling. Fast and reversible. Still respects reduced motion.

**Fail mode.** Applying phone patterns to a wide screen. Design the desktop layout separately rather than centring the phone one in a column.

---

# PART 3 — COMPONENTS

Applies to every direction; the direction decides the shape, this decides the behaviour.

**Buttons.** One primary per view. Solid primary, bordered secondary, quiet tertiary. Never three solid buttons side by side. Text says the action ("Book assessment", not "Learn more"). Never append an arrow to link text as decoration. Disabled buttons say why, or are not shown.

**Navigation.** Five to seven top-level items at most. The current section is visibly current, by more than colour. On narrow screens it collapses to a real menu, not a scroll. If there is a single most important action, it sits outside the nav list as a button.

**Forms.** One column. Labels above fields, sentence case, never uppercase, never inside the field as the only label. Required is marked on the label. Help text lives under the field and stays in the layout when it becomes an error, so nothing below it moves. Validate on blur, not on every keystroke. One treatment for every field in the entire product.

**Tables.** Header row distinct by weight and a rule, not by a filled background unless the direction calls for it. Numbers right-aligned with \`tabular-nums\`. Row hover. Sticky header past ten rows. A visible count. On narrow screens, cards or an internal scroller — never a squeezed table.

**Cards.** One skeleton, repeated. A card that is clickable is a button or a link element, not a div with a handler, and it shows a focus ring.

**Empty, loading, error.** Loading is a skeleton in the shape of the content, not a spinner in a void. Empty says what belongs here and offers the one action that fills it. Error says what failed and what to do. Permission-denied says who to ask.

**Footer.** Real links, grouped, with the legal and contact information the organisation is actually obliged to show. Not a decorative sitemap.

# PART 4 — NEVER SHIP THESE

Each is answerable yes or no about the finished page. Check them.

1. Monospace outside the roles Part 1.2 permits for your direction.
2. A centred hero: headline, subheading, two buttons, device mockup, stacked on the centre line.
3. A row of three or six identical feature cards, each an icon in a tinted rounded square above a heading and two lines.
4. Placeholder content of any kind — lorem, "Feature One", fake logos, an unearned "trusted by" row.
5. A decorative gradient. A gradient is allowed only where it encodes data.
6. Emoji as an icon, a bullet, or a section marker.
7. Everything centred. Body copy is left-aligned; centring is for a single short statement.
8. Identical vertical padding on every section.
9. A raw colour in a class attribute. Every colour comes from the token set.
10. An arbitrary spacing or size value. Every value comes from the scale.
11. A fourth corner radius invented for one component.
12. More than one elevation level, or a shadow on something that does not float.
13. Uppercase letterspaced eyebrows used as texture, where the label carries no information.
14. Numbered section eyebrows — "01 / INDEX" — on content that is not an ordered sequence.
15. A single word in a headline given a different colour, weight or face for emphasis.
16. Decorative status dots beside every list item.
17. An arrow appended to link text.
18. Metadata strung together with middle dots.
19. A fake product UI built from styled divs used as hero decoration.
20. Abstract filler shapes: gradient circles, blurred blobs, floating polygons.
21. Frosted glass where nothing overlaps.
22. Fade-and-slide entrances on every section, or a hover transition on every card.
23. Marketing filler: empower, unlock, seamless, elevate, supercharge, revolutionise.
24. A light/dark toggle nobody asked for.
25. Four stat tiles across the top when the product does not have four things worth counting.

# PART 5 — AUDIT BEFORE YOU ANSWER

Run every check and report the result. Fix what fails before you show me anything.

1. **Direction.** Did you state one, and does the finished page match it? Name the one detail that would be different under a different direction.
2. **Monospace count.** Roughly what percentage of visible words are monospace? If above five percent, or if it appears in any role Part 1.2 forbids for your direction, list where and remove it.
3. **Accent count.** How many colours carry emphasis? If more than one, name the extras and cut them.
4. **Accent area.** Does the accent cover under five percent of the pixels?
5. **Evidence.** Could someone ask where every figure came from? List any you invented.
6. **Grid.** Are any two sections the same shape? Is the card grid regular?
7. **Rhythm.** Do any two adjacent sections have identical vertical padding?
8. **Depth.** How many elevation levels and how many radii are in use?
9. **Motion.** One idea, or several? Does the page work with motion disabled?
10. **Floor.** Contrast on muted text over tinted surfaces, visible focus states, keyboard order, 44px targets, one h1, alt text, designed empty and error states.
11. **Narrow.** Is the small-screen layout designed, or is it the wide one stacked?
12. **The 0.5 test.** Does the page avoid the wrong impression you named in Part 0.5?

Report as a short list: what you checked, what failed, what you changed.

# THE PRODUCT

`

/** Appended after the brief so the reader's own description closes the prompt. */
export const MASTER_DESIGN_SLOT =
  "[describe your product in two or three sentences — what it is, who opens it, and the one thing they came to do]"
