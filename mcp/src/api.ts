/**
 * The bit of the API this server needs, and nothing else.
 *
 * Deliberately not `lib/api/client.ts`: that one is built for a browser — it
 * reads tokens out of a store that assumes `window`, and it hands a 401 to a
 * React-level handler that signs the person out. Here a 401 means "the access
 * token aged out during a long Claude Code session", and the right answer is to
 * refresh once and carry on without anybody being told.
 */

export type Tokens = { access_token: string; refresh_token: string }

export type ProjectSummary = {
  id: string
  name: string
  description: string
  doc_version: number
  screen_count: number
  module_count: number
  is_archived: boolean
  my_role: string | null
  updated_at: string
}

export type ProjectDetail = ProjectSummary & { doc: Record<string, unknown> }

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export type Credentials = { baseUrl: string; email: string; password: string }

export class Api {
  private tokens: Tokens | null = null

  constructor(private readonly credentials: Credentials) {}

  private get root(): string {
    return `${this.credentials.baseUrl.replace(/\/+$/, "")}/api/v1`
  }

  /**
   * Sign in, once, lazily.
   *
   * Lazily because a Claude Code session may load this server and never use it,
   * and an MCP server that fails to start because a password is wrong is much
   * harder to diagnose than a tool call that says so.
   */
  private async signIn(): Promise<Tokens> {
    const response = await fetch(`${this.root}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: this.credentials.email,
        password: this.credentials.password,
      }),
    })
    const body = await readBody(response)
    if (!response.ok) {
      throw new ApiError(messageOf(body) ?? "Could not sign in", response.status)
    }
    const tokens = unwrap<Tokens>(body)
    this.tokens = tokens
    return tokens
  }

  private async refresh(): Promise<Tokens> {
    if (!this.tokens) return this.signIn()
    const response = await fetch(`${this.root}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: this.tokens.refresh_token }),
    })
    // A refresh token that has been revoked or rotated out is not an error
    // worth surfacing — signing in again is exactly as valid.
    if (!response.ok) return this.signIn()
    this.tokens = unwrap<Tokens>(await readBody(response))
    return this.tokens
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    { retry = true }: { retry?: boolean } = {}
  ): Promise<T> {
    const tokens = this.tokens ?? (await this.signIn())
    const response = await fetch(`${this.root}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${tokens.access_token}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (response.status === 401 && retry) {
      await this.refresh()
      return this.request<T>(method, path, body, { retry: false })
    }
    const parsed = await readBody(response)
    if (!response.ok) {
      throw new ApiError(
        messageOf(parsed) ?? `${method} ${path} failed`,
        response.status
      )
    }
    return unwrap<T>(parsed)
  }
}

/**
 * Every `/api/v1` route answers inside an envelope — `{success, message, data}`
 * — and the payload is the `data` field. `/health` and anything outside the
 * prefix is bare, hence the check rather than an unconditional reach.
 */
function unwrap<T>(payload: unknown): T {
  if (payload !== null && typeof payload === "object" && "success" in payload) {
    return (payload as unknown as { data: T }).data
  }
  return payload as T
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/**
 * The server wraps errors in an envelope; a proxy in front of it may not. Both
 * shapes reach here, and "[object Object]" is not a message anybody can act on.
 */
function messageOf(body: unknown): string | null {
  if (typeof body === "string") return body || null
  if (!body || typeof body !== "object") return null
  const record = body as Record<string, unknown>
  const error = record.error
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message
    if (typeof message === "string") return message
  }
  for (const key of ["message", "detail"]) {
    const value = record[key]
    if (typeof value === "string") return value
  }
  return null
}
