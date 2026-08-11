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
