/**
 * Share links: gzip the project JSON with the platform's own CompressionStream
 * and put it in the URL hash. No library, and the payload never leaves the
 * browser — the hash is not sent to any server.
 *
 * Format: `v1.<base64url>` where the body is gzipped UTF-8 JSON, or
 * `p1.<base64url>` when the browser has no CompressionStream (plain JSON).
 */

const GZIP_PREFIX = "v1."
const PLAIN_PREFIX = "p1."

function toBase64Url(bytes: Uint8Array) {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function streamBytes(bytes: Uint8Array, mode: "gzip" | "gunzip") {
  const stream =
    mode === "gzip"
      ? new CompressionStream("gzip")
      : new DecompressionStream("gzip")
  const blob = new Blob([bytes as BlobPart])
  const piped = blob.stream().pipeThrough(stream as ReadableWritablePair)
  const buffer = await new Response(piped).arrayBuffer()
  return new Uint8Array(buffer)
}

export async function encodeShare(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  if (typeof CompressionStream === "undefined") {
    return PLAIN_PREFIX + toBase64Url(bytes)
  }
  const gzipped = await streamBytes(bytes, "gzip")
  return GZIP_PREFIX + toBase64Url(gzipped)
}

export async function decodeShare(token: string): Promise<unknown> {
  const value = token.trim()
  if (value.startsWith(PLAIN_PREFIX)) {
    const bytes = fromBase64Url(value.slice(PLAIN_PREFIX.length))
    return JSON.parse(new TextDecoder().decode(bytes))
  }
  if (value.startsWith(GZIP_PREFIX)) {
    if (typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot read compressed share links.")
    }
    const bytes = fromBase64Url(value.slice(GZIP_PREFIX.length))
    const plain = await streamBytes(bytes, "gunzip")
    return JSON.parse(new TextDecoder().decode(plain))
  }
  throw new Error("Unrecognised share link format.")
}

export function shareUrl(token: string) {
  if (typeof window === "undefined") return ""
  const { origin, pathname } = window.location
  return `${origin}${pathname}#s=${token}`
}

export function readShareToken(): string | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash
  if (!hash.startsWith("#s=")) return null
  return hash.slice(3)
}

export function clearShareToken() {
  if (typeof window === "undefined") return
  const { origin, pathname, search } = window.location
  window.history.replaceState(null, "", `${origin}${pathname}${search}`)
}


// ── links that point at a project rather than carrying one ───────────────────
//
// The `#s=` link above is a snapshot: the whole document travels inside the
// URL and lands as a copy. That is right for "here, have this" and wrong for
// "come and look at mine" — a copy stops updating the moment it is made, and
// two people editing two copies is not collaboration.
//
// These two carry a reference instead:
//
//   #p=<server id>  — for people already added to the project. They open the
//                     live document, with whatever role they were given.
//   /v/<token>      — a public read-only link. No account needed.

const PROJECT_HASH = "#p="

/** A link to the live project, for people who already have access. */
export function projectUrl(remoteId: string): string {
  if (typeof window === "undefined") return ""
  const { origin, pathname } = window.location
  return `${origin}${pathname}${PROJECT_HASH}${remoteId}`
}

/** A link anyone can open, with no account, read-only. */
export function publicUrl(token: string): string {
  if (typeof window === "undefined") return ""
  return `${window.location.origin}/v/${encodeURIComponent(token)}`
}

export function readProjectRef(): string | null {
  if (typeof window === "undefined") return null
  const hash = window.location.hash
  if (!hash.startsWith(PROJECT_HASH)) return null
  const id = hash.slice(PROJECT_HASH.length).trim()
  return id || null
}

/**
 * Where a project reference waits out the sign-in round trip.
 *
 * Opening `#p=<id>` while signed out bounces through `/login`, and the router
 * replaces the whole URL — hash included — so by the time the person is back
 * the link is gone and they land on whatever project they had open last.
 * Stashing it in `sessionStorage` is what survives that, and it is per-tab, so
 * a link opened in one tab does not hijack another.
 */
const PENDING_KEY = "ps:pending-project"

export function stashProjectRef(): void {
  if (typeof window === "undefined") return
  const id = readProjectRef()
  if (!id) return
  try {
    window.sessionStorage.setItem(PENDING_KEY, id)
  } catch {
    // Private mode, or storage disabled. The link still works for anyone who
    // is already signed in; it just cannot survive the redirect.
  }
}

export function takeProjectRef(): string | null {
  if (typeof window === "undefined") return null
  const fromHash = readProjectRef()
  if (fromHash) {
    try {
      window.sessionStorage.removeItem(PENDING_KEY)
    } catch {}
    return fromHash
  }
  try {
    const stored = window.sessionStorage.getItem(PENDING_KEY)
    if (stored) window.sessionStorage.removeItem(PENDING_KEY)
    return stored || null
  } catch {
    return null
  }
}

/** Drop `#p=` from the address bar once it has been acted on. */
export function clearProjectRef(): void {
  clearShareToken()
}
