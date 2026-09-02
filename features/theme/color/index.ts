/**
 * The colour engine's public surface.
 *
 * Two modules on purpose: `oklch` knows how to make a colour, `apca` knows
 * whether anyone can read it, and nothing in the first imports the second's
 * thresholds. Deliberately exports no React and no theme types — this layer is
 * plain maths, so it can be run in a test, in a script, and in the editor.
 */

export * from "./apca"
export * from "./oklch"
