import type { Stack } from "@/types/project"

/**
 * Web, React Native or native iOS — derived from the chosen framework rather
 * than stored, so it can never disagree with the stack.
 *
 * This matters because most of the generated prompt's non-negotiables are
 * platform-specific and actively wrong on the other side: "no horizontal page
 * scroll" and "visible focus ring" mean nothing on a phone, while safe-area
 * insets, the Android hardware back button and a denied location permission
 * have no web equivalent. Shipping web rules to a React Native build reads as
 * boilerplate and gets ignored, which then costs the rules that do matter.
 */
export type Platform = "web" | "react-native" | "ios"

const byFramework: Record<string, Platform> = {
  "expo-router": "react-native",
  "react-native": "react-native",
  swiftui: "ios",
  uikit: "ios",
}

export function platformOf(stack: Stack): Platform {
  return byFramework[stack.framework] ?? "web"
}

export function isNative(stack: Stack) {
  return platformOf(stack) !== "web"
}

export const platformLabels: Record<Platform, string> = {
  web: "Web",
  "react-native": "React Native (Android + iOS)",
  ios: "Native iOS",
}

/**
 * The baseline every build of this platform must meet. Replaces the web list
 * wholesale rather than adding to it.
 */
export const platformRequirements: Record<Platform, string[]> = {
  web: [
    "Fully responsive from 360px to wide desktop — mobile-first, no horizontal page scroll at any width.",
    "Every screen handles its loading, empty and error states explicitly.",
    "Keyboard accessible with visible focus, labelled controls and WCAG AA contrast.",
    "Consistent navigation, spacing and typography across every screen.",
  ],
  "react-native": [
    "Every screen respects the safe area — status bar, notch and home indicator — using `useSafeAreaInsets`, never hardcoded padding.",
    "The Android hardware back button and the iOS swipe-back gesture both work on every screen, and neither loses unsaved input without asking.",
    "Every screen handles its loading, empty and error states explicitly, plus a fourth the web does not have: offline. Assume the network drops mid-request.",
    "Long lists are virtualised (FlashList/FlatList) — never `.map()` inside a `ScrollView`.",
    "The keyboard never covers the focused field: keyboard-avoiding views, `Next`/`Done` return keys, and dismiss-on-scroll.",
    "Every runtime permission (location, camera, notifications, photos) has an explicit denied path and a route to Settings — never a dead screen.",
    "Tap targets are at least 44×44pt with real spacing between them; nothing depends on hover.",
    "Screen reader labels on every interactive element (`accessibilityLabel`, `accessibilityRole`), and layouts that survive the largest system font size.",
    "Built and verified on **both** Android and iOS — shadows, fonts, safe areas and keyboard behaviour differ, and a screen is not done until it is right on both.",
  ],
  ios: [
    "Every screen respects the safe area and works on the smallest supported device as well as the largest.",
    "Dynamic Type is honoured up to the accessibility sizes: no fixed font sizes, no layouts that clip when text grows.",
    "VoiceOver labels, hints and traits on every interactive element; custom controls declare what they are.",
    "Every screen handles loading, empty, error and offline states explicitly.",
    "Light and dark appearance both designed, driven by the asset catalogue rather than conditional colour code.",
    "All I/O is `async`/`await` off the main actor; UI updates are `@MainActor`. No blocking the main thread.",
    "Navigation state is restorable and deep links resolve to the right screen.",
    "Follows the Human Interface Guidelines for the components used — a native app that fights the platform feels broken even when it works.",
  ],
}

/** Extra platform-specific delivery expectations. */
export const platformDelivery: Record<Platform, string[]> = {
  web: [],
  "react-native": [
    "Verify each screen on an Android device and an iOS device, at the smallest supported width and at the largest system font size.",
  ],
  ios: [
    "Verify each screen in light and dark appearance and at an accessibility Dynamic Type size before calling it done.",
  ],
}

/**
 * Conventions that only make sense on the web. Silently shipping "no raw
 * `<input type="date">`" or "no `window` at module scope" to a Swift build is
 * the kind of filler that teaches a reader to skim the rules.
 */
export const webOnlyConventionIds = ["ssr-safe", "no-native-controls", "next-proxy"]

/** Conventions whose wording changes per platform rather than disappearing. */
export const conventionOverrides: Record<Platform, Record<string, string>> = {
  web: {},
  "react-native": {
    "a11y-baseline":
      "Accessible: `accessibilityLabel` and `accessibilityRole` on every control, tap targets of at least 44×44pt, and layouts that survive the largest system font size.",
    "tokens-only":
      "No hardcoded colours, radii or shadows in components — everything comes from the shared theme, and both light and dark are designed.",
  },
  ios: {
    "a11y-baseline":
      "Accessible: VoiceOver labels, hints and traits on every control, Dynamic Type honoured up to the accessibility sizes, and contrast that holds in both appearances.",
    "tokens-only":
      "Colours and spacing come from the asset catalogue and a shared `Theme` — never `Color(hex:)` or a magic number in a view.",
  },
}
