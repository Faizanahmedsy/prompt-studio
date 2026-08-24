import { stackFor } from "@/features/builder/utils/surfaces"
import { describeDesignLanguage } from "@/features/theme/data/design-languages"
import {
  colorSchemes,
  describeOption,
  fontCharacterMap,
  fontCharacters,
} from "@/features/theme/data/typography"
import type { ProjectDoc, Surface } from "@/types/project"

type TargetFile = {
  /** where the stylesheet belongs in the generated project */
  path: string
  /** how the tokens are declared */
  shape: string
  /** the line that activates it */
  wiring: string
  /** token names the rest of the generated code already expects */
  tokens: string[]
}

/**
 * What the target file looks like depends entirely on the styling choice, and
 * getting it wrong is the difference between a stylesheet that drops in and one
 * the developer has to translate by hand. The names below are the ones the
 * build prompt has already told the agent to use.
 */
function targetFile(styling: string): TargetFile {
  const shadcnTokens = [
    "--background / --foreground",
    "--card / --card-foreground",
    "--popover / --popover-foreground",
    "--primary / --primary-foreground",
    "--secondary / --secondary-foreground",
    "--muted / --muted-foreground",
    "--accent / --accent-foreground",
    "--destructive / --destructive-foreground",
    "--border, --input, --ring",
    "--radius",
    "--chart-1 … --chart-5",
  ]

  switch (styling) {
    case "tailwind4-shadcn":
      return {
        path: "app/globals.css",
        shape:
          "Tailwind v4 reads its theme from CSS, not from a config file. Declare the raw values as custom properties on `:root` and `.dark`, then expose them to Tailwind in an `@theme inline { … }` block (`--color-background: var(--background)` and so on). Keep `@import \"tailwindcss\";` at the top.",
        wiring:
          "`app/globals.css` is already imported by `app/layout.tsx` in this stack — nothing else needs wiring.",
        tokens: shadcnTokens,
      }
    case "tailwind3-shadcn":
      return {
        path: "app/globals.css",
        shape:
          "Declare the values as HSL triplets on `:root` and `.dark` (`--primary: 221 83% 53%;`, no `hsl()` wrapper) — that is the form `tailwind.config.ts` consumes via `hsl(var(--primary))`. Keep the three `@tailwind` directives at the top.",
        wiring:
          "If a token is new rather than a restyle of an existing one, add it to `theme.extend.colors` in `tailwind.config.ts` as well, in the same `hsl(var(--x))` form.",
        tokens: shadcnTokens,
      }
    case "tailwind":
      return {
        path: "app/globals.css",
        shape:
          "Declare the palette as custom properties on `:root` and `.dark`, and expose them to Tailwind — `@theme inline` on v4, `theme.extend.colors` on v3. Name them by role (`--surface`, `--surface-raised`, `--text`, `--text-muted`, `--accent`), not by colour.",
        wiring: "Import the stylesheet once, at the root layout.",
        tokens: [
          "--background / --foreground",
          "--surface / --surface-raised",
          "--text / --text-muted",
          "--accent / --accent-foreground",
          "--border, --ring",
          "--radius",
        ],
      }
    case "nativewind":
      return {
        path: "global.css",
        shape:
          "NativeWind v4 reads the same CSS custom properties Tailwind does. Declare them on `:root` and `.dark` in `global.css`, and reference them from `tailwind.config.js` under `theme.extend.colors`. Values must be plain — React Native has no `color-mix()`, no `oklch()` and no relative colour syntax.",
        wiring: "`global.css` is imported once from the root `_layout.tsx`.",
        tokens: shadcnTokens,
      }
    case "css-modules":
      return {
        path: "styles/tokens.css",
        shape:
          "One `:root` block and one `[data-theme=\"dark\"]` block of custom properties. Modules reference `var(--x)` and never a literal.",
        wiring: "Import `styles/tokens.css` once, at the application root, before any module.",
        tokens: [
          "--color-bg / --color-fg",
          "--color-surface / --color-surface-raised",
          "--color-accent / --color-accent-fg",
          "--color-border, --color-ring",
          "--radius-sm / --radius-md / --radius-lg",
          "--shadow-1 / --shadow-2",
        ],
      }
    case "styled":
      return {
        path: "styles/theme.ts",
        shape:
          "A typed theme object (`export const lightTheme`, `export const darkTheme`) shaped for `ThemeProvider`, plus a `GlobalStyle` for the resets. Values are plain strings; the shape is what components already destructure.",
        wiring: "Both themes are passed to the existing `ThemeProvider` at the root.",
        tokens: [
          "colors.background / colors.foreground",
          "colors.surface / colors.surfaceRaised",
          "colors.primary / colors.primaryForeground",
          "colors.border, colors.ring",
          "radii.sm / md / lg",
          "shadows.1 / shadows.2",
        ],
      }
    case "mui":
      return {
        path: "styles/theme.ts",
        shape:
          "A `createTheme({ … })` call — `palette` (with `mode`), `shape.borderRadius`, `typography` and any `components` overrides. Two themes if the project ships dark as well.",
        wiring: "Passed to the existing `ThemeProvider`, with `CssBaseline` left in place.",
        tokens: [
          "palette.primary.main / .contrastText",
          "palette.secondary.main",
          "palette.background.default / .paper",
          "palette.text.primary / .secondary",
          "palette.divider",
          "shape.borderRadius",
        ],
      }
    default:
      return {
        path: "styles/tokens.css",
        shape:
          "One `:root` block of custom properties, and a dark block beside it. Name tokens by role rather than by colour.",
        wiring: "Import it once at the application root.",
        tokens: [
          "--background / --foreground",
          "--surface / --surface-raised",
          "--accent / --accent-foreground",
          "--border, --ring",
          "--radius",
        ],
      }
  }
}

/**
 * The prompt a developer copies, pastes into Claude Code alongside their Figma
 * screenshots, and gets a finished stylesheet from.
 *
 * Nothing comes back into Prompt Studio. The CSS is written straight into the
 * developer's repository, which is why the prompt has to produce a **complete**
 * file with its path and its import line stated — a fragment that has to be
 * reconciled with something generated later would be worse than useless.
 */
export function buildFigmaImportPrompt(
  doc: ProjectDoc,
  options: { surface?: Surface } = {}
): string {
  const surface = options.surface ?? "web"
  const stack = stackFor(doc, surface)
  const file = targetFile(stack.styling)
  const t = doc.theme
  const language = describeDesignLanguage(t.designLanguage)
  const scheme = describeOption(colorSchemes, t.colorScheme)
  const heading = describeOption(fontCharacters, t.headingFont)
  const body =
    t.bodyFont === "pair"
      ? "paired with the heading face"
      : (fontCharacterMap[t.bodyFont]?.label ?? heading.label)

  const wantsDark = t.colorScheme !== "light"

  return `# Task

Read the attached Figma screenshots and write the **complete stylesheet** for an
existing project, so that the code already in that project takes on the design
in the images.

You are not building components, and you are not redesigning anything. You are
reading a design that already exists and expressing it as tokens.

# The project you are writing for

- **Product:** ${doc.name}
- **Styling:** ${stack.styling}
- **File to write:** \`${file.path}\`
- **Themes:** ${scheme.label} — ${wantsDark ? "both a light and a dark block are required" : "light only; do not add a dark block"}
- **Design language the project was generated with:** ${language.name} — ${language.tagline}
- **Typography direction:** headings set in ${heading.label.toLowerCase()}, body ${body}

${file.shape}

${file.wiring}

## The token names to use

These are the names the rest of the generated code already references. Use them
exactly — a beautifully derived palette under different names styles nothing.

${file.tokens.map((token) => `- \`${token}\``).join("\n")}

If the design genuinely needs a value none of these covers, add it **beside**
them with a name in the same style, and list what you added at the end.

# How to read the screenshots

Work through these in order. Each is something the images can actually tell you.

1. **Grounds and surfaces.** The page background, the card background, and any
   raised surface. Sample the flat areas, not the shadowed edges. If light and
   dark screenshots are both supplied, read each separately rather than
   inverting one.
2. **Text colours.** Primary text, secondary/muted text, and text on coloured
   fills. Check the muted tone against the surface it actually sits on.
3. **The accent.** The colour on the primary button, the active nav item, the
   focus ring, the selected state. One accent, and the tone used for text or
   icons *on* it.
4. **Semantic colours** — success, warning, destructive, informational — read
   from badges, toasts and validation states if any are shown.
5. **Borders and dividers.** Their colour and their weight in pixels. A design
   that separates with borders and one that separates with shadows are different
   designs; say which this is.
6. **Corner radius.** Measure it on buttons, inputs, cards and modals
   separately — they are often not the same, and the ratio between them is part
   of the design.
7. **Shadows.** For each distinct elevation: offset, blur, spread and the alpha
   of the colour. If nothing is elevated, say so and emit no shadow tokens.
8. **Type.** The family's *character* (geometric, grotesque, humanist, serif,
   slab, mono — not a licensed name you cannot ship), and the size, weight and
   line height of each visible level. Derive the ratio between levels.
9. **Spacing.** Find the base unit — usually 4px or 8px — from the padding
   inside controls and the gaps between them, and express the scale in terms of
   it.
10. **Control heights.** Button, input and table row heights, and the horizontal
    padding inside each. These are what make a UI feel like the picture.

# Rules

1. **Output the whole file**, in one fenced code block, ready to save at
   \`${file.path}\`. Not a fragment, not a diff, not "the parts that changed".
2. **Say what you measured and what you guessed.** After the file, list every
   token whose value you inferred rather than read — a colour only visible in
   one small chip, a shadow behind a screenshot's own drop shadow, a state not
   pictured at all. A guess presented as a reading is the one failure that
   matters here, because nobody will re-check it.
3. **Never name a licensed typeface you cannot ship.** Describe the character
   and pick an available equivalent — a Google font or a system stack — and give
   a real fallback chain.
4. **Check contrast.** Body text against its ground must reach WCAG AA (4.5:1),
   and large text and UI borders 3:1. If the screenshot fails that, keep the
   design's intent, fix the value, and say which one you changed and why.${
    wantsDark
      ? "\n5. **Design the dark theme, do not invert it.** If only light screenshots are supplied, derive dark deliberately: a dark neutral ground rather than pure black, surfaces that step *up* in lightness with elevation, and the accent adjusted so it stays legible on a dark ground rather than reused unchanged."
      : ""
  }
${wantsDark ? "6" : "5"}. **No components, no framework code, no Tailwind utility classes in
   markup.** Tokens and base styles only.
${wantsDark ? "7" : "6"}. Do not touch any other file.

# Output format

The complete stylesheet in one fenced block, then — outside the block — two
short lists: **inferred**, and **anything added** beyond the token names above.
Nothing else. No preamble, no summary of the design's mood.

Attach the Figma screenshots with this prompt. If none are attached, ask for
them rather than inventing a palette.`
}
