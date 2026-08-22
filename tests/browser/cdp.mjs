// A tiny CDP driver: launch headless Chrome, talk to it over its own WebSocket.
// Node has WebSocket built in since 22, so this needs no dependencies at all.
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Where Chrome lives. `CHROME_PATH` wins, then the usual places — a hardcoded
 * path works on exactly one machine, and CI runners and macOS both put it
 * somewhere else.
 */
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/opt/google/chrome/chrome",
    "/snap/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ]
  const found = candidates.find((path) => existsSync(path))
  if (!found) {
    throw new Error(
      "No Chrome found. Install it, or set CHROME_PATH to the binary.\n" +
        `Looked in:\n  ${candidates.join("\n  ")}`
    )
  }
  return found
}

export async function launch({ port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), "cdp-"))
  const chrome = spawn(
    findChrome(),
    [
      "--headless=new",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-sandbox",
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] }
  )

  let target = null
  for (let i = 0; i < 100; i++) {
    await new Promise((r) => setTimeout(r, 100))
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = list.find((t) => t.type === "page")
      if (target) break
    } catch {}
  }
  if (!target) {
    chrome.kill()
    throw new Error("Chrome never came up")
  }

  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })

  let id = 0
  const pending = new Map()
  const listeners = new Map()
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const slot = pending.get(message.id)
      pending.delete(message.id)
      if (!slot) return
      message.error ? slot.reject(new Error(message.error.message)) : slot.resolve(message.result)
      return
    }
    for (const fn of listeners.get(message.method) ?? []) fn(message.params)
  }

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const next = ++id
      pending.set(next, { resolve, reject })
      socket.send(JSON.stringify({ id: next, method, params }))
    })

  const on = (method, fn) => {
    if (!listeners.has(method)) listeners.set(method, [])
    listeners.get(method).push(fn)
  }

  await send("Page.enable")
  await send("Runtime.enable")
  await send("Log.enable")

  const consoleErrors = []
  on("Log.entryAdded", ({ entry }) => {
    if (entry.level === "error") consoleErrors.push(entry.text)
  })
  on("Runtime.exceptionThrown", ({ exceptionDetails }) => {
    consoleErrors.push(exceptionDetails.exception?.description ?? exceptionDetails.text)
  })

  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send("Runtime.evaluate", {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? "eval failed")
    return result.value
  }

  const goto = async (url) => {
    await send("Page.navigate", { url })
    // Wait for the app to actually paint, not just for the document to load.
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 100))
      const ready = await evaluate("return document.readyState === 'complete'")
      if (ready) return
    }
    throw new Error(`never finished loading ${url}`)
  }

  const waitFor = async (expression, { timeout = 15000, label = expression } = {}) => {
    const deadline = Date.now() + timeout
    while (Date.now() < deadline) {
      const value = await evaluate(`return Boolean(${expression})`)
      if (value) return true
      await new Promise((r) => setTimeout(r, 150))
    }
    throw new Error(`timed out waiting for: ${label}`)
  }

  const close = async () => {
    try { socket.close() } catch {}
    chrome.kill()
    try { rmSync(profile, { recursive: true, force: true }) } catch {}
  }

  return { send, evaluate, goto, waitFor, close, consoleErrors }
}
